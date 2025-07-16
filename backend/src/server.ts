import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';

// Import routes
import authRoutes from './routes/auth';
import visitorRoutes from './routes/visitors';
import visitRoutes from './routes/visits';
import facilityRoutes from './routes/facilities';
import securityRoutes from './routes/security';
import auditRoutes from './routes/audit';
import emergencyRoutes from './routes/emergency';
import tenantRoutes from './routes/tenants';
import invitationRoutes from './routes/invitations';
import hostsRoutes from './routes/hosts';
import notificationRoutes from './routes/notifications';
import publicRoutes from './routes/public';
import badgesRoutes from './routes/badges';
import tenantDiscoveryRoutes from './routes/tenantDiscovery';
import systemRoutes from './routes/system';
import rolesRoutes from './routes/roles';
import identityProvidersRoutes from './routes/identityProviders';
import qrCodeRoutes from './routes/qrCode';
import acsRoutes from './routes/acs';
import civPivRoutes from './routes/civPiv';
import enhancedBadgesRoutes from './routes/enhancedBadges';

// Import middleware
import { errorHandler } from './middleware/errorHandler';
import { auditLogger } from './middleware/auditLogger';
import { authenticateToken } from './middleware/auth';
import { authenticateAzureAdToken } from './middleware/azureAdAuth';

// Import database
import { initializeDatabase } from './config/database';
import { initializeCronJobs } from './utils/cronJobs';

// Import additional dependencies for pre-registration routes
import { body, param, validationResult } from 'express-validator';
import { query as dbQuery, transaction } from './config/database';
import { asyncHandler, createError } from './middleware/errorHandler';
import { QrCodeService } from './services/qrCodeService';
import multer from 'multer';
import fs from 'fs';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Configure multer for file uploads (for pre-registration)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Initially save to a temporary directory
    const uploadDir = path.join(process.env.UPLOAD_PATH || './uploads', 'temp');
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'id-' + uniqueSuffix + ext);
  }
});

const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Accept only images
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'));
  }
};

const upload = multer({ 
  storage,
  fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '5242880') // 5MB default
  }
});

// Log Azure AD configuration status
console.log('🔐 Azure AD Configuration:', {
  enabled: !!(process.env.AZURE_AD_TENANT_ID && process.env.AZURE_AD_CLIENT_ID),
  tenant_id: process.env.AZURE_AD_TENANT_ID ? '***configured***' : 'not configured',
  client_id: process.env.AZURE_AD_CLIENT_ID ? '***configured***' : 'not configured'
});

console.log('☁️ AWS Federation Configuration:', {
  enabled: process.env.AWS_FEDERATION_ENABLED === 'true',
  region: process.env.AWS_REGION || 'not configured',
  role_prefix: process.env.AWS_FEDERATED_ROLE_ARN_PREFIX ? '***configured***' : 'not configured'
});

