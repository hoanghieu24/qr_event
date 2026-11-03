import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import { requireAdmin, requireTenantAdmin } from '../../middlewares/rbac.middleware';
import { SubscriptionsController } from './subscriptions.controller';
import { Request, Response, NextFunction } from 'express';

const router = Router();

function requirePlanViewer(req: Request, res: Response, next: NextFunction): void {
  if (req.user?.type === 'ADMIN' || req.user?.type === 'TENANT_ADMIN') return next();
  res.status(403).json({ success: false, message: 'Bạn không có quyền xem các gói dịch vụ.' });
}

router.get('/plans', authenticate, requirePlanViewer, SubscriptionsController.listPlans);
router.post('/plans', authenticate, requireAdmin, SubscriptionsController.savePlan);
router.patch('/plans/:id', authenticate, requireAdmin, (req, _res, next) => {
  req.body.id = Number(req.params.id);
  next();
}, SubscriptionsController.savePlan);
router.get('/requests', authenticate, requireAdmin, SubscriptionsController.requests);
router.patch('/requests/:id', authenticate, requireAdmin, SubscriptionsController.reviewRequest);
router.post('/portal/requests', authenticate, requireTenantAdmin, SubscriptionsController.createRequest);

export default router;
