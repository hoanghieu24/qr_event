import { Router } from 'express';
import { InvitesController } from './invites.controller';
import { authenticate } from '../../middlewares/auth.middleware';
import { requirePermission } from '../../middlewares/rbac.middleware';

const router = Router();

// Public: Attendees open and verify the signed invite link
router.get('/verify/:token', InvitesController.verifyToken);

// Staff with 'invite:create' creates and views their links
router.post('/', authenticate, requirePermission('invite:create'), InvitesController.createInviteLink);
router.get('/my-links', authenticate, requirePermission('invite:create'), InvitesController.getMyLinks);
router.get('/quota', authenticate, requirePermission('invite:create'), InvitesController.getQuota);

export default router;
