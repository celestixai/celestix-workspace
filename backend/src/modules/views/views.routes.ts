import { Router, Request, Response } from 'express';
import multer from 'multer';
import { viewsService } from './views.service';
import { taskQueryService } from './task-query.service';
import { exportService } from './export.service';
import { importService } from './import.service';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import {
  createViewSchema,
  updateViewSchema,
  duplicateViewSchema,
  updatePositionSchema,
  taskQuerySchema,
} from './views.validation';

const router = Router();

// Multer config for CSV import (memory storage)
const csvUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  },
});

// ==========================================
// Task Query Engine
// ==========================================

// POST /api/v1/views/query — execute task query
router.post('/query', authenticate, validate(taskQuerySchema), async (req: Request, res: Response) => {
  const result = await taskQueryService.executeQuery(req.body);
  res.json({ success: true, data: result });
});

// ==========================================
// Workload Data
// ==========================================

// GET /api/v1/views/workload?workspaceId=&startDate=&endDate=&assigneeIds=
router.get('/workload', authenticate, async (req: Request, res: Response) => {
  const { workspaceId, startDate, endDate, assigneeIds } = req.query as Record<string, string>;
  if (!workspaceId || !startDate || !endDate) {
    res.status(400).json({
      success: false,
      error: { message: 'workspaceId, startDate, and endDate are required', code: 'INVALID_INPUT' },
    });
    return;
  }
  const parsedAssigneeIds = assigneeIds ? assigneeIds.split(',') : undefined;
  const result = await taskQueryService.getWorkloadData(workspaceId, startDate, endDate, parsedAssigneeIds);
  res.json({ success: true, data: result });
});

// ==========================================
// Activity Feed
// ==========================================

// GET /api/v1/views/activity?locationType=&locationId=&limit=50&cursor=
router.get('/activity', authenticate, async (req: Request, res: Response) => {
  const { locationType, locationId, limit, cursor } = req.query as Record<string, string>;
  if (!locationType || !locationId) {
    res.status(400).json({
      success: false,
      error: { message: 'locationType and locationId are required', code: 'INVALID_INPUT' },
    });
    return;
  }
  const parsedLimit = limit ? parseInt(limit, 10) : 50;
  const result = await taskQueryService.getActivityFeed(locationType, locationId, parsedLimit, cursor || undefined);
  res.json({ success: true, data: result });
});

// ==========================================
// Export
// ==========================================

