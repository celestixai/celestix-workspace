import { Router, Request, Response } from 'express';
import { notesService } from './notes.service';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import {
  createNoteSchema,
  updateNoteSchema,
  createFolderSchema,
  updateFolderSchema,
  shareNoteSchema,
  createTagSchema,
  notesQuerySchema,
} from './notes.schema';

const router = Router();

// GET /api/v1/notes
router.get('/', authenticate, validate(notesQuerySchema, 'query'), async (req: Request, res: Response) => {
  const result = await notesService.getNotes(req.user!.id, req.query as never);
  res.json({ success: true, data: result.notes, pagination: result.pagination });
});

// POST /api/v1/notes
router.post('/', authenticate, validate(createNoteSchema), async (req: Request, res: Response) => {
  const note = await notesService.createNote(req.user!.id, req.body);
  res.status(201).json({ success: true, data: note });
});

// GET /api/v1/notes/templates
router.get('/templates', authenticate, async (_req: Request, res: Response) => {
  const templates = await notesService.getTemplates();
  res.json({ success: true, data: templates });
});

// GET /api/v1/notes/folders
router.get('/folders', authenticate, async (req: Request, res: Response) => {
  const folders = await notesService.getFolders(req.user!.id);
  res.json({ success: true, data: folders });
});

// POST /api/v1/notes/folders
router.post('/folders', authenticate, validate(createFolderSchema), async (req: Request, res: Response) => {
  const folder = await notesService.createFolder(req.user!.id, req.body);
  res.status(201).json({ success: true, data: folder });
});

// PATCH /api/v1/notes/folders/:folderId
router.patch('/folders/:folderId', authenticate, validate(updateFolderSchema), async (req: Request, res: Response) => {
  const folder = await notesService.updateFolder(req.user!.id, req.params.folderId, req.body);
  res.json({ success: true, data: folder });
});

// DELETE /api/v1/notes/folders/:folderId
router.delete('/folders/:folderId', authenticate, async (req: Request, res: Response) => {
  await notesService.deleteFolder(req.user!.id, req.params.folderId);
  res.json({ success: true, data: { deleted: true } });
});

// GET /api/v1/notes/tags
router.get('/tags', authenticate, async (req: Request, res: Response) => {
  const tags = await notesService.getTags(req.user!.id);
  res.json({ success: true, data: tags });
});

// POST /api/v1/notes/tags
router.post('/tags', authenticate, validate(createTagSchema), async (req: Request, res: Response) => {
  const tag = await notesService.createTag(req.user!.id, req.body);
  res.status(201).json({ success: true, data: tag });
});

// DELETE /api/v1/notes/tags/:tagId
router.delete('/tags/:tagId', authenticate, async (req: Request, res: Response) => {
  await notesService.deleteTag(req.user!.id, req.params.tagId);
  res.json({ success: true, data: { deleted: true } });
});

// GET /api/v1/notes/:noteId
router.get('/:noteId', authenticate, async (req: Request, res: Response) => {
  const note = await notesService.getNote(req.user!.id, req.params.noteId);
  res.json({ success: true, data: note });
});

// PATCH /api/v1/notes/:noteId
router.patch('/:noteId', authenticate, validate(updateNoteSchema), async (req: Request, res: Response) => {
  const note = await notesService.updateNote(req.user!.id, req.params.noteId, req.body);
  res.json({ success: true, data: note });
});

// DELETE /api/v1/notes/:noteId
router.delete('/:noteId', authenticate, async (req: Request, res: Response) => {
  await notesService.deleteNote(req.user!.id, req.params.noteId);
  res.json({ success: true, data: { deleted: true } });
});

// POST /api/v1/notes/:noteId/restore
router.post('/:noteId/restore', authenticate, async (req: Request, res: Response) => {
  const note = await notesService.restoreNote(req.user!.id, req.params.noteId);
  res.json({ success: true, data: note });
});

// GET /api/v1/notes/:noteId/versions/:versionId
router.get('/:noteId/versions/:versionId', authenticate, async (req: Request, res: Response) => {
  const version = await notesService.getVersion(req.user!.id, req.params.noteId, req.params.versionId);
  res.json({ success: true, data: version });
});

// POST /api/v1/notes/:noteId/versions/:versionId/restore
router.post('/:noteId/versions/:versionId/restore', authenticate, async (req: Request, res: Response) => {
  const note = await notesService.restoreVersion(req.user!.id, req.params.noteId, req.params.versionId);
  res.json({ success: true, data: note });
});

// POST /api/v1/notes/:noteId/tags/:tagId
router.post('/:noteId/tags/:tagId', authenticate, async (req: Request, res: Response) => {
  const link = await notesService.addTag(req.user!.id, req.params.noteId, req.params.tagId);
  res.json({ success: true, data: link });
});

// DELETE /api/v1/notes/:noteId/tags/:tagId
router.delete('/:noteId/tags/:tagId', authenticate, async (req: Request, res: Response) => {
  await notesService.removeTag(req.params.noteId, req.params.tagId);
  res.json({ success: true, data: { removed: true } });
});

// POST /api/v1/notes/:noteId/share
router.post('/:noteId/share', authenticate, validate(shareNoteSchema), async (req: Request, res: Response) => {
  const share = await notesService.shareNote(req.user!.id, req.params.noteId, req.body);
  res.json({ success: true, data: share });
});

// GET /api/v1/notes/shared/:token (public)
router.get('/shared/:token', async (req: Request, res: Response) => {
  const note = await notesService.getSharedNote(req.params.token);
  res.json({ success: true, data: note });
});

export default router;
