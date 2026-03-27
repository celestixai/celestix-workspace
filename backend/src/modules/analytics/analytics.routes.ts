import { Router, Request, Response } from 'express';
import { analyticsService } from './analytics.service';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import {
  createReportSchema,
  updateReportSchema,
  createDataSourceSchema,
  updateDataSourceSchema,
  queryDataSchema,
} from './analytics.schema';

const router = Router();

// ==========================================
// REPORT ROUTES
// ==========================================

// GET /api/v1/analytics/reports
router.get('/reports', authenticate, async (req: Request, res: Response) => {
  const reports = await analyticsService.getReports(req.user!.id);
  res.json({ success: true, data: reports });
});

// POST /api/v1/analytics/reports
router.post('/reports', authenticate, validate(createReportSchema), async (req: Request, res: Response) => {
  const report = await analyticsService.createReport(req.user!.id, req.body);
  res.status(201).json({ success: true, data: report });
});

// GET /api/v1/analytics/reports/:reportId
router.get('/reports/:reportId', authenticate, async (req: Request, res: Response) => {
  const report = await analyticsService.getReportById(req.user!.id, req.params.reportId);
  res.json({ success: true, data: report });
});

// PATCH /api/v1/analytics/reports/:reportId
router.patch('/reports/:reportId', authenticate, validate(updateReportSchema), async (req: Request, res: Response) => {
  const report = await analyticsService.updateReport(req.user!.id, req.params.reportId, req.body);
  res.json({ success: true, data: report });
});

// DELETE /api/v1/analytics/reports/:reportId
router.delete('/reports/:reportId', authenticate, async (req: Request, res: Response) => {
  await analyticsService.deleteReport(req.user!.id, req.params.reportId);
  res.json({ success: true, data: { message: 'Report deleted' } });
});

// ==========================================
// DATA SOURCE ROUTES
// ==========================================

// GET /api/v1/analytics/data-sources
router.get('/data-sources', authenticate, async (req: Request, res: Response) => {
  const dataSources = await analyticsService.getDataSources(req.user!.id);
  res.json({ success: true, data: dataSources });
});

// POST /api/v1/analytics/data-sources
router.post('/data-sources', authenticate, validate(createDataSourceSchema), async (req: Request, res: Response) => {
  const dataSource = await analyticsService.createDataSource(req.user!.id, req.body);
  res.status(201).json({ success: true, data: dataSource });
});

// GET /api/v1/analytics/data-sources/:id
router.get('/data-sources/:id', authenticate, async (req: Request, res: Response) => {
  const dataSource = await analyticsService.getDataSourceById(req.user!.id, req.params.id);
  res.json({ success: true, data: dataSource });
});

// PATCH /api/v1/analytics/data-sources/:id
router.patch('/data-sources/:id', authenticate, validate(updateDataSourceSchema), async (req: Request, res: Response) => {
  const dataSource = await analyticsService.updateDataSource(req.user!.id, req.params.id, req.body);
  res.json({ success: true, data: dataSource });
});

// DELETE /api/v1/analytics/data-sources/:id
router.delete('/data-sources/:id', authenticate, async (req: Request, res: Response) => {
  await analyticsService.deleteDataSource(req.user!.id, req.params.id);
  res.json({ success: true, data: { message: 'Data source deleted' } });
});

// POST /api/v1/analytics/data-sources/:id/refresh
router.post('/data-sources/:id/refresh', authenticate, async (req: Request, res: Response) => {
  const dataSource = await analyticsService.refreshData(req.user!.id, req.params.id);
  res.json({ success: true, data: dataSource });
});

// POST /api/v1/analytics/data-sources/:id/query
router.post('/data-sources/:id/query', authenticate, validate(queryDataSchema), async (req: Request, res: Response) => {
  const result = await analyticsService.queryData(req.user!.id, req.params.id, req.body);
  res.json({ success: true, data: result });
});

export default router;
