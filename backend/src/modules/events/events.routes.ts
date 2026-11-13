import { Router } from 'express';
import { EventsController } from './events.controller';
import { authenticate, authenticateOptional } from '../../middlewares/auth.middleware';
import { requireEventCapability, requirePermission } from '../../middlewares/rbac.middleware';

const router = Router();

// Public / Authenticated event list and details
router.get('/', authenticateOptional, EventsController.listEvents);
router.get('/:id', EventsController.getEventById);

// Protected: Create & Update
router.post('/', authenticate, requirePermission('events:create'), EventsController.createEvent);
router.put('/:id', authenticate, requirePermission('events:manage'), EventsController.updateEvent);
router.get('/:id/stats', authenticate, requireEventCapability('can_view_report'), EventsController.getStats);
router.get('/:id/report', authenticate, requireEventCapability('can_view_report'), EventsController.getReport);
router.get('/:id/staff-quotas', authenticate, requirePermission('events:manage'), EventsController.getStaffQuotas);
router.post('/:id/staff-quotas', authenticate, requirePermission('events:manage'), EventsController.setStaffQuota);
router.get('/:id/invites', authenticate, requirePermission('events:manage'), EventsController.getEventInvites);
router.post('/:id/invites', authenticate, requirePermission('events:manage'), EventsController.createEventInvite);
router.patch('/:id/toggle-status', authenticate, requirePermission('events:manage'), EventsController.toggleEventStatus);
router.patch('/:id/confirm-payment', authenticate, requirePermission('events:manage'), EventsController.confirmPayment);
router.delete('/:id', authenticate, requirePermission('events:manage'), EventsController.deleteEvent);

export default router;
