import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { tasksService } from './tasks.service';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { prisma } from '../../config/database';
import { config } from '../../config';
import checklistsRouter from './checklists/checklists.routes';
import relationshipsRouter from '../relationships/relationships.routes';
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
  bulkActionSchema,
  createSubtaskSchema,
  convertToSubtaskSchema,
  moveSubtaskSchema,
  updateTaskDatesSchema,
} from './tasks.schema';

const router = Router();

// Cover image upload config
const coverUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      const dir = path.resolve(config.storage.path, 'covers');
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `${uuidv4()}${ext}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit for covers
  fileFilter: (_req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed for cover images'));
    }
  },
});

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
// BULK ACTION (v2 — flexible)
// ==========================================

// POST /api/v1/tasks/bulk-action
router.post('/bulk-action', authenticate, validate(bulkActionSchema), async (req: Request, res: Response) => {
  const result = await tasksService.bulkAction(req.user!.id, req.body);
  res.json({ success: true, data: result });
});

// ==========================================
// CUSTOM TASK ID LOOKUP (must precede /:taskId)
// ==========================================

// GET /api/v1/tasks/by-id/:customTaskId
router.get('/by-id/:customTaskId', authenticate, async (req: Request, res: Response) => {
  const task = await prisma.task.findFirst({
    where: {
      customTaskId: { equals: req.params.customTaskId, mode: 'insensitive' },
      deletedAt: null,
    },
    include: {
      createdBy: { select: { id: true, displayName: true, avatarUrl: true, username: true } },
      assignees: { include: { user: { select: { id: true, displayName: true, avatarUrl: true, username: true } } } },
      labels: { include: { label: true } },
      subtasks: {
        where: { deletedAt: null },
        select: { id: true, title: true, status: true },
        orderBy: { position: 'asc' },
      },
      parentTask: { select: { id: true, title: true } },
    },
  });

  if (!task) {
    res.status(404).json({ success: false, error: { message: 'Task not found', code: 'NOT_FOUND' } });
    return;
  }
  res.json({ success: true, data: task });
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
// MY TASKS (cross-project)
// ==========================================

router.get('/my-tasks', authenticate, async (req, res, next) => {
  try {
    const assignments = await prisma.taskAssignee.findMany({
      where: { userId: req.user!.id },
      include: {
        task: {
          include: {
            project: { select: { id: true, name: true, color: true } },
            assignees: { include: { user: { select: { id: true, displayName: true, avatarUrl: true } } } },
            labels: { include: { label: true } },
          },
        },
      },
    });
    const tasks = assignments
      .map(a => a.task)
      .filter(t => t.status !== 'DONE' && !t.deletedAt)
      .sort((a, b) => {
        if (a.dueDate && b.dueDate) return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        if (a.dueDate) return -1;
        if (b.dueDate) return 1;
        return 0;
      });
    res.json({ success: true, data: tasks });
  } catch (err) { next(err); }
});

// ==========================================
// SPRINTS (standalone patch/delete must precede /:taskId)
// ==========================================

router.patch('/sprints/:id', authenticate, async (req, res, next) => {
  try {
    const data: any = { ...req.body };
    if (data.startDate) data.startDate = new Date(data.startDate);
    if (data.endDate) data.endDate = new Date(data.endDate);
    const sprint = await prisma.sprint.update({ where: { id: req.params.id }, data });
    res.json({ success: true, data: sprint });
  } catch (err) { next(err); }
});

router.delete('/sprints/:id', authenticate, async (req, res, next) => {
  try {
    await prisma.sprint.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ==========================================
// CUSTOM FIELDS (standalone delete must precede /:taskId)
// ==========================================

router.delete('/custom-fields/:id', authenticate, async (req, res, next) => {
  try {
    await prisma.taskCustomField.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ==========================================
// RELATIONSHIPS SUB-ROUTER
// ==========================================

router.use(relationshipsRouter);

// ==========================================
// CHECKLISTS SUB-ROUTER (/:taskId/checklists)
// ==========================================

router.use('/:taskId/checklists', checklistsRouter);

// ==========================================
// TASK WATCHER ROUTES
// ==========================================

// POST /api/v1/tasks/:taskId/watchers — watch task (current user)
router.post('/:taskId/watchers', authenticate, async (req: Request, res: Response) => {
  const watcher = await tasksService.watchTask(req.params.taskId, req.user!.id);
  res.status(201).json({ success: true, data: watcher });
});

// DELETE /api/v1/tasks/:taskId/watchers — unwatch task (current user)
router.delete('/:taskId/watchers', authenticate, async (req: Request, res: Response) => {
  await tasksService.unwatchTask(req.params.taskId, req.user!.id);
  res.json({ success: true, data: { message: 'Unwatched task' } });
});

// GET /api/v1/tasks/:taskId/watchers — list watchers
router.get('/:taskId/watchers', authenticate, async (req: Request, res: Response) => {
  const watchers = await tasksService.getWatchers(req.params.taskId);
  res.json({ success: true, data: watchers });
});

// ==========================================
// COVER IMAGE ROUTES
// ==========================================

// POST /api/v1/tasks/:taskId/cover-image — upload cover image
router.post('/:taskId/cover-image', authenticate, coverUpload.single('cover'), async (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ success: false, error: { message: 'No image file uploaded', code: 'NO_FILE' } });
    return;
  }
  const task = await tasksService.setCoverImage(req.user!.id, req.params.taskId, req.file);
  res.json({ success: true, data: task });
});

// DELETE /api/v1/tasks/:taskId/cover-image — remove cover image
router.delete('/:taskId/cover-image', authenticate, async (req: Request, res: Response) => {
  const task = await tasksService.removeCoverImage(req.user!.id, req.params.taskId);
  res.json({ success: true, data: task });
});

// PATCH /api/v1/tasks/:taskId/cover-color — set solid color cover
router.patch('/:taskId/cover-color', authenticate, async (req: Request, res: Response) => {
  const { color } = req.body;
  if (!color) {
    res.status(400).json({ success: false, error: { message: 'Color is required', code: 'INVALID_INPUT' } });
    return;
  }
  const task = await tasksService.setCoverColor(req.user!.id, req.params.taskId, color);
  res.json({ success: true, data: task });
});

// ==========================================
// TIME ESTIMATE ROUTES
// ==========================================

// PUT /api/v1/tasks/:taskId/time-estimate — set total estimate
router.put('/:taskId/time-estimate', authenticate, async (req: Request, res: Response) => {
  const { minutes } = req.body;
  if (minutes === undefined || typeof minutes !== 'number') {
    res.status(400).json({ success: false, error: { message: 'minutes (number) is required', code: 'INVALID_INPUT' } });
    return;
  }
  const task = await tasksService.setTimeEstimate(req.user!.id, req.params.taskId, minutes);
  res.json({ success: true, data: task });
});

// GET /api/v1/tasks/:taskId/time-summary — get full time summary
router.get('/:taskId/time-summary', authenticate, async (req: Request, res: Response) => {
  const summary = await tasksService.getTimeSummary(req.user!.id, req.params.taskId);
  res.json({ success: true, data: summary });
});

// PUT /api/v1/tasks/:taskId/time-estimate/:userId — set per-user estimate
router.put('/:taskId/time-estimate/:userId', authenticate, async (req: Request, res: Response) => {
  const { minutes } = req.body;
  if (minutes === undefined || typeof minutes !== 'number') {
    res.status(400).json({ success: false, error: { message: 'minutes (number) is required', code: 'INVALID_INPUT' } });
    return;
  }
  const estimate = await tasksService.setUserTimeEstimate(req.user!.id, req.params.taskId, req.params.userId, minutes);
  res.json({ success: true, data: estimate });
});

// DELETE /api/v1/tasks/:taskId/time-estimate/:userId — remove per-user estimate
router.delete('/:taskId/time-estimate/:userId', authenticate, async (req: Request, res: Response) => {
  await tasksService.removeUserTimeEstimate(req.user!.id, req.params.taskId, req.params.userId);
  res.json({ success: true, data: { message: 'User time estimate removed' } });
});

// ==========================================
// TASK DATES (for Gantt drag operations)
// ==========================================

// PATCH /api/v1/tasks/:taskId/dates — update start/due dates atomically
router.patch('/:taskId/dates', authenticate, validate(updateTaskDatesSchema), async (req: Request, res: Response) => {
  const task = await tasksService.updateDates(req.user!.id, req.params.taskId, req.body.startDate, req.body.dueDate);
  res.json({ success: true, data: task });
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
  const promoteChildren = req.query.promoteChildren === 'true';
  await tasksService.deleteTask(req.user!.id, req.params.taskId, promoteChildren);
  res.json({ success: true, data: { message: 'Task deleted' } });
});

// PATCH /api/v1/tasks/:taskId/position
router.patch('/:taskId/position', authenticate, validate(updateTaskPositionSchema), async (req: Request, res: Response) => {
  const task = await tasksService.updateTaskPosition(req.user!.id, req.params.taskId, req.body);
  res.json({ success: true, data: task });
});

// ==========================================
// SUBTASK ROUTES
// ==========================================

// GET /api/v1/tasks/:taskId/subtasks/all — ALL subtasks recursively (must precede /subtasks)
router.get('/:taskId/subtasks/all', authenticate, async (req: Request, res: Response) => {
  const subtasks = await tasksService.getAllSubtasksRecursive(req.user!.id, req.params.taskId);
  res.json({ success: true, data: subtasks });
});

// GET /api/v1/tasks/:taskId/subtasks — direct children
router.get('/:taskId/subtasks', authenticate, async (req: Request, res: Response) => {
  const subtasks = await tasksService.getSubtasks(req.user!.id, req.params.taskId);
  res.json({ success: true, data: subtasks });
});

// POST /api/v1/tasks/:taskId/subtasks — create subtask (simplified)
router.post('/:taskId/subtasks', authenticate, validate(createSubtaskSchema), async (req: Request, res: Response) => {
  const subtask = await tasksService.createSubtask(req.user!.id, req.params.taskId, req.body);
  res.status(201).json({ success: true, data: subtask });
});

// PATCH /api/v1/tasks/:taskId/convert-to-subtask — convert task to subtask
router.patch('/:taskId/convert-to-subtask', authenticate, validate(convertToSubtaskSchema), async (req: Request, res: Response) => {
  const task = await tasksService.convertToSubtask(req.user!.id, req.params.taskId, req.body.parentTaskId);
  res.json({ success: true, data: task });
});

// PATCH /api/v1/tasks/:taskId/convert-to-task — convert subtask to top-level task
router.patch('/:taskId/convert-to-task', authenticate, async (req: Request, res: Response) => {
  const task = await tasksService.convertToTask(req.user!.id, req.params.taskId);
  res.json({ success: true, data: task });
});

// PATCH /api/v1/tasks/:taskId/move-subtask — move subtask to different parent
router.patch('/:taskId/move-subtask', authenticate, validate(moveSubtaskSchema), async (req: Request, res: Response) => {
  const task = await tasksService.moveSubtask(req.user!.id, req.params.taskId, req.body.newParentTaskId);
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

// ==========================================
// SPRINTS (project-scoped)
// ==========================================

router.get('/projects/:projectId/sprints', authenticate, async (req, res, next) => {
  try {
    const sprints = await prisma.sprint.findMany({
      where: { projectId: req.params.projectId },
      orderBy: { startDate: 'desc' },
    });
    res.json({ success: true, data: sprints });
  } catch (err) { next(err); }
});

router.post('/projects/:projectId/sprints', authenticate, async (req, res, next) => {
  try {
    const { name, startDate, endDate, goal } = req.body;
    const sprint = await prisma.sprint.create({
      data: {
        projectId: req.params.projectId,
        name, goal,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
      },
    });
    res.json({ success: true, data: sprint });
  } catch (err) { next(err); }
});

// ==========================================
// CUSTOM FIELDS (project-scoped)
// ==========================================

router.get('/projects/:projectId/custom-fields', authenticate, async (req, res, next) => {
  try {
    const fields = await prisma.taskCustomField.findMany({
      where: { projectId: req.params.projectId },
      orderBy: { position: 'asc' },
    });
    res.json({ success: true, data: fields });
  } catch (err) { next(err); }
});

router.post('/projects/:projectId/custom-fields', authenticate, async (req, res, next) => {
  try {
    const { name, type, options } = req.body;
    const field = await prisma.taskCustomField.create({
      data: { projectId: req.params.projectId, name, type, options },
    });
    res.json({ success: true, data: field });
  } catch (err) { next(err); }
});

// ==========================================
// TASK ANALYTICS (project-scoped)
// ==========================================

router.get('/projects/:projectId/analytics', authenticate, async (req, res, next) => {
  try {
    const projectId = req.params.projectId;
    const tasks = await prisma.task.findMany({
      where: { projectId, deletedAt: null },
      include: { assignees: true },
    });

    const byStatus: Record<string, number> = {};
    const byPriority: Record<string, number> = {};
    const byAssignee: Record<string, number> = {};
    let overdue = 0;

    tasks.forEach(t => {
      byStatus[t.status] = (byStatus[t.status] || 0) + 1;
      byPriority[t.priority] = (byPriority[t.priority] || 0) + 1;
      if (t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'DONE') overdue++;
      t.assignees.forEach(a => {
        byAssignee[a.userId] = (byAssignee[a.userId] || 0) + 1;
      });
    });

    res.json({ success: true, data: { total: tasks.length, byStatus, byPriority, byAssignee, overdue } });
  } catch (err) { next(err); }
});

export default router;
