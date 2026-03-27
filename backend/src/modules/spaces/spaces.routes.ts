import { Router, Request, Response } from 'express';
import { spacesService } from './spaces.service';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import {
  createSpaceSchema,
  updateSpaceSchema,
  updatePositionSchema,
  createStatusSchema,
  updateStatusSchema,
  reorderStatusesSchema,
  addMemberSchema,
  updateMemberSchema,
  duplicateSpaceSchema,
  setTaskIdPrefixSchema,
} from './spaces.validation';

const router = Router();

// ==========================================
// Space CRUD
// ==========================================

// GET /api/v1/spaces/workspace/:workspaceId/spaces
router.get('/workspace/:workspaceId/spaces', authenticate, async (req: Request, res: Response) => {
  const spaces = await spacesService.getSpaces(req.params.workspaceId, req.user!.id);
  res.json({ success: true, data: spaces });
});

// POST /api/v1/spaces/workspace/:workspaceId/spaces
router.post('/workspace/:workspaceId/spaces', authenticate, validate(createSpaceSchema), async (req: Request, res: Response) => {
  const space = await spacesService.createSpace(req.params.workspaceId, req.user!.id, req.body);
  res.status(201).json({ success: true, data: space });
});

// GET /api/v1/spaces/:spaceId
router.get('/:spaceId', authenticate, async (req: Request, res: Response) => {
  const space = await spacesService.getSpaceById(req.params.spaceId, req.user!.id);
  res.json({ success: true, data: space });
});

// PATCH /api/v1/spaces/:spaceId
router.patch('/:spaceId', authenticate, validate(updateSpaceSchema), async (req: Request, res: Response) => {
  const space = await spacesService.updateSpace(req.params.spaceId, req.user!.id, req.body);
  res.json({ success: true, data: space });
});

// DELETE /api/v1/spaces/:spaceId
router.delete('/:spaceId', authenticate, async (req: Request, res: Response) => {
  await spacesService.deleteSpace(req.params.spaceId, req.user!.id);
  res.json({ success: true, data: { message: 'Space deleted' } });
});

// PATCH /api/v1/spaces/:spaceId/position
router.patch('/:spaceId/position', authenticate, validate(updatePositionSchema), async (req: Request, res: Response) => {
  const space = await spacesService.updatePosition(req.params.spaceId, req.body.position);
  res.json({ success: true, data: space });
});

// POST /api/v1/spaces/:spaceId/duplicate
router.post('/:spaceId/duplicate', authenticate, validate(duplicateSpaceSchema), async (req: Request, res: Response) => {
  const space = await spacesService.duplicateSpace(req.params.spaceId, req.user!.id, req.body.includeTasks);
  res.status(201).json({ success: true, data: space });
});

// ==========================================
// Task ID Prefix
// ==========================================

// PATCH /api/v1/spaces/:spaceId/task-id-prefix
router.patch('/:spaceId/task-id-prefix', authenticate, validate(setTaskIdPrefixSchema), async (req: Request, res: Response) => {
  const space = await spacesService.setTaskIdPrefix(req.params.spaceId, req.user!.id, req.body.prefix);
  res.json({ success: true, data: space });
});

// ==========================================
// Members
// ==========================================

// GET /api/v1/spaces/:spaceId/members
router.get('/:spaceId/members', authenticate, async (req: Request, res: Response) => {
  await spacesService.checkSpaceAccess(req.params.spaceId, req.user!.id);
  const members = await spacesService.getMembers(req.params.spaceId);
  res.json({ success: true, data: members });
});

// POST /api/v1/spaces/:spaceId/members
router.post('/:spaceId/members', authenticate, validate(addMemberSchema), async (req: Request, res: Response) => {
  await spacesService.checkSpaceRole(req.params.spaceId, req.user!.id, ['OWNER', 'ADMIN']);
  const members = await spacesService.addMembers(req.params.spaceId, req.body.userIds, req.body.role);
  res.status(201).json({ success: true, data: members });
});

// PATCH /api/v1/spaces/:spaceId/members/:userId
router.patch('/:spaceId/members/:userId', authenticate, validate(updateMemberSchema), async (req: Request, res: Response) => {
  await spacesService.checkSpaceRole(req.params.spaceId, req.user!.id, ['OWNER', 'ADMIN']);
  const member = await spacesService.updateMemberRole(req.params.spaceId, req.params.userId, req.body.role);
  res.json({ success: true, data: member });
});

// DELETE /api/v1/spaces/:spaceId/members/:userId
router.delete('/:spaceId/members/:userId', authenticate, async (req: Request, res: Response) => {
  await spacesService.checkSpaceRole(req.params.spaceId, req.user!.id, ['OWNER', 'ADMIN']);
  await spacesService.removeMember(req.params.spaceId, req.params.userId);
  res.json({ success: true, data: { removed: true } });
});

// ==========================================
// Statuses
// ==========================================

// GET /api/v1/spaces/:spaceId/statuses
router.get('/:spaceId/statuses', authenticate, async (req: Request, res: Response) => {
  await spacesService.checkSpaceAccess(req.params.spaceId, req.user!.id);
  const statuses = await spacesService.getStatuses(req.params.spaceId);
  res.json({ success: true, data: statuses });
});

// POST /api/v1/spaces/:spaceId/statuses
router.post('/:spaceId/statuses', authenticate, validate(createStatusSchema), async (req: Request, res: Response) => {
  await spacesService.checkSpaceRole(req.params.spaceId, req.user!.id, ['OWNER', 'ADMIN']);
  const status = await spacesService.createStatus(req.params.spaceId, req.body);
  res.status(201).json({ success: true, data: status });
});

// PATCH /api/v1/spaces/statuses/:statusId
router.patch('/statuses/:statusId', authenticate, validate(updateStatusSchema), async (req: Request, res: Response) => {
  const status = await spacesService.updateStatus(req.params.statusId, req.body);
  res.json({ success: true, data: status });
});

// DELETE /api/v1/spaces/statuses/:statusId
router.delete('/statuses/:statusId', authenticate, async (req: Request, res: Response) => {
  await spacesService.deleteStatus(req.params.statusId);
  res.json({ success: true, data: { deleted: true } });
});

// PATCH /api/v1/spaces/:spaceId/statuses/reorder
router.patch('/:spaceId/statuses/reorder', authenticate, validate(reorderStatusesSchema), async (req: Request, res: Response) => {
  await spacesService.checkSpaceRole(req.params.spaceId, req.user!.id, ['OWNER', 'ADMIN']);
  const statuses = await spacesService.reorderStatuses(req.params.spaceId, req.body.statuses);
  res.json({ success: true, data: statuses });
});

export default router;
