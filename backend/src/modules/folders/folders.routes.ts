import { Router, Request, Response } from 'express';
import { foldersService } from './folders.service';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import {
  createFolderSchema,
  updateFolderSchema,
  updatePositionSchema,
  createFolderStatusSchema,
  updateFolderStatusSchema,
  moveFolderSchema,
} from './folders.validation';

const router = Router();

// ==========================================
// Folder CRUD
// ==========================================

// GET /api/v1/folders/space/:spaceId/folders
router.get('/space/:spaceId/folders', authenticate, async (req: Request, res: Response) => {
  const folders = await foldersService.getFolders(req.params.spaceId, req.user!.id);
  res.json({ success: true, data: folders });
});

// POST /api/v1/folders/space/:spaceId/folders
router.post('/space/:spaceId/folders', authenticate, validate(createFolderSchema), async (req: Request, res: Response) => {
  const folder = await foldersService.createFolder(req.params.spaceId, req.user!.id, req.body);
  res.status(201).json({ success: true, data: folder });
});

// GET /api/v1/folders/:folderId
router.get('/:folderId', authenticate, async (req: Request, res: Response) => {
  const folder = await foldersService.getFolderById(req.params.folderId, req.user!.id);
  res.json({ success: true, data: folder });
});

// PATCH /api/v1/folders/:folderId
router.patch('/:folderId', authenticate, validate(updateFolderSchema), async (req: Request, res: Response) => {
  const folder = await foldersService.updateFolder(req.params.folderId, req.user!.id, req.body);
  res.json({ success: true, data: folder });
});

// DELETE /api/v1/folders/:folderId
router.delete('/:folderId', authenticate, async (req: Request, res: Response) => {
  await foldersService.deleteFolder(req.params.folderId, req.user!.id);
  res.json({ success: true, data: { message: 'Folder deleted' } });
});

// PATCH /api/v1/folders/:folderId/position
router.patch('/:folderId/position', authenticate, validate(updatePositionSchema), async (req: Request, res: Response) => {
  const folder = await foldersService.updatePosition(req.params.folderId, req.body.position);
  res.json({ success: true, data: folder });
});

// ==========================================
// Subfolders
// ==========================================

// POST /api/v1/folders/:folderId/subfolders
router.post('/:folderId/subfolders', authenticate, validate(createFolderSchema), async (req: Request, res: Response) => {
  const subfolder = await foldersService.createSubfolder(req.params.folderId, req.user!.id, req.body);
  res.status(201).json({ success: true, data: subfolder });
});

// GET /api/v1/folders/:folderId/subfolders
router.get('/:folderId/subfolders', authenticate, async (req: Request, res: Response) => {
  const subfolders = await foldersService.getSubfolders(req.params.folderId);
  res.json({ success: true, data: subfolders });
});

// ==========================================
// Folder Statuses
// ==========================================

// GET /api/v1/folders/:folderId/statuses
router.get('/:folderId/statuses', authenticate, async (req: Request, res: Response) => {
  const statuses = await foldersService.getEffectiveFolderStatuses(req.params.folderId);
  res.json({ success: true, data: statuses });
});

// POST /api/v1/folders/:folderId/statuses
router.post('/:folderId/statuses', authenticate, validate(createFolderStatusSchema), async (req: Request, res: Response) => {
  const status = await foldersService.createFolderStatus(req.params.folderId, req.body);
  res.status(201).json({ success: true, data: status });
});

// PATCH /api/v1/folders/folder-statuses/:statusId
router.patch('/folder-statuses/:statusId', authenticate, validate(updateFolderStatusSchema), async (req: Request, res: Response) => {
  const status = await foldersService.updateFolderStatus(req.params.statusId, req.body);
  res.json({ success: true, data: status });
});

// DELETE /api/v1/folders/folder-statuses/:statusId
router.delete('/folder-statuses/:statusId', authenticate, async (req: Request, res: Response) => {
  await foldersService.deleteFolderStatus(req.params.statusId);
  res.json({ success: true, data: { deleted: true } });
});

// ==========================================
// Move
// ==========================================

// PATCH /api/v1/folders/:folderId/move
router.patch('/:folderId/move', authenticate, validate(moveFolderSchema), async (req: Request, res: Response) => {
  const folder = await foldersService.moveFolder(req.params.folderId, req.user!.id, req.body);
  res.json({ success: true, data: folder });
});

export default router;
