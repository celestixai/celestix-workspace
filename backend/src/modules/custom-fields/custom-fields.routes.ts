import { Router, Request, Response } from 'express';
import { HierarchyLevel } from '@prisma/client';
import { customFieldsService } from './custom-fields.service';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import {
  createFieldSchema,
  updateFieldSchema,
  addLocationSchema,
  setValueSchema,
  bulkSetValuesSchema,
  filterTasksSchema,
} from './custom-fields.validation';

const router = Router();

// ==========================================
// Field Definitions
// ==========================================

// POST /api/v1/custom-fields/workspace/:workspaceId — create field
router.post('/workspace/:workspaceId', authenticate, validate(createFieldSchema), async (req: Request, res: Response) => {
  const field = await customFieldsService.createField(req.params.workspaceId, req.user!.id, req.body);
  res.status(201).json({ success: true, data: field });
});

// GET /api/v1/custom-fields/workspace/:workspaceId — list fields
router.get('/workspace/:workspaceId', authenticate, async (req: Request, res: Response) => {
  const fields = await customFieldsService.getFields(req.params.workspaceId);
  res.json({ success: true, data: fields });
});

// GET /api/v1/custom-fields/:fieldId — get field
router.get('/:fieldId', authenticate, async (req: Request, res: Response) => {
  const field = await customFieldsService.getField(req.params.fieldId);
  res.json({ success: true, data: field });
});

// PATCH /api/v1/custom-fields/:fieldId — update field
router.patch('/:fieldId', authenticate, validate(updateFieldSchema), async (req: Request, res: Response) => {
  const field = await customFieldsService.updateField(req.params.fieldId, req.body);
  res.json({ success: true, data: field });
});

// DELETE /api/v1/custom-fields/:fieldId — delete field
router.delete('/:fieldId', authenticate, async (req: Request, res: Response) => {
  await customFieldsService.deleteField(req.params.fieldId);
  res.json({ success: true, data: { deleted: true } });
});

// ==========================================
// Field Locations
// ==========================================

// POST /api/v1/custom-fields/:fieldId/locations — add to location
router.post('/:fieldId/locations', authenticate, validate(addLocationSchema), async (req: Request, res: Response) => {
  const location = await customFieldsService.addLocation(req.params.fieldId, req.body);
  res.status(201).json({ success: true, data: location });
});

// DELETE /api/v1/custom-fields/:fieldId/locations/:locationRecordId — remove from location
router.delete('/:fieldId/locations/:locationRecordId', authenticate, async (req: Request, res: Response) => {
  await customFieldsService.removeLocation(req.params.fieldId, req.params.locationRecordId);
  res.json({ success: true, data: { removed: true } });
});

// GET /api/v1/custom-fields/location/:locationType/:locationId — get fields at location
router.get('/location/:locationType/:locationId', authenticate, async (req: Request, res: Response) => {
  const locationType = req.params.locationType as HierarchyLevel;
  const fields = await customFieldsService.getFieldsAtLocation(locationType, req.params.locationId);
  res.json({ success: true, data: fields });
});

// ==========================================
// Field Values
// ==========================================

// GET /api/v1/custom-fields/task/:taskId — get task's field values
router.get('/task/:taskId', authenticate, async (req: Request, res: Response) => {
  const values = await customFieldsService.getTaskValues(req.params.taskId);
  res.json({ success: true, data: values });
});

// POST /api/v1/custom-fields/task/:taskId/:fieldId/refresh-ai — manually trigger AI field refresh
router.post('/task/:taskId/:fieldId/refresh-ai', authenticate, async (req: Request, res: Response) => {
  const result = await customFieldsService.refreshAIField(req.params.taskId, req.params.fieldId);
  res.json({ success: true, data: result });
});

// PUT /api/v1/custom-fields/task/:taskId/bulk — bulk set values (must be before :fieldId route)
router.put('/task/:taskId/bulk', authenticate, validate(bulkSetValuesSchema), async (req: Request, res: Response) => {
  const results = await customFieldsService.bulkSetValues(req.params.taskId, req.body);
  res.json({ success: true, data: results });
});

// PUT /api/v1/custom-fields/task/:taskId/:fieldId — set value
router.put('/task/:taskId/:fieldId', authenticate, validate(setValueSchema), async (req: Request, res: Response) => {
  const value = await customFieldsService.setValue(req.params.fieldId, req.params.taskId, req.body);
  res.json({ success: true, data: value });
});

// DELETE /api/v1/custom-fields/task/:taskId/:fieldId — clear value
router.delete('/task/:taskId/:fieldId', authenticate, async (req: Request, res: Response) => {
  await customFieldsService.clearValue(req.params.fieldId, req.params.taskId);
  res.json({ success: true, data: { cleared: true } });
});

// ==========================================
// Filtering
// ==========================================

// GET /api/v1/custom-fields/tasks/filter — filter tasks by field values
router.get('/tasks/filter', authenticate, validate(filterTasksSchema, 'query'), async (req: Request, res: Response) => {
  const taskIds = await customFieldsService.filterTasks(req.query as any);
  res.json({ success: true, data: { taskIds, count: taskIds.length } });
});

export default router;
