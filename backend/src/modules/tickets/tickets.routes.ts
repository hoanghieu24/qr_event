import { Router } from 'express';
import { TicketsController } from './tickets.controller';
import { authenticate } from '../../middlewares/auth.middleware';

const router = Router();

// Customer views their own ticket
router.get('/my-ticket', authenticate, TicketsController.getMyTicket);
router.get('/my-tickets', authenticate, TicketsController.getMyTickets);

// Get QR image by code
router.get('/qr/:code', TicketsController.getQrImage);

export default router;
