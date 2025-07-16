import express from 'express';
import { body, param, query as expressQuery, validationResult } from 'express-validator';
import { asyncHandler, createError, AppError } from '../middleware/errorHandler';
import { AuthenticatedRequest, requireAdmin } from '../middleware/auth';
import { IdentityProviderService } from '../services/identityProviderService';

const router = express.Router();

// All identity provider routes require admin role
router.use(requireAdmin());

// Helper to determine target tenant ID based on user role
const getTargetTenantId = (req: AuthenticatedRequest, queryTenantId?: string): string => {
  if (req.user!.role === 'super_admin') {
    return queryTenantId || req.user!.tenant_id;
  } else if (req.user!.role === 'admin') {
    if (queryTenantId && queryTenantId !== req.user!.tenant_id) {
      throw createError('Access denied: Admins can only manage identity providers for their own tenant.', 403, 'ACCESS_DENIED');
    }
    return req.user!.tenant_id;
  }
  // This case should ideally be caught by requireAdmin(), but as a fallback
  throw createError('Access denied: Insufficient permissions.', 403, 'ACCESS_DENIED');
};

// Get all identity providers
router.get('/', [
  expressQuery('tenant_id').optional().isUUID().withMessage('Valid tenant ID is required if provided')
], asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array());
  }

  const targetTenantId = getTargetTenantId(req, req.query.tenant_id as string);
  const providers = await IdentityProviderService.getByTenantId(req.user!.tenant_id);
  
  res.json({
    identity_providers: providers
  });
}));

// Get identity provider by ID
router.get('/:id', [
  param('id').isUUID().withMessage('Valid provider ID is required')
], asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array());
  }

  const { id } = req.params;
  
  // Admins can only view providers within their own tenant
  const queryTenantId = req.user!.role === 'admin' ? req.user!.tenant_id : undefined;

  const providers = await IdentityProviderService.getByTenantId(queryTenantId || req.user!.tenant_id); // Fetch all for super_admin, or just own for admin
  const provider = providers.find(p => p.id === id);
  
  if (!provider) {
    throw createError('Identity provider not found', 404, 'PROVIDER_NOT_FOUND');
  }

  res.json({
    identity_provider: provider // This will be filtered by tenant_id in the service for non-super_admin
  });
}));

// Create new identity provider
router.post('/', [
  body('tenant_id').optional().isUUID().withMessage('Valid tenant ID is required if provided'),
  body('provider_type').isIn(['azure_ad', 'aws_federation', 'okta', 'auth0', 'traditional']).withMessage('Invalid provider type'),
  body('config').isObject().withMessage('Configuration must be an object'),
  body('is_active').optional().isBoolean().withMessage('is_active must be a boolean')
], asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array());
  }
  
  const targetTenantId = getTargetTenantId(req, req.body.tenant_id);
  const provider = await IdentityProviderService.create(targetTenantId, req.body);

  res.status(201).json({
    message: 'Identity provider created successfully',
    identity_provider: provider
  });
}));

// Update identity provider
router.put('/:id', [
  param('id').isUUID().withMessage('Valid provider ID is required'),
  body('tenant_id').optional().isUUID().withMessage('Valid tenant ID is required if provided'),
  body('provider_type').optional().isIn(['azure_ad', 'aws_federation', 'okta', 'auth0', 'traditional']).withMessage('Invalid provider type'),
  body('config').optional().isObject().withMessage('Configuration must be an object'),
  body('is_active').optional().isBoolean().withMessage('is_active must be a boolean')
], asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array());
  }

  const { id } = req.params;
  const { tenant_id: requestTenantId } = req.body; // Tenant ID from request body

  // Retrieve the provider to ensure it exists and get its actual tenant_id
  const existingProvider = await IdentityProviderService.getById(id);
  if (!existingProvider) {
    throw createError('Identity provider not found', 404, 'PROVIDER_NOT_FOUND');
  }

  // Validate access based on role
  if (req.user!.role === 'admin' && existingProvider.tenant_id !== req.user!.tenant_id) {
    throw createError('Access denied: Admins can only manage identity providers for their own tenant.', 403, 'ACCESS_DENIED');
  } else if (req.user!.role === 'super_admin' && requestTenantId && existingProvider.tenant_id !== requestTenantId) {
    throw createError('Mismatched tenant ID: Provider does not belong to the specified tenant.', 400, 'TENANT_ID_MISMATCH');
  }

  const provider = await IdentityProviderService.update(req.user!.tenant_id, id, req.body);

  res.json({
    message: 'Identity provider updated successfully',
    identity_provider: provider
  });
}));

// Delete identity provider
router.delete('/:id', [
  param('id').isUUID().withMessage('Valid provider ID is required')
], asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array());
  }

  const { id } = req.params;

  // Retrieve the provider to ensure it exists and get its actual tenant_id
  const existingProvider = await IdentityProviderService.getById(id);
  if (!existingProvider) {
    throw createError('Identity provider not found', 404, 'PROVIDER_NOT_FOUND');
  }

  // Validate access based on role
  if (req.user!.role === 'admin' && existingProvider.tenant_id !== req.user!.tenant_id) {
    throw createError('Access denied: Admins can only manage identity providers for their own tenant.', 403, 'ACCESS_DENIED');
  }

  await IdentityProviderService.delete(existingProvider.tenant_id, id);

  res.json({
    message: 'Identity provider deleted successfully'
  });
}));

// Deactivate identity provider
router.post('/:id/deactivate', [
  param('id').isUUID().withMessage('Valid provider ID is required')
], asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array());
  }

  const { id } = req.params;

  // Retrieve the provider to ensure it exists and get its actual tenant_id
  const existingProvider = await IdentityProviderService.getById(id);
  if (!existingProvider) {
    throw createError('Identity provider not found', 404, 'PROVIDER_NOT_FOUND');
  }

  // Validate access based on role
  if (req.user!.role === 'admin' && existingProvider.tenant_id !== req.user!.tenant_id) {
    throw createError('Access denied: Admins can only manage identity providers for their own tenant.', 403, 'ACCESS_DENIED');
  }

  const provider = await IdentityProviderService.deactivate(existingProvider.tenant_id, id);

  res.json({
    message: 'Identity provider deactivated successfully',
    identity_provider: provider
  });
}));

export default router;