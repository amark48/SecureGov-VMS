import express from 'express';
import { body, param, query as expressQuery, validationResult } from 'express-validator';
import { query, transaction } from '../config/database';
import { asyncHandler, createError } from '../middleware/errorHandler';
import { AuthenticatedRequest, requireAdmin, requireSecurity } from '../middleware/auth';
import { AcsIntegrationService } from '../services/acsIntegrationService';

const router = express.Router();

// Get ACS configurations for tenant
router.get('/configurations', requireAdmin(), asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const configurations = await AcsIntegrationService.getAcsConfigurations(req.user!.tenant_id);
  
  res.json({
    configurations
  });
}));

// Get specific ACS configuration
router.get('/configurations/:id', requireAdmin(), [
  param('id').isUUID().withMessage('Valid configuration ID is required')
], asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array());
  }

  const { id } = req.params;
  const configuration = await AcsIntegrationService.getAcsConfiguration(req.user!.tenant_id, id);
  
  if (!configuration) {
    throw createError('ACS configuration not found', 404, 'ACS_CONFIG_NOT_FOUND');
  }

  res.json({
    configuration
  });
}));

// Create ACS configuration
router.post('/configurations', requireAdmin(), [
  body('name').isLength({ min: 1, max: 255 }).trim().withMessage('Name is required'),
  body('acs_type').isIn(['lenel', 's2_security', 'custom', 'ccure9000']).withMessage('Valid ACS type is required'),
  body('api_endpoint').optional().isURL().withMessage('Valid API endpoint URL is required'),
  body('credentials').isObject().withMessage('Credentials object is required'),
  body('configuration').optional().isObject().withMessage('Configuration must be an object')
], asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array());
  }

  const { name, acs_type, api_endpoint, credentials, configuration } = req.body;

  // Validate Ccure 9000 specific credentials
  if (acs_type === 'ccure9000') {
    const requiredFields = ['base_url', 'client_id', 'client_name', 'user_name', 'password'];
    const missingFields = requiredFields.filter(field => !credentials[field]);
    
    if (missingFields.length > 0) {
      throw createError(
        `Missing required Ccure 9000 credentials: ${missingFields.join(', ')}`,
        400,
        'MISSING_CCURE9000_CREDENTIALS'
      );
    }

    // Set default values for optional fields
    if (!credentials.version) {
      credentials.version = '3.0';
    }
    if (!credentials.personnel_type_name) {
      credentials.personnel_type_name = 'Visitor';
    }
  }

  // Check if configuration with same name already exists
  const existingConfig = await query(`
    SELECT id FROM acs_configurations
    WHERE tenant_id = $1 AND name = $2
  `, [req.user!.tenant_id, name]);

  if (existingConfig.rows.length > 0) {
    throw createError('ACS configuration with this name already exists', 409, 'ACS_CONFIG_EXISTS');
  }

  const result = await query(`
    INSERT INTO acs_configurations (tenant_id, name, acs_type, api_endpoint, credentials, configuration)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *
  `, [
    req.user!.tenant_id,
    name,
    acs_type,
    api_endpoint,
    JSON.stringify(credentials),
    JSON.stringify(configuration || {})
  ]);

  res.status(201).json({
    message: 'ACS configuration created successfully',
    configuration: result.rows[0]
  });
}));

// Update ACS configuration
router.put('/configurations/:id', requireAdmin(), [
  param('id').isUUID().withMessage('Valid configuration ID is required'),
  body('name').optional().isLength({ min: 1, max: 255 }).trim(),
  body('acs_type').optional().isIn(['lenel', 's2_security', 'custom', 'ccure9000']),
  body('api_endpoint').optional().isURL(),
  body('credentials').optional().isObject(),
  body('configuration').optional().isObject(),
  body('is_active').optional().isBoolean()
], asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array());
  }

  const { id } = req.params;
  const updates = req.body;

  // Validate Ccure 9000 specific credentials if updating
  if (updates.acs_type === 'ccure9000' && updates.credentials) {
    const requiredFields = ['base_url', 'client_id', 'client_name', 'user_name', 'password'];
    const missingFields = requiredFields.filter(field => !updates.credentials[field]);
    
    if (missingFields.length > 0) {
      throw createError(
        `Missing required Ccure 9000 credentials: ${missingFields.join(', ')}`,
        400,
        'MISSING_CCURE9000_CREDENTIALS'
      );
    }
  }

  // Build dynamic update query
  const updateFields = Object.keys(updates).filter(key => updates[key] !== undefined);
  if (updateFields.length === 0) {
    throw createError('No updates provided', 400, 'NO_UPDATES');
  }

  const setClause = updateFields.map((field, index) => {
    if (field === 'credentials' || field === 'configuration') {
      return `${field} = $${index + 3}::jsonb`;
    }
    return `${field} = $${index + 3}`;
  }).join(', ');

  const values = [
    id,
    req.user!.tenant_id,
    ...updateFields.map(field => {
      if (field === 'credentials' || field === 'configuration') {
        return JSON.stringify(updates[field]);
      }
      return updates[field];
    })
  ];

  const result = await query(`
    UPDATE acs_configurations
    SET ${setClause}, updated_at = NOW()
    WHERE id = $1 AND tenant_id = $2
    RETURNING *
  `, values);

  if (result.rows.length === 0) {
    throw createError('ACS configuration not found', 404, 'ACS_CONFIG_NOT_FOUND');
  }

  res.json({
    message: 'ACS configuration updated successfully',
    configuration: result.rows[0]
  });
}));

