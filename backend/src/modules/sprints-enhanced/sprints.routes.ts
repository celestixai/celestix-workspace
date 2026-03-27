import { Router, Request, Response } from 'express';
import { sprintsEnhancedService } from './sprints.service';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import {
  createFolderSchema,
  updateFolderSchema,
  createSprintSchema,
  updateSprintSchema,
  completeSprintSchema,
  addTasksSchema,
} from './sprints.validation';

const router = Router();

// ==========================================
// FOLDER ROUTES
// ==========================================

// GET /api/v1/sprints/space/:spaceId/folders — list sprint folders
router.get('/space/:spaceId/folders', authenticate, async (req: Request, res: Response) => {
  const folders = await sprintsEnhancedService.getSprintFolders(req.params.spaceId);
  res.json({ success: true, data: folders });
});

// POST /api/v1/sprints/space/:spaceId/folders — create folder
router.post('/space/:spaceId/folders', authenticate, validate(createFolderSchema), async (req: Request, res: Response) => {
  const folder = await sprintsEnhancedService.createSprintFolder(req.params.spaceId, req.body);
  res.status(201).json({ success: true, data: folder });
});

// PATCH /api/v1/sprints/folders/:folderId — update folder
router.patch('/folders/:folderId', authenticate, validate(updateFolderSchema), async (req: Request, res: Response) => {
  const folder = await sprintsEnhancedService.updateSprintFolder(req.params.folderId, req.body);
  res.json({ success: true, data: folder });
});

// DELETE /api/v1/sprints/folders/:folderId — delete folder
router.delete('/folders/:folderId', authenticate, async (req: Request, res: Response) => {
  await sprintsEnhancedService.deleteSprintFolder(req.params.folderId);
  res.json({ success: true, data: { message: 'Sprint folder deleted' } });
});

// ==========================================
// SPRINT ROUTES
// ==========================================

// GET /api/v1/sprints/folder/:folderId — list sprints in folder
router.get('/folder/:folderId', authenticate, async (req: Request, res: Response) => {
  const sprints = await sprintsEnhancedService.getSprints(req.params.folderId);
  res.json({ success: true, data: sprints });
});

// POST /api/v1/sprints/folder/:folderId — create sprint
router.post('/folder/:folderId', authenticate, validate(createSprintSchema), async (req: Request, res: Response) => {
  const sprint = await sprintsEnhancedService.createSprint(req.params.folderId, req.body);
  res.status(201).json({ success: true, data: sprint });
});

// GET /api/v1/sprints/:sprintId — get sprint + stats
router.get('/:sprintId', authenticate, async (req: Request, res: Response) => {
  const sprint = await sprintsEnhancedService.getSprint(req.params.sprintId);
  res.json({ success: true, data: sprint });
});

// PATCH /api/v1/sprints/:sprintId — update sprint
router.patch('/:sprintId', authenticate, validate(updateSprintSchema), async (req: Request, res: Response) => {
  const sprint = await sprintsEnhancedService.updateSprint(req.params.sprintId, req.body);
  res.json({ success: true, data: sprint });
});

// POST /api/v1/sprints/:sprintId/start — start sprint
router.post('/:sprintId/start', authenticate, async (req: Request, res: Response) => {
  const sprint = await sprintsEnhancedService.startSprint(req.params.sprintId);
  res.json({ success: true, data: sprint });
});

// POST /api/v1/sprints/:sprintId/complete — complete sprint
router.post('/:sprintId/complete', authenticate, validate(completeSprintSchema), async (req: Request, res: Response) => {
  const sprint = await sprintsEnhancedService.completeSprint(req.params.sprintId, req.body);
  res.json({ success: true, data: sprint });
});

// ==========================================
// TASK ROUTES
// ==========================================

// POST /api/v1/sprints/:sprintId/tasks — add tasks to sprint
router.post('/:sprintId/tasks', authenticate, validate(addTasksSchema), async (req: Request, res: Response) => {
  const result = await sprintsEnhancedService.addTasksToSprint(req.params.sprintId, req.body.taskIds);
  res.json({ success: true, data: result });
});

// DELETE /api/v1/sprints/:sprintId/tasks/:taskId — remove task from sprint
router.delete('/:sprintId/tasks/:taskId', authenticate, async (req: Request, res: Response) => {
  const result = await sprintsEnhancedService.removeTaskFromSprint(req.params.sprintId, req.params.taskId);
  res.json({ success: true, data: result });
});

// GET /api/v1/sprints/:sprintId/tasks — list sprint tasks
router.get('/:sprintId/tasks', authenticate, async (req: Request, res: Response) => {
  const tasks = await sprintsEnhancedService.getSprintTasks(req.params.sprintId);
  res.json({ success: true, data: tasks });
});

// ==========================================
// ANALYTICS ROUTES
// ==========================================

// GET /api/v1/sprints/:sprintId/burndown — burndown data
router.get('/:sprintId/burndown', authenticate, async (req: Request, res: Response) => {
  const data = await sprintsEnhancedService.getBurndownData(req.params.sprintId);
  res.json({ success: true, data });
});

// GET /api/v1/sprints/:sprintId/burnup — burnup data
router.get('/:sprintId/burnup', authenticate, async (req: Request, res: Response) => {
  const data = await sprintsEnhancedService.getBurnupData(req.params.sprintId);
  res.json({ success: true, data });
});

// GET /api/v1/sprints/folder/:folderId/velocity — velocity chart data
router.get('/folder/:folderId/velocity', authenticate, async (req: Request, res: Response) => {
  const data = await sprintsEnhancedService.getVelocityData(req.params.folderId);
  res.json({ success: true, data });
});

// GET /api/v1/sprints/:sprintId/report — sprint report
router.get('/:sprintId/report', authenticate, async (req: Request, res: Response) => {
  const data = await sprintsEnhancedService.getSprintReport(req.params.sprintId);
  res.json({ success: true, data });
});

export default router;