// CORS middleware - MUST be first in the middleware chain
app.use(cors({
  origin: '*', // Allow all origins in development
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Serve uploaded files with specific CORS headers
app.use('/uploads', express.static(path.join(__dirname, '../uploads'), {
  setHeaders: (res, path, stat) => {
    res.setHeader('Access-Control-Allow-Origin', 'http://localhost:5173');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
}));

// Explicitly handle OPTIONS requests for CORS preflight
app.options('*', cors());

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// Rate limiting - Increased limits for development
const isProduction = process.env.NODE_ENV === 'production';
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  max: isProduction ? 
    parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100') : 
    parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '500'), // Higher limit for development
  message: {
    error: 'Too many requests from this IP, please try again later.',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging middleware
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined'));
}

// Audit logging middleware
app.use(auditLogger);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

// Public routes (no authentication required)
app.use('/api', publicRoutes);
app.use('/api/tenant-discovery', tenantDiscoveryRoutes);

// Public QR code image endpoint (must be before authenticated routes)
app.get('/api/qr-code/image/:invitationId', [
  param('invitationId').isUUID().withMessage('Valid invitation ID is required')
], asyncHandler(async (req: express.Request, res: express.Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array());
  }

  const { invitationId } = req.params;

  // Get tenant_id from the invitation
  const invitationResult = await dbQuery(`
    SELECT tenant_id, status, pre_registration_required, pre_registration_status
    FROM invitations
    WHERE id = $1
  `, [invitationId]);

  if (invitationResult.rows.length === 0) {
    throw createError('Invitation not found', 404, 'INVITATION_NOT_FOUND');
  }

  const invitation = invitationResult.rows[0];

  // Check if invitation is approved
  if (invitation.status !== 'approved') {
    throw createError('QR code is only available for approved invitations', 400, 'INVITATION_NOT_APPROVED');
  }

  // Check if pre-registration is required but not completed
  if (invitation.pre_registration_required && invitation.pre_registration_status !== 'completed') {
    throw createError('QR code will be available after pre-registration is completed', 400, 'PRE_REGISTRATION_REQUIRED');
  }

  // Get QR code image using the tenant_id from the invitation
  const qrCodeImage = await QrCodeService.getQrCodeImage(invitationId, invitation.tenant_id);

  res.json({
    qr_code_image: qrCodeImage
  });
}));

// Pre-registration routes (public, must be before protected invitation routes)
app.get('/api/invitations/pre-register/:token', asyncHandler(async (req: express.Request, res: express.Response) => {
  const { token } = req.params;

  // Find invitation by pre-registration token
  const result = await dbQuery(`
    SELECT i.*, 
           h.profile_id as host_profile_id,
           p.full_name as host_name,
           p.email as host_email,
           f.name as facility_name
    FROM invitations i
    JOIN hosts h ON i.host_id = h.id
    JOIN profiles p ON h.profile_id = p.id
    JOIN facilities f ON i.facility_id = f.id
    WHERE i.pre_registration_link LIKE $1
    AND i.status = 'approved'
  `, [`%${token}`]);

  if (result.rows.length === 0) {
    throw createError('Invalid or expired pre-registration link', 404, 'INVALID_LINK');
  }

  const invitation = result.rows[0];

  // Check if pre-registration is already completed
  if (invitation.pre_registration_status === 'completed') {
    throw createError('Pre-registration already completed', 400, 'ALREADY_COMPLETED');
  }

  // If visitor_id exists, get visitor details
  let visitor = null;
  if (invitation.visitor_id) {
    const visitorResult = await dbQuery(`
      SELECT first_name, last_name, email, company, phone, id_type, id_number, 
             nationality, citizenship, date_of_birth, ssn, photo_url,
             emergency_contact_name, emergency_contact_phone
      FROM visitors
      WHERE id = $1
    `, [invitation.visitor_id]);
    
    if (visitorResult.rows.length > 0) {
      visitor = visitorResult.rows[0];
    }
  }

  res.json({
    invitation: {
      id: invitation.id,
      purpose: invitation.purpose,
      scheduled_date: invitation.scheduled_date,
      scheduled_start_time: invitation.scheduled_start_time,
      scheduled_end_time: invitation.scheduled_end_time,
      host_name: invitation.host_name,
      facility_name: invitation.facility_name,
      visitor: visitor
    }
  });
}));

app.post('/api/invitations/pre-register/:token', upload.single('id_image'), [
  body('first_name').isLength({ min: 1, max: 100 }).trim(),
  body('last_name').isLength({ min: 1, max: 100 }).trim(),
  body('email').optional({ checkFalsy: true }).isEmail().normalizeEmail(),
  body('phone').optional({ checkFalsy: true }).isMobilePhone('any'),
  body('company').optional({ checkFalsy: true }).isLength({ max: 200 }).trim(),
  body('id_number').optional({ checkFalsy: true }).isLength({ max: 50 }).trim(),
  body('id_type').optional({ checkFalsy: true }).isIn(['drivers_license', 'passport', 'state_id', 'military_id', 'government_id', 'other']),
  body('date_of_birth').optional({ checkFalsy: true }).isISO8601(),
  body('citizenship').optional({ checkFalsy: true }).isLength({ max: 50 }).trim(),
  body('nationality').optional({ checkFalsy: true }).isLength({ max: 50 }).trim(),
  body('ssn').optional({ checkFalsy: true }).isLength({ min: 4, max: 4 }).isNumeric(),
  body('emergency_contact_name').optional({ checkFalsy: true }).isLength({ max: 100 }).trim(),
  body('emergency_contact_phone').optional({ checkFalsy: true }).isMobilePhone('any')
], asyncHandler(async (req: express.Request, res: express.Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError('Validation failed', 400, 'VALIDATION_ERROR');
  }

  const { token } = req.params;
  const visitorData = req.body;
  const idImage = req.file;

  await transaction(async (client) => {
    // Find invitation by pre-registration token
    const invitationResult = await client.query(`
      SELECT i.*, tenant_id
      FROM invitations i
      WHERE i.pre_registration_link LIKE $1
      AND i.status = 'approved'
    `, [`%${token}`]);

    if (invitationResult.rows.length === 0) {
      throw createError('Invalid or expired pre-registration link', 404, 'INVALID_LINK');
    }

    const invitation = invitationResult.rows[0];

    // Check if pre-registration is already completed
    if (invitation.pre_registration_status === 'completed') {
      throw createError('Pre-registration already completed', 400, 'ALREADY_COMPLETED');
    }

    // Create or update visitor
    let visitorId = invitation.visitor_id;
    let photoUrl = null;
    
    // Process ID image if uploaded
    if (idImage) {
      // Create tenant-specific directory
      const tenantDir = path.join(process.env.UPLOAD_PATH || './uploads', invitation.tenant_id, 'ids');
      if (!fs.existsSync(tenantDir)) {
        fs.mkdirSync(tenantDir, { recursive: true });
      }

      // Move file from temp to tenant-specific directory
      const newFilePath = path.join(tenantDir, idImage.filename);
      fs.renameSync(idImage.path, newFilePath);

      // Create URL for the uploaded image
      const baseUrl = process.env.BACKEND_URL || 'http://localhost:3001';
      photoUrl = `${baseUrl}/uploads/${invitation.tenant_id}/ids/${idImage.filename}`;
    }
    
    if (!visitorId) {
      // Create new visitor
      const visitorResult = await client.query(`
        INSERT INTO visitors (
          tenant_id, first_name, last_name, email, phone, company, id_number, id_type,
          date_of_birth, citizenship, nationality, ssn, emergency_contact_name,
          emergency_contact_phone, background_check_status, photo_url
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        RETURNING id
      `, [
        invitation.tenant_id,
        visitorData.first_name,
        visitorData.last_name,
        visitorData.email,
        visitorData.phone,
        visitorData.company,
        visitorData.id_number,
        visitorData.id_type || 'drivers_license',
        visitorData.date_of_birth,
        visitorData.citizenship,
        visitorData.nationality,
        visitorData.ssn,
        visitorData.emergency_contact_name,
        visitorData.emergency_contact_phone,
        'pending',
        photoUrl
      ]);
      
      visitorId = visitorResult.rows[0].id;
      
      // Update invitation and visit with the new visitor ID
      await client.query(`
        UPDATE invitations
        SET visitor_id = $1, pre_registration_status = 'completed', updated_at = NOW()
        WHERE id = $2
      `, [visitorId, invitation.id]);
      
      // Also update the corresponding visit
      await client.query(`
        UPDATE visits
        SET visitor_id = $1, pre_registration_status = 'completed', updated_at = NOW()
        WHERE id IN (
          SELECT v.id FROM visits v
          JOIN invitations i ON v.purpose = i.purpose 
            AND v.scheduled_date = i.scheduled_date
            AND v.host_id = i.host_id
            AND v.facility_id = i.facility_id
          WHERE i.id = $2
        )
      `, [visitorId, invitation.id]);
    } else {
      // Update existing visitor
      await client.query(`
        UPDATE visitors
        SET first_name = $1, last_name = $2, email = $3, phone = $4, company = $5,
            id_number = $6, id_type = $7, date_of_birth = $8, citizenship = $9,
            nationality = $10, ssn = $11, emergency_contact_name = $12,
            emergency_contact_phone = $13, updated_at = NOW()
            ${photoUrl ? ', photo_url = $14' : ''}
        WHERE id = $${photoUrl ? '15' : '14'}
      `, [
        visitorData.first_name,
        visitorData.last_name,
        visitorData.email,
        visitorData.phone,
        visitorData.company,
        visitorData.id_number,
        visitorData.id_type || 'drivers_license',
        visitorData.date_of_birth,
        visitorData.citizenship,
        visitorData.nationality,
        visitorData.ssn,
        visitorData.emergency_contact_name,
        visitorData.emergency_contact_phone,
        ...(photoUrl ? [photoUrl] : []),
        visitorId
      ]);
      
      // Update invitation pre-registration status
      await client.query(`
        UPDATE invitations
        SET pre_registration_status = 'completed', updated_at = NOW()
        WHERE id = $1
      `, [invitation.id]);
      
      // Also update the corresponding visit
      await client.query(`
        UPDATE visits
        SET pre_registration_status = 'completed', updated_at = NOW()
        WHERE id IN (
          SELECT v.id FROM visits v
          JOIN invitations i ON v.purpose = i.purpose 
            AND v.scheduled_date = i.scheduled_date
            AND v.host_id = i.host_id
            AND v.facility_id = i.facility_id
          WHERE i.id = $1
        )
      `, [invitation.id]);
    }

    res.json({
      message: 'Pre-registration completed successfully',
      visitor_id: visitorId
    });

    // Generate QR code now that pre-registration is complete
    try {
      const qrCodeData = await QrCodeService.generateQrCode(invitation.id, invitation.tenant_id, client);
      console.log('QR code generated after pre-registration completion:', { 
        invitationId: invitation.id, 
        qrCodeData 
      });
    } catch (error) {
      console.error('Failed to generate QR code after pre-registration:', error);
      // Continue even if QR code generation fails - don't break the pre-registration flow
    }
  });
}));

