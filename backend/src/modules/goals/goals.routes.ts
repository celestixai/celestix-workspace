import { Router, Request, Response } from 'express';
import { goalsService } from './goals.service';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import {
  createGoalFolderSchema,
  updateGoalFolderSchema,
  createGoalSchema,
  updateGoalSchema,
  createTargetSchema,
  updateTargetSchema,
  addMemberSchema,
  updateMemberRoleSchema,
  updateProgressSchema,
} from './goals.validation';

const router = Router();

// ==========================================
// FOLDER ROUTES
// ==========================================

// GET /api/v1/goals/workspace/:workspaceId/folders — list folders
router.get('/workspace/:workspaceId/folders', authenticate, async (req: Request, res: Response) => {
  const folders = await goalsService.getGoalFolders(req.params.workspaceId);
  res.json({ success: true, data: folders });
});

// POST /api/v1/goals/workspace/:workspaceId/folders — create folder
router.post('/workspace/:workspaceId/folders', authenticate, validate(createGoalFolderSchema), async (req: Request, res: Response) => {
  const folder = await goalsService.createGoalFolder(req.params.workspaceId, req.user!.id, req.body);
  res.status(201).json({ success: true, data: folder });
});

// PATCH /api/v1/goals/folders/:folderId — update folder
router.patch('/folders/:folderId', authenticate, validate(updateGoalFolderSchema), async (req: Request, res: Response) => {
  const folder = await goalsService.updateGoalFolder(req.params.folderId, req.body);
  res.json({ success: true, data: folder });
});

// DELETE /api/v1/goals/folders/:folderId — delete folder
router.delete('/folders/:folderId', authenticate, async (req: Request, res: Response) => {
  await goalsService.deleteGoalFolder(req.params.folderId);
  res.json({ success: true, data: { message: 'Goal folder deleted' } });
});

// ==========================================
// GOAL ROUTES
// ==========================================

// GET /api/v1/goals/workspace/:workspaceId — list goals
router.get('/workspace/:workspaceId', authenticate, async (req: Request, res: Response) => {
  const folderId = req.query.folderId as string | undefined;
  const goals = await goalsService.getGoals(req.params.workspaceId, folderId);
  res.json({ success: true, data: goals });
});

// POST /api/v1/goals — create goal
router.post('/', authenticate, validate(createGoalSchema), async (req: Request, res: Response) => {
  const goal = await goalsService.createGoal(req.user!.id, req.body);
  res.status(201).json({ success: true, data: goal });
});

// GET /api/v1/goals/:goalId — get goal with targets + progress
router.get('/:goalId', authenticate, async (req: Request, res: Response) => {
  const goal = await goalsService.getGoal(req.params.goalId);
  res.json({ success: true, data: goal });
});

// PATCH /api/v1/goals/:goalId — update goal
router.patch('/:goalId', authenticate, validate(updateGoalSchema), async (req: Request, res: Response) => {
  const goal = await goalsService.updateGoal(req.params.goalId, req.body);
  res.json({ success: true, data: goal });
});

// DELETE /api/v1/goals/:goalId — delete goal
router.delete('/:goalId', authenticate, async (req: Request, res: Response) => {
  await goalsService.deleteGoal(req.params.goalId);
  res.json({ success: true, data: { message: 'Goal deleted' } });
});

// ==========================================
// TARGET ROUTES
// ==========================================

// POST /api/v1/goals/:goalId/targets — add target
router.post('/:goalId/targets', authenticate, validate(createTargetSchema), async (req: Request, res: Response) => {
  const target = await goalsService.addTarget(req.params.goalId, req.body);
  res.status(201).json({ success: true, data: target });
});

// PATCH /api/v1/goals/targets/:targetId — update target
router.patch('/targets/:targetId', authenticate, validate(updateTargetSchema), async (req: Request, res: Response) => {
  const target = await goalsService.updateTarget(req.params.targetId, req.body);
  res.json({ success: true, data: target });
});

// DELETE /api/v1/goals/targets/:targetId — delete target
router.delete('/targets/:targetId', authenticate, async (req: Request, res: Response) => {
  await goalsService.deleteTarget(req.params.targetId);
  res.json({ success: true, data: { message: 'Target deleted' } });
});

// POST /api/v1/goals/targets/:targetId/progress — update progress value
router.post('/targets/:targetId/progress', authenticate, validate(updateProgressSchema), async (req: Request, res: Response) => {
  const target = await goalsService.updateTargetProgress(req.params.targetId, req.body.value);
  res.json({ success: true, data: target });
});

// ==========================================
// MEMBER ROUTES
// ==========================================

// POST /api/v1/goals/:goalId/members — add member
router.post('/:goalId/members', authenticate, validate(addMemberSchema), async (req: Request, res: Response) => {
  const member = await goalsService.addMember(req.params.goalId, req.body.userId, req.body.role);
  res.status(201).json({ success: true, data: member });
});

// DELETE /api/v1/goals/:goalId/members/:userId — remove member
router.delete('/:goalId/members/:userId', authenticate, async (req: Request, res: Response) => {
  await goalsService.removeMember(req.params.goalId, req.params.userId);
  res.json({ success: true, data: { message: 'Member removed' } });
});

// PATCH /api/v1/goals/:goalId/members/:userId — update role
router.patch('/:goalId/members/:userId', authenticate, validate(updateMemberRoleSchema), async (req: Request, res: Response) => {
  const member = await goalsService.updateMemberRole(req.params.goalId, req.params.userId, req.body.role);
  res.json({ success: true, data: member });
});

export default router;
