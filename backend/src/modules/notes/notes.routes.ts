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
import { prisma } from '../../config/database';

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

// Note backlinks - find notes that reference this note
router.get('/:noteId/backlinks', authenticate, async (req, res, next) => {
  try {
    // Search for notes that contain a link to this note ID in their content
    const allNotes = await prisma.note.findMany({
      where: { userId: req.user!.id, deletedAt: null },
      select: { id: true, title: true, contentText: true, updatedAt: true },
    });
    const backlinks = allNotes.filter(n =>
      n.id !== req.params.noteId &&
      n.contentText?.includes(req.params.noteId)
    );
    res.json({ success: true, data: backlinks });
  } catch (err) { next(err); }
});

// Favorites
router.get('/favorites/list', authenticate, async (req, res, next) => {
  try {
    const favorites = await prisma.note.findMany({
      where: { userId: req.user!.id, isStarred: true, deletedAt: null },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, title: true, isPinned: true, isStarred: true, updatedAt: true, folderId: true },
    });
    res.json({ success: true, data: favorites });
  } catch (err) { next(err); }
});

// Toggle favorite
router.post('/:noteId/favorite', authenticate, async (req, res, next) => {
  try {
    const note = await prisma.note.findUnique({ where: { id: req.params.noteId } });
    if (!note) return res.status(404).json({ success: false, error: 'Note not found' });
    const updated = await prisma.note.update({
      where: { id: req.params.noteId },
      data: { isStarred: !note.isStarred },
    });
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
});

// Lock/unlock note
router.post('/:noteId/lock', authenticate, async (req, res, next) => {
  try {
    const note = await prisma.note.findUnique({ where: { id: req.params.noteId } });
    if (!note) return res.status(404).json({ success: false, error: 'Note not found' });
    const updated = await prisma.note.update({
      where: { id: req.params.noteId },
      data: { isPinned: !note.isPinned }, // Reusing isPinned as locked state for simplicity
    });
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
});

// Import from markdown
router.post('/import-markdown', authenticate, async (req, res, next) => {
  try {
    const { title, markdown, folderId } = req.body;
    const note = await prisma.note.create({
      data: {
        userId: req.user!.id,
        title: title || 'Imported Note',
        contentText: markdown,
        contentJson: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: markdown }] }] },
        folderId: folderId || null,
      },
    });
    res.json({ success: true, data: note });
  } catch (err) { next(err); }
});

// Duplicate note
router.post('/:noteId/duplicate', authenticate, async (req, res, next) => {
  try {
    const original = await prisma.note.findUnique({ where: { id: req.params.noteId, userId: req.user!.id } });
    if (!original) return res.status(404).json({ success: false, error: 'Note not found' });
    const duplicate = await prisma.note.create({
      data: {
        userId: req.user!.id,
        title: `${original.title} (copy)`,
        contentJson: original.contentJson || undefined,
        contentText: original.contentText,
        folderId: original.folderId,
      },
    });
    res.json({ success: true, data: duplicate });
  } catch (err) { next(err); }
});

// Sub-pages (children)
router.get('/:noteId/children', authenticate, async (req, res, next) => {
  try {
    const children = await prisma.note.findMany({
      where: { parentNoteId: req.params.noteId, userId: req.user!.id, deletedAt: null },
      orderBy: { createdAt: 'asc' },
      select: { id: true, title: true, updatedAt: true },
    });
    res.json({ success: true, data: children });
  } catch (err) { next(err); }
});

router.post('/:noteId/children', authenticate, async (req, res, next) => {
  try {
    const { title } = req.body;
    const child = await prisma.note.create({
      data: {
        userId: req.user!.id,
        title: title || 'Untitled',
        parentNoteId: req.params.noteId,
      },
    });
    res.json({ success: true, data: child });
  } catch (err) { next(err); }
});

export default router;
