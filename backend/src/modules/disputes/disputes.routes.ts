import { Router } from 'express';
import { DisputesController } from './disputes.controller';
import { authenticate } from '../../middlewares/auth.middleware';

const router = Router();

// Staff/TenantAdmin/Admin with scan capability can record a dispute upon finding an ALREADY_USED QR code
router.post('/', authenticate, DisputesController.createDispute);

// Authorized users (Admin, Tenant Admin, or Staff with dispute/approval permission) can view and resolve disputes
router.get('/', authenticate, DisputesController.listDisputes);
router.put('/:id/resolve', authenticate, DisputesController.resolveDispute);

export default router;
