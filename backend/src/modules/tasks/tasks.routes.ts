import { Router, Request, Response } from 'express';
import { tasksService } from './tasks.service';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import {
  createProjectSchema,
  updateProjectSchema,
  addProjectMemberSchema,
  updateProjectMemberSchema,
  createTaskSchema,
  updateTaskSchema,
  updateTaskPositionSchema,
  assignUsersSchema,
  createLabelSchema,
  updateLabelSchema,
  assignLabelsSchema,
  createCommentSchema,
  updateCommentSchema,
  logTimeEntrySchema,
  addDependencySchema,
  taskFiltersSchema,
  bulkUpdateTasksSchema,
} from './tasks.schema';

const router = Router();

// ==========================================
// PROJECT ROUTES
// ==========================================

// GET /api/v1/tasks/projects
router.get('/projects', authenticate, async (req: Request, res: Response) => {
  const projects = await tasksService.getProjects(req.user!.id);
  res.json({ success: true, data: projects });
});

// POST /api/v1/tasks/projects
router.post('/projects', authenticate, validate(createProjectSchema), async (req: Request, res: Response) => {
  const project = await tasksService.createProject(req.user!.id, req.body);
  res.status(201).json({ success: true, data: project });
});

// GET /api/v1/tasks/projects/:projectId
router.get('/projects/:projectId', authenticate, async (req: Request, res: Response) => {
  const project = await tasksService.getProject(req.user!.id, req.params.projectId);
  res.json({ success: true, data: project });
});

// PATCH /api/v1/tasks/projects/:projectId
router.patch('/projects/:projectId', authenticate, validate(updateProjectSchema), async (req: Request, res: Response) => {
  const project = await tasksService.updateProject(req.user!.id, req.params.projectId, req.body);
  res.json({ success: true, data: project });
});

// DELETE /api/v1/tasks/projects/:projectId
router.delete('/projects/:projectId', authenticate, async (req: Request, res: Response) => {
  await tasksService.deleteProject(req.user!.id, req.params.projectId);
  res.json({ success: true, data: { message: 'Project deleted' } });
});

// ==========================================
// PROJECT MEMBER ROUTES
// ==========================================

// POST /api/v1/tasks/projects/:projectId/members
router.post('/projects/:projectId/members', authenticate, validate(addProjectMemberSchema), async (req: Request, res: Response) => {
  const member = await tasksService.addProjectMember(req.user!.id, req.params.projectId, req.body.userId, req.body.role);
  res.status(201).json({ success: true, data: member });
});

// PATCH /api/v1/tasks/projects/:projectId/members/:userId
router.patch('/projects/:projectId/members/:userId', authenticate, validate(updateProjectMemberSchema), async (req: Request, res: Response) => {
  const member = await tasksService.updateProjectMember(req.user!.id, req.params.projectId, req.params.userId, req.body.role);
  res.json({ success: true, data: member });
});

// DELETE /api/v1/tasks/projects/:projectId/members/:userId
router.delete('/projects/:projectId/members/:userId', authenticate, async (req: Request, res: Response) => {
  await tasksService.removeProjectMember(req.user!.id, req.params.projectId, req.params.userId);
  res.json({ success: true, data: { message: 'Member removed' } });
});

// ==========================================
// LABEL ROUTES (project-scoped)
// ==========================================

// POST /api/v1/tasks/projects/:projectId/labels
router.post('/projects/:projectId/labels', authenticate, validate(createLabelSchema), async (req: Request, res: Response) => {
  const label = await tasksService.createLabel(req.user!.id, req.params.projectId, req.body);
  res.status(201).json({ success: true, data: label });
});

// PATCH /api/v1/tasks/projects/:projectId/labels/:labelId
router.patch('/projects/:projectId/labels/:labelId', authenticate, validate(updateLabelSchema), async (req: Request, res: Response) => {
  const label = await tasksService.updateLabel(req.user!.id, req.params.projectId, req.params.labelId, req.body);
  res.json({ success: true, data: label });
});

// DELETE /api/v1/tasks/projects/:projectId/labels/:labelId
router.delete('/projects/:projectId/labels/:labelId', authenticate, async (req: Request, res: Response) => {
  await tasksService.deleteLabel(req.user!.id, req.params.projectId, req.params.labelId);
  res.json({ success: true, data: { message: 'Label deleted' } });
});

