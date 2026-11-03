import { Router } from 'express';
import { CheckinController } from './checkin.controller';
import { authenticate } from '../../middlewares/auth.middleware';
import { requirePermission } from '../../middlewares/rbac.middleware';
import { scanLimiter } from '../../middlewares/rateLimit.middleware';

const router = Router();

// Staff scans QR code (with Geofencing support)
router.post('/scan', authenticate, requirePermission('tickets:scan'), scanLimiter, CheckinController.scan);

// Pre-fetch cache of event tickets for offline scanning
router.get('/offline-cache', authenticate, requirePermission('tickets:scan'), CheckinController.getOfflineCache);

// Batch sync scans performed while offline
router.post('/sync-batch', authenticate, requirePermission('tickets:scan'), CheckinController.syncBatch);

// Staff views recent scan logs for the active event
router.get('/logs/:eventId', authenticate, requirePermission('tickets:scan'), CheckinController.getRecentLogs);

export default router;
