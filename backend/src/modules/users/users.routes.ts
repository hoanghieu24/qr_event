import { Router } from 'express';
import { UsersController } from './users.controller';
import { authenticate } from '../../middlewares/auth.middleware';
import { requireAdmin, requirePermission } from '../../middlewares/rbac.middleware';

const router = Router();

// Everyone authenticated can list available permissions
router.get('/permissions', authenticate, UsersController.listPermissions);

// Admin-only endpoints for staff & dynamic permission management
router.get('/staff', authenticate, requirePermission('staff:manage'), UsersController.listStaff);
router.post('/staff', authenticate, requirePermission('staff:manage'), UsersController.createStaff);
router.put('/staff/:id/permissions', authenticate, requirePermission('staff:manage'), UsersController.updatePermissions);
router.put('/staff/:id/status', authenticate, requirePermission('staff:manage'), UsersController.updateStatus);

// Master Admin: All users management across system
router.get('/', authenticate, requireAdmin, UsersController.listAllUsers);
router.post('/', authenticate, requireAdmin, UsersController.createUser);
router.put('/:id/status', authenticate, requireAdmin, UsersController.updateUserStatus);
router.put('/:id/role', authenticate, requireAdmin, UsersController.updateRole);
router.put('/:id/reset-password', authenticate, requireAdmin, UsersController.resetPassword);
router.get('/:id/dependencies', authenticate, requireAdmin, UsersController.getUserDependencies);
router.delete('/:id', authenticate, requireAdmin, UsersController.deleteUser);

export default router;
