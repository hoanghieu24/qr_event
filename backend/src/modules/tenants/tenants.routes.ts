import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import { requireAdmin, requireTenantAdmin } from '../../middlewares/rbac.middleware';
import { TenantsController } from './tenants.controller';

const router = Router();

router.post('/register', TenantsController.register);
router.get('/', authenticate, requireAdmin, TenantsController.list);
router.get('/all-events', authenticate, requireAdmin, TenantsController.allTenantEvents);
router.get('/:id/users', authenticate, requireAdmin, TenantsController.getTenantUsers);
router.post('/:id/users', authenticate, requireAdmin, TenantsController.addTenantMember);
router.delete('/:id/users/:userId', authenticate, requireAdmin, TenantsController.removeTenantMember);
router.post('/', authenticate, requireAdmin, TenantsController.create);
router.patch('/:id/status', authenticate, requireAdmin, TenantsController.setStatus);

router.get('/portal/usage', authenticate, requireTenantAdmin, TenantsController.usage);
router.get('/portal/payment-info', authenticate, requireTenantAdmin, TenantsController.paymentInfo);
router.get('/portal/events', authenticate, requireTenantAdmin, TenantsController.events);
router.post('/portal/events', authenticate, requireTenantAdmin, TenantsController.createEvent);
router.put('/portal/events/:eventId', authenticate, requireTenantAdmin, TenantsController.updateEvent);
router.post('/portal/events/:eventId/close', authenticate, requireTenantAdmin, TenantsController.closeEvent);
router.post('/portal/events/:eventId/reopen', authenticate, requireTenantAdmin, TenantsController.reopenEvent);
router.get('/portal/events/:eventId/attendees', authenticate, requireTenantAdmin, TenantsController.attendees);
router.get('/portal/team', authenticate, requireTenantAdmin, TenantsController.listTeam);
router.get('/portal/search-users', authenticate, requireTenantAdmin, TenantsController.searchUsers);
router.post('/portal/team', authenticate, requireTenantAdmin, TenantsController.createTeamMember);
router.get('/portal/events/:eventId/team', authenticate, requireTenantAdmin, TenantsController.eventTeam);
router.put('/portal/events/:eventId/team/:staffId', authenticate, requireTenantAdmin, TenantsController.assignTeamMember);
router.delete('/portal/events/:eventId/team/:staffId', authenticate, requireTenantAdmin, TenantsController.removeTeamMember);
router.get('/portal/events/:eventId/invites', authenticate, requireTenantAdmin, TenantsController.eventInvites);
router.post('/portal/events/:eventId/invites', authenticate, requireTenantAdmin, TenantsController.createEventInvite);

export default router;
