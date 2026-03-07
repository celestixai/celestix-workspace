import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { updateLayoutSchema } from './dashboard.schema';
import { DashboardService } from './dashboard.service';

const router = Router();
const service = new DashboardService();

// GET /api/v1/dashboard — get aggregated dashboard data
router.get('/', authenticate, async (req, res, next) => {
  try {
    const data = await service.getDashboardData(req.user!.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

// GET /api/v1/dashboard/layout — get user's widget layout
router.get('/layout', authenticate, async (req, res, next) => {
  try {
    const layout = await service.getLayout(req.user!.id);
    res.json({ success: true, data: layout });
  } catch (err) { next(err); }
});

// PUT /api/v1/dashboard/layout — update widget layout
router.put('/layout', authenticate, validate(updateLayoutSchema), async (req, res, next) => {
  try {
    const layout = await service.updateLayout(req.user!.id, req.body.widgets);
    res.json({ success: true, data: layout });
  } catch (err) { next(err); }
});

export default router;