// Delete ACS configuration
router.delete('/configurations/:id', requireAdmin(), [
  param('id').isUUID().withMessage('Valid configuration ID is required')
], asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array());
  }

  const { id } = req.params;

  const result = await query(`
    DELETE FROM acs_configurations
    WHERE id = $1 AND tenant_id = $2
    RETURNING id
  `, [id, req.user!.tenant_id]);

  if (result.rows.length === 0) {
    throw createError('ACS configuration not found', 404, 'ACS_CONFIG_NOT_FOUND');
  }

  res.json({
    message: 'ACS configuration deleted successfully'
  });
}));

// Test ACS connection
router.post('/configurations/:id/test', requireAdmin(), [
  param('id').isUUID().withMessage('Valid configuration ID is required')
], asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array());
  }

  const { id } = req.params;
  const configuration = await AcsIntegrationService.getAcsConfiguration(req.user!.tenant_id, id);
  
  if (!configuration) {
    throw createError('ACS configuration not found', 404, 'ACS_CONFIG_NOT_FOUND');
  }

  const testResult = await AcsIntegrationService.testConnection(configuration);

  res.json({
    message: 'Connection test completed',
    result: testResult
  });
}));

// Provision access for a visit
router.post('/provision-access/:visitId', requireSecurity(), [
  param('visitId').isUUID().withMessage('Valid visit ID is required'),
  body('acs_configuration_id').optional().isUUID().withMessage('Valid ACS configuration ID is required'),
  body('access_level').optional().isString().withMessage('Access level must be a string')
], asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array());
  }

  const { visitId } = req.params;
  const { acs_configuration_id, access_level = 'visitor' } = req.body;

  await transaction(async (client) => {
    // Get visit and visitor details
    const visitResult = await client.query(`
      SELECT v.*, vis.first_name, vis.last_name, vis.email, vis.company, vis.civ_piv_card_info,
             f.id as facility_id
      FROM visits v
      JOIN visitors vis ON v.visitor_id = vis.id
      JOIN facilities f ON v.facility_id = f.id
      WHERE v.id = $1 AND v.tenant_id = $2
    `, [visitId, req.user!.tenant_id]);

    if (visitResult.rows.length === 0) {
      throw createError('Visit not found', 404, 'VISIT_NOT_FOUND');
    }

    const visit = visitResult.rows[0];

    // Get ACS configurations
    let acsConfigurations;
    if (acs_configuration_id) {
      const config = await AcsIntegrationService.getAcsConfiguration(req.user!.tenant_id, acs_configuration_id);
      if (!config) {
        throw createError('ACS configuration not found', 404, 'ACS_CONFIG_NOT_FOUND');
      }
      acsConfigurations = [config];
    } else {
      acsConfigurations = await AcsIntegrationService.getAcsConfigurations(req.user!.tenant_id);
    }

    if (acsConfigurations.length === 0) {
      throw createError('No active ACS configurations found', 404, 'NO_ACS_CONFIG');
    }

    // Update visit status to pending
    await client.query(`
      UPDATE visits
      SET acs_provisioning_status = 'pending', updated_at = NOW()
      WHERE id = $1
    `, [visitId]);

    const visitorData = {
      id: visit.visitor_id,
      first_name: visit.first_name,
      last_name: visit.last_name,
      email: visit.email,
      company: visit.company,
      civ_piv_card_info: visit.civ_piv_card_info
    };

    // Attempt to provision access in each ACS
    const results = [];
    let overallSuccess = false;

    for (const acsConfig of acsConfigurations) {
      try {
        const result = await AcsIntegrationService.provisionAccess(
          visitorData,
          acsConfig,
          visit.facility_id,
          access_level
        );
        
        results.push({
          acs_name: acsConfig.name,
          acs_type: acsConfig.acs_type,
          ...result
        });

        if (result.success) {
          overallSuccess = true;
        }
      } catch (error: any) {
        results.push({
          acs_name: acsConfig.name,
          acs_type: acsConfig.acs_type,
          success: false,
          message: error.message,
          error_code: 'PROVISIONING_ERROR'
        });
      }
    }

    // Update visit status based on results
    const finalStatus = overallSuccess ? 'provisioned' : 'failed';
    await client.query(`
      UPDATE visits
      SET acs_provisioning_status = $1, updated_at = NOW()
      WHERE id = $2
    `, [finalStatus, visitId]);

    // Log the provisioning attempt
    await client.query(`
      INSERT INTO audit_logs (
        user_id, tenant_id, action, table_name, record_id, new_values, compliance_flags
      ) VALUES ($1, $2, 'update', 'visits', $3, $4, $5)
    `, [
      req.user!.id,
      req.user!.tenant_id,
      visitId,
      JSON.stringify({
        action: 'acs_provisioning',
        status: finalStatus,
        results: results,
        access_level: access_level
      }),
      ['SECURITY', 'ACS_PROVISIONING', 'FICAM']
    ]);

    res.json({
      message: 'Access provisioning completed',
      overall_success: overallSuccess,
      status: finalStatus,
      results: results
    });
  });
}));

export default router;