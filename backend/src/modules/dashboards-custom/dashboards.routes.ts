import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import {
  createDashboardSchema,
  updateDashboardSchema,
  addCardSchema,
  updateCardSchema,
  updateLayoutSchema,
  shareDashboardSchema,
} from './dashboards.validation';
import { DashboardsCustomService } from './dashboards.service';
import type { SharePermission } from '@prisma/client';

const router = Router();
const service = new DashboardsCustomService();

// ==========================================
// DASHBOARD CRUD
// ==========================================

// GET /workspace/:workspaceId — list dashboards
router.get('/workspace/:workspaceId', authenticate, async (req, res, next) => {
  try {
    const data = await service.getDashboards(req.params.workspaceId, req.user!.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

// POST /workspace/:workspaceId — create dashboard
router.post('/workspace/:workspaceId', authenticate, validate(createDashboardSchema), async (req, res, next) => {
  try {
    const data = await service.createDashboard(req.params.workspaceId, req.user!.id, req.body);
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
});

// GET /:dashboardId — get dashboard with cards
router.get('/:dashboardId', authenticate, async (req, res, next) => {
  try {
    const data = await service.getDashboard(req.params.dashboardId);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

// PATCH /:dashboardId — update dashboard
router.patch('/:dashboardId', authenticate, validate(updateDashboardSchema), async (req, res, next) => {
  try {
    const data = await service.updateDashboard(req.params.dashboardId, req.body);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

// DELETE /:dashboardId — delete dashboard
router.delete('/:dashboardId', authenticate, async (req, res, next) => {
  try {
    const data = await service.deleteDashboard(req.params.dashboardId);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

// POST /:dashboardId/duplicate — duplicate dashboard
router.post('/:dashboardId/duplicate', authenticate, async (req, res, next) => {
  try {
    const data = await service.duplicateDashboard(req.params.dashboardId, req.user!.id);
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
});

// ==========================================
// CARDS
// ==========================================

// POST /:dashboardId/cards — add card
router.post('/:dashboardId/cards', authenticate, validate(addCardSchema), async (req, res, next) => {
  try {
    const data = await service.addCard(req.params.dashboardId, req.body);
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
});

// PATCH /cards/:cardId — update card
router.patch('/cards/:cardId', authenticate, validate(updateCardSchema), async (req, res, next) => {
  try {
    const data = await service.updateCard(req.params.cardId, req.body);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

// DELETE /cards/:cardId — delete card
router.delete('/cards/:cardId', authenticate, async (req, res, next) => {
  try {
    const data = await service.deleteCard(req.params.cardId);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

// PATCH /:dashboardId/layout — batch update card positions
router.patch('/:dashboardId/layout', authenticate, validate(updateLayoutSchema), async (req, res, next) => {
  try {
    const data = await service.updateLayout(req.params.dashboardId, req.body);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

// ==========================================
// CARD DATA
// ==========================================

// GET /cards/:cardId/data — get computed card data
router.get('/cards/:cardId/data', authenticate, async (req, res, next) => {
  try {
    const data = await service.getCardData(req.params.cardId);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

// ==========================================
// SHARING
// ==========================================

// POST /:dashboardId/share — share dashboard
router.post('/:dashboardId/share', authenticate, validate(shareDashboardSchema), async (req, res, next) => {
  try {
    const data = await service.shareDashboard(
      req.params.dashboardId,
      req.body.userId,
      (req.body.permission as SharePermission) ?? 'VIEW'
    );
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
});

// DELETE /:dashboardId/share/:shareId — remove share
router.delete('/:dashboardId/share/:shareId', authenticate, async (req, res, next) => {
  try {
    const data = await service.removeDashboardShare(req.params.shareId);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

export default router;