// ==========================================
// TASK LIST/VIEW ROUTES (project-scoped)
// ==========================================

// GET /api/v1/tasks/projects/:projectId/tasks
router.get('/projects/:projectId/tasks', authenticate, validate(taskFiltersSchema, 'query'), async (req: Request, res: Response) => {
  const result = await tasksService.getTasks(req.user!.id, req.params.projectId, req.query as never);
  res.json({ success: true, data: result.tasks, pagination: { hasMore: result.hasMore, cursor: result.cursor } });
});

// GET /api/v1/tasks/projects/:projectId/board
router.get('/projects/:projectId/board', authenticate, async (req: Request, res: Response) => {
  const filters = req.query as never;
  const board = await tasksService.getBoardView(req.user!.id, req.params.projectId, filters);
  res.json({ success: true, data: board });
});

// GET /api/v1/tasks/projects/:projectId/list
router.get('/projects/:projectId/list', authenticate, validate(taskFiltersSchema, 'query'), async (req: Request, res: Response) => {
  const result = await tasksService.getListView(req.user!.id, req.params.projectId, req.query as never);
  res.json({ success: true, data: result.tasks, pagination: { hasMore: result.hasMore, cursor: result.cursor } });
});

// POST /api/v1/tasks/projects/:projectId/tasks
router.post('/projects/:projectId/tasks', authenticate, validate(createTaskSchema), async (req: Request, res: Response) => {
  const task = await tasksService.createTask(req.user!.id, req.params.projectId, req.body);
  res.status(201).json({ success: true, data: task });
});

// POST /api/v1/tasks/projects/:projectId/bulk
router.post('/projects/:projectId/bulk', authenticate, validate(bulkUpdateTasksSchema), async (req: Request, res: Response) => {
  const tasks = await tasksService.bulkUpdateTasks(req.user!.id, req.params.projectId, req.body);
  res.json({ success: true, data: tasks });
});

// ==========================================
// STATIC-SEGMENT ROUTES (must precede /:taskId)
// ==========================================

// PATCH /api/v1/tasks/comments/:commentId
router.patch('/comments/:commentId', authenticate, validate(updateCommentSchema), async (req: Request, res: Response) => {
  const comment = await tasksService.updateComment(req.user!.id, req.params.commentId, req.body);
  res.json({ success: true, data: comment });
});

// DELETE /api/v1/tasks/comments/:commentId
router.delete('/comments/:commentId', authenticate, async (req: Request, res: Response) => {
  await tasksService.deleteComment(req.user!.id, req.params.commentId);
  res.json({ success: true, data: { message: 'Comment deleted' } });
});

// DELETE /api/v1/tasks/time-entries/:entryId
router.delete('/time-entries/:entryId', authenticate, async (req: Request, res: Response) => {
  await tasksService.deleteTimeEntry(req.user!.id, req.params.entryId);
  res.json({ success: true, data: { message: 'Time entry deleted' } });
});

// ==========================================
// TASK DETAIL ROUTES (/:taskId parameterized)
// ==========================================

// GET /api/v1/tasks/:taskId
router.get('/:taskId', authenticate, async (req: Request, res: Response) => {
  const task = await tasksService.getTask(req.user!.id, req.params.taskId);
  res.json({ success: true, data: task });
});

// PATCH /api/v1/tasks/:taskId
router.patch('/:taskId', authenticate, validate(updateTaskSchema), async (req: Request, res: Response) => {
  const task = await tasksService.updateTask(req.user!.id, req.params.taskId, req.body);
  res.json({ success: true, data: task });
});

// DELETE /api/v1/tasks/:taskId
router.delete('/:taskId', authenticate, async (req: Request, res: Response) => {
  await tasksService.deleteTask(req.user!.id, req.params.taskId);
  res.json({ success: true, data: { message: 'Task deleted' } });
});

// PATCH /api/v1/tasks/:taskId/position
router.patch('/:taskId/position', authenticate, validate(updateTaskPositionSchema), async (req: Request, res: Response) => {
  const task = await tasksService.updateTaskPosition(req.user!.id, req.params.taskId, req.body);
  res.json({ success: true, data: task });
});

// ==========================================
// ASSIGNEE ROUTES
// ==========================================