// GET /api/v1/views/export?locationType=&locationId=&format=csv|json&viewId=
router.get('/export', authenticate, async (req: Request, res: Response) => {
  const { locationType, locationId, format, viewId, workspaceId } = req.query as Record<string, string>;

  if (!format || !['csv', 'json'].includes(format)) {
    res.status(400).json({
      success: false,
      error: { message: 'format must be csv or json', code: 'INVALID_INPUT' },
    });
    return;
  }

  // Build query params — either from saved view or from query params
  let queryParams: any = {
    locationType,
    locationId,
    workspaceId,
    showClosedTasks: true,
  };

  if (viewId) {
    try {
      const view = await viewsService.getView(viewId);
      queryParams = {
        locationType: view.locationType,
        locationId: view.locationId || undefined,
        workspaceId: (view as any).workspaceId || workspaceId,
        filters: view.filters,
        sorts: view.sorts as any,
        groupBy: view.groupBy || undefined,
        showSubtasks: view.showSubtasks,
        showClosedTasks: true,
      };
    } catch {
      // If view not found, fall through to query params
    }
  }

  if (format === 'csv') {
    const csv = await exportService.exportCSV(queryParams);
    const filename = `tasks-export-${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } else {
    const json = await exportService.exportJSON(queryParams);
    const filename = `tasks-export-${new Date().toISOString().slice(0, 10)}.json`;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(json);
  }
});

// GET /api/v1/views/import/template — download CSV template
router.get('/import/template', authenticate, (_req: Request, res: Response) => {
  const csv = importService.generateTemplate();
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="import-template.csv"');
  res.send(csv);
});

// ==========================================
// Import
// ==========================================

// POST /api/v1/views/import/preview — upload CSV, get preview
router.post('/import/preview', authenticate, csvUpload.single('file'), async (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ success: false, error: { message: 'No CSV file uploaded', code: 'INVALID_INPUT' } });
    return;
  }

  const parsed = importService.parseCSV(req.file.buffer);
  if (parsed.columns.length === 0) {
    res.status(400).json({ success: false, error: { message: 'CSV file is empty or invalid', code: 'INVALID_INPUT' } });
    return;
  }

  const preview = importService.previewImport(parsed);
  res.json({ success: true, data: preview });
});

// POST /api/v1/views/import/execute — execute import with mapping
router.post('/import/execute', authenticate, async (req: Request, res: Response) => {
  const { listId, mapping, data } = req.body;

  if (!listId || !mapping || !data || !Array.isArray(data)) {
    res.status(400).json({
      success: false,
      error: { message: 'listId, mapping, and data (array) are required', code: 'INVALID_INPUT' },
    });
    return;
  }

  if (!mapping.title) {
    res.status(400).json({
      success: false,
      error: { message: 'mapping.title is required', code: 'INVALID_INPUT' },
    });
    return;
  }

  const result = await importService.executeImport(listId, req.user!.id, data, mapping);
  res.json({ success: true, data: result });
});

// ==========================================
// View CRUD
// ==========================================

// GET /api/v1/views/location/:locationType/:locationId — list views at location
router.get('/location/:locationType/:locationId', authenticate, async (req: Request, res: Response) => {
  const views = await viewsService.getViewsAtLocation(
    req.params.locationType,
    req.params.locationId,
    req.user!.id,
  );
  res.json({ success: true, data: views });
});

// GET /api/v1/views/workspace/:workspaceId/all — all user's views in workspace
router.get('/workspace/:workspaceId/all', authenticate, async (req: Request, res: Response) => {
  const views = await viewsService.getAllUserViews(req.params.workspaceId, req.user!.id);
  res.json({ success: true, data: views });
});

// POST /api/v1/views — create view
router.post('/', authenticate, validate(createViewSchema), async (req: Request, res: Response) => {
  const view = await viewsService.createView(req.user!.id, req.body);
  res.status(201).json({ success: true, data: view });
});

// GET /api/v1/views/:viewId — get view
router.get('/:viewId', authenticate, async (req: Request, res: Response) => {
  const view = await viewsService.getView(req.params.viewId);
  res.json({ success: true, data: view });
});

// PATCH /api/v1/views/:viewId — update view
router.patch('/:viewId', authenticate, validate(updateViewSchema), async (req: Request, res: Response) => {
  const view = await viewsService.updateView(req.params.viewId, req.user!.id, req.body);
  res.json({ success: true, data: view });
});

// DELETE /api/v1/views/:viewId — delete view
router.delete('/:viewId', authenticate, async (req: Request, res: Response) => {
  await viewsService.deleteView(req.params.viewId, req.user!.id);
  res.json({ success: true, data: { message: 'View deleted' } });
});

// PATCH /api/v1/views/:viewId/position — reorder
router.patch('/:viewId/position', authenticate, validate(updatePositionSchema), async (req: Request, res: Response) => {
  const view = await viewsService.updatePosition(req.params.viewId, req.body.position);
  res.json({ success: true, data: view });
});

// POST /api/v1/views/:viewId/duplicate — duplicate view
router.post('/:viewId/duplicate', authenticate, validate(duplicateViewSchema), async (req: Request, res: Response) => {
  const view = await viewsService.duplicateView(req.params.viewId, req.user!.id, req.body.name);
  res.status(201).json({ success: true, data: view });
});

// POST /api/v1/views/:viewId/pin — toggle pin
router.post('/:viewId/pin', authenticate, async (req: Request, res: Response) => {
  const view = await viewsService.togglePin(req.params.viewId);
  res.json({ success: true, data: view });
});

export default router;