// API routes that require authentication
app.use('/api/auth', authRoutes);
app.use('/api/visitors', authenticateToken, visitorRoutes);
app.use('/api/visits', authenticateToken, visitRoutes);
app.use('/api/facilities', authenticateToken, facilityRoutes);
app.use('/api/security', authenticateToken, securityRoutes);
app.use('/api/audit', authenticateToken, auditRoutes);
app.use('/api/emergency', authenticateToken, emergencyRoutes);
app.use('/api/tenants', authenticateToken, tenantRoutes);
app.use('/api/invitations', authenticateToken, invitationRoutes);
app.use('/api/hosts', authenticateToken, hostsRoutes);
app.use('/api/notifications', authenticateToken, notificationRoutes);
app.use('/api/badges', authenticateToken, badgesRoutes);
app.use('/api/system', authenticateToken, systemRoutes);
app.use('/api/roles', authenticateToken, rolesRoutes);
app.use('/api/identity-providers', authenticateToken, identityProvidersRoutes);
app.use('/api/qr-code', authenticateToken, qrCodeRoutes);
app.use('/api/acs', authenticateToken, acsRoutes);
app.use('/api/civ-piv', authenticateToken, civPivRoutes);
app.use('/api/enhanced-badges', authenticateToken, enhancedBadgesRoutes);

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    code: 'NOT_FOUND',
    path: req.originalUrl
  });
});

// Global error handler
app.use(errorHandler);

// Initialize database and start server
const startServer = async () => {
  try {
    console.log('Starting SecureGov VMS Backend...');
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    
    await initializeDatabase();
    console.log('✅ Database initialized successfully');

    // Initialize cron jobs
    initializeCronJobs();
    console.log('✅ Cron jobs initialized successfully');

    // Initialize cron jobs
    initializeCronJobs();
    console.log('✅ Cron jobs initialized successfully');

    app.listen(PORT, () => {
      console.log(`🚀 SecureGov VMS Backend running on port ${PORT}`);
      console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔒 Security features enabled: ${process.env.MFA_ENABLED === 'true' ? 'MFA, ' : ''}Audit Logging, Rate Limiting`);
      console.log(`📋 Compliance: FICAM, FIPS 140, HIPAA, FERPA`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    if (error instanceof Error) {
      console.error('Stack trace:', error.stack);
    }
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully');
  process.exit(0);
});

startServer();

export default app;