// POST /api/v1/tasks/:taskId/assignees
router.post('/:taskId/assignees', authenticate, validate(assignUsersSchema), async (req: Request, res: Response) => {
  const task = await tasksService.assignUsers(req.user!.id, req.params.taskId, req.body.userIds);
  res.json({ success: true, data: task });
});

// DELETE /api/v1/tasks/:taskId/assignees/:userId
router.delete('/:taskId/assignees/:userId', authenticate, async (req: Request, res: Response) => {
  const task = await tasksService.unassignUser(req.user!.id, req.params.taskId, req.params.userId);
  res.json({ success: true, data: task });
});

// ==========================================
// TASK LABEL ROUTES
// ==========================================

// POST /api/v1/tasks/:taskId/labels
router.post('/:taskId/labels', authenticate, validate(assignLabelsSchema), async (req: Request, res: Response) => {
  const task = await tasksService.assignLabels(req.user!.id, req.params.taskId, req.body.labelIds);
  res.json({ success: true, data: task });
});

// DELETE /api/v1/tasks/:taskId/labels/:labelId
router.delete('/:taskId/labels/:labelId', authenticate, async (req: Request, res: Response) => {
  const task = await tasksService.removeLabel(req.user!.id, req.params.taskId, req.params.labelId);
  res.json({ success: true, data: task });
});

// ==========================================
// COMMENT ROUTES (task-scoped)
// ==========================================

// GET /api/v1/tasks/:taskId/comments
router.get('/:taskId/comments', authenticate, async (req: Request, res: Response) => {
  const comments = await tasksService.getComments(req.user!.id, req.params.taskId);
  res.json({ success: true, data: comments });
});

// POST /api/v1/tasks/:taskId/comments
router.post('/:taskId/comments', authenticate, validate(createCommentSchema), async (req: Request, res: Response) => {
  const comment = await tasksService.addComment(req.user!.id, req.params.taskId, req.body);
  res.status(201).json({ success: true, data: comment });
});

// ==========================================
// ACTIVITY ROUTES
// ==========================================

// GET /api/v1/tasks/:taskId/activities
router.get('/:taskId/activities', authenticate, async (req: Request, res: Response) => {
  const activities = await tasksService.getActivities(req.user!.id, req.params.taskId);
  res.json({ success: true, data: activities });
});

// ==========================================
// TIME TRACKING ROUTES
// ==========================================

// POST /api/v1/tasks/:taskId/timer/start
router.post('/:taskId/timer/start', authenticate, async (req: Request, res: Response) => {
  const entry = await tasksService.startTimer(req.user!.id, req.params.taskId);
  res.status(201).json({ success: true, data: entry });
});

// POST /api/v1/tasks/:taskId/timer/stop
router.post('/:taskId/timer/stop', authenticate, async (req: Request, res: Response) => {
  const entry = await tasksService.stopTimer(req.user!.id, req.params.taskId);
  res.json({ success: true, data: entry });
});

// GET /api/v1/tasks/:taskId/time-entries
router.get('/:taskId/time-entries', authenticate, async (req: Request, res: Response) => {
  const result = await tasksService.getTimeEntries(req.user!.id, req.params.taskId);
  res.json({ success: true, data: result.entries, meta: { totalMinutes: result.totalMinutes } });
});

// POST /api/v1/tasks/:taskId/time-entries
router.post('/:taskId/time-entries', authenticate, validate(logTimeEntrySchema), async (req: Request, res: Response) => {
  const entry = await tasksService.logTimeEntry(req.user!.id, req.params.taskId, req.body);
  res.status(201).json({ success: true, data: entry });
});

// ==========================================
// DEPENDENCY ROUTES
// ==========================================

// POST /api/v1/tasks/:taskId/dependencies
router.post('/:taskId/dependencies', authenticate, validate(addDependencySchema), async (req: Request, res: Response) => {
  const dep = await tasksService.addDependency(req.user!.id, req.params.taskId, req.body.dependsOnId);
  res.status(201).json({ success: true, data: dep });
});

// DELETE /api/v1/tasks/:taskId/dependencies/:dependsOnId
router.delete('/:taskId/dependencies/:dependsOnId', authenticate, async (req: Request, res: Response) => {
  await tasksService.removeDependency(req.user!.id, req.params.taskId, req.params.dependsOnId);
  res.json({ success: true, data: { message: 'Dependency removed' } });
});

export default router;
