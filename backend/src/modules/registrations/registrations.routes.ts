import { Router } from 'express';
import { RegistrationsController } from './registrations.controller';
import { authenticate } from '../../middlewares/auth.middleware';
import { requirePermission } from '../../middlewares/rbac.middleware';
import { registerLimiter } from '../../middlewares/rateLimit.middleware';

const router = Router();

// Customer registers via invite link
router.post('/', registerLimiter, authenticate, RegistrationsController.register);

// Staff views registrations (own registrations or all based on permissions)
router.get('/', authenticate, requirePermission('registrations:view_own'), RegistrationsController.listRegistrations);

// Staff approves/rejects registrations
router.put('/:id/approve', authenticate, requirePermission('registrations:approve'), RegistrationsController.approve);
router.put('/:id/reject', authenticate, requirePermission('registrations:approve'), RegistrationsController.reject);

export default router;
