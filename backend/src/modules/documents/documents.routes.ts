import { Router, Request, Response } from 'express';
import multer from 'multer';
import { documentService } from './documents.service';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import {
  createDocumentSchema,
  updateDocumentSchema,
  createCommentSchema,
  updateCommentSchema,
  addCollaboratorSchema,
  createVersionSchema,
  exportDocumentSchema,
  importDocumentSchema,
} from './documents.schema';

const router = Router();

// ==========================================
// DOCUMENT CRUD
// ==========================================

// GET /api/v1/documents
router.get('/', authenticate, async (req: Request, res: Response) => {
  const documents = await documentService.getAll(req.user!.id);
  res.json({ success: true, data: documents });
});

// POST /api/v1/documents
router.post('/', authenticate, validate(createDocumentSchema), async (req: Request, res: Response) => {
  const document = await documentService.create(req.user!.id, req.body);
  res.status(201).json({ success: true, data: document });
});

// POST /api/v1/documents/import
router.post('/import', authenticate, validate(importDocumentSchema), async (req: Request, res: Response) => {
  const document = await documentService.import(req.user!.id, req.body);
  res.status(201).json({ success: true, data: document });
});

// ==========================================
// COMMENT STANDALONE ROUTES (must precede /:documentId)
// ==========================================

// PATCH /api/v1/documents/comments/:commentId
router.patch('/comments/:commentId', authenticate, validate(updateCommentSchema), async (req: Request, res: Response) => {
  // Update text is effectively handled by the delete + re-add pattern,
  // but we provide a direct update for convenience
  const comment = await documentService.addComment(req.user!.id, req.params.commentId, {
    text: req.body.text,
  });
  res.json({ success: true, data: comment });
});

// DELETE /api/v1/documents/comments/:commentId
router.delete('/comments/:commentId', authenticate, async (req: Request, res: Response) => {
  await documentService.deleteComment(req.user!.id, req.params.commentId);
  res.json({ success: true, data: { message: 'Comment deleted' } });
});

// POST /api/v1/documents/comments/:commentId/resolve
router.post('/comments/:commentId/resolve', authenticate, async (req: Request, res: Response) => {
  const comment = await documentService.resolveComment(req.user!.id, req.params.commentId);
  res.json({ success: true, data: comment });
});

// ==========================================
// DOCUMENT DETAIL ROUTES (/:documentId)
// ==========================================

// GET /api/v1/documents/:documentId
router.get('/:documentId', authenticate, async (req: Request, res: Response) => {
  const document = await documentService.getById(req.user!.id, req.params.documentId);
  res.json({ success: true, data: document });
});

// PATCH /api/v1/documents/:documentId
router.patch('/:documentId', authenticate, validate(updateDocumentSchema), async (req: Request, res: Response) => {
  const document = await documentService.update(req.user!.id, req.params.documentId, req.body);
  res.json({ success: true, data: document });
});

// DELETE /api/v1/documents/:documentId
router.delete('/:documentId', authenticate, async (req: Request, res: Response) => {
  await documentService.delete(req.user!.id, req.params.documentId);
  res.json({ success: true, data: { message: 'Document deleted' } });
});

// ==========================================
// VERSION ROUTES
// ==========================================

// GET /api/v1/documents/:documentId/versions
router.get('/:documentId/versions', authenticate, async (req: Request, res: Response) => {
  const versions = await documentService.getVersions(req.user!.id, req.params.documentId);
  res.json({ success: true, data: versions });
});

// POST /api/v1/documents/:documentId/versions
router.post('/:documentId/versions', authenticate, validate(createVersionSchema), async (req: Request, res: Response) => {
  const version = await documentService.createVersion(req.user!.id, req.params.documentId, req.body);
  res.status(201).json({ success: true, data: version });
});

// POST /api/v1/documents/:documentId/versions/:versionId/restore
router.post('/:documentId/versions/:versionId/restore', authenticate, async (req: Request, res: Response) => {
  const document = await documentService.restoreVersion(req.user!.id, req.params.documentId, req.params.versionId);
  res.json({ success: true, data: document });
});

// ==========================================
// COMMENT ROUTES (document-scoped)
// ==========================================

// GET /api/v1/documents/:documentId/comments
router.get('/:documentId/comments', authenticate, async (req: Request, res: Response) => {
  const comments = await documentService.getComments(req.user!.id, req.params.documentId);
  res.json({ success: true, data: comments });
});

// POST /api/v1/documents/:documentId/comments
router.post('/:documentId/comments', authenticate, validate(createCommentSchema), async (req: Request, res: Response) => {
  const comment = await documentService.addComment(req.user!.id, req.params.documentId, req.body);
  res.status(201).json({ success: true, data: comment });
});

// ==========================================
// COLLABORATOR ROUTES
// ==========================================

// GET /api/v1/documents/:documentId/collaborators
router.get('/:documentId/collaborators', authenticate, async (req: Request, res: Response) => {
  const collaborators = await documentService.getCollaborators(req.user!.id, req.params.documentId);
  res.json({ success: true, data: collaborators });
});

// POST /api/v1/documents/:documentId/collaborators
router.post('/:documentId/collaborators', authenticate, validate(addCollaboratorSchema), async (req: Request, res: Response) => {
  const collaborator = await documentService.addCollaborator(req.user!.id, req.params.documentId, req.body);
  res.status(201).json({ success: true, data: collaborator });
});

// DELETE /api/v1/documents/:documentId/collaborators/:userId
router.delete('/:documentId/collaborators/:userId', authenticate, async (req: Request, res: Response) => {
  await documentService.removeCollaborator(req.user!.id, req.params.documentId, req.params.userId);
  res.json({ success: true, data: { message: 'Collaborator removed' } });
});

// ==========================================
// EXPORT
// ==========================================

// POST /api/v1/documents/:documentId/export
router.post('/:documentId/export', authenticate, validate(exportDocumentSchema), async (req: Request, res: Response) => {
  const result = await documentService.export(req.user!.id, req.params.documentId, req.body);
  res.json({ success: true, data: result });
});

// ==========================================
// DOCUMENT CONVERSION (LibreOffice)
// ==========================================

const convUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });

// POST /api/v1/documents/convert — Convert file to another format
router.post('/convert', authenticate, convUpload.single('file'), async (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ success: false, error: 'No file uploaded' });
    return;
  }
  const { format } = req.body; // e.g., 'pdf', 'docx', 'xlsx'
  if (!format) {
    res.status(400).json({ success: false, error: 'Target format is required' });
    return;
  }

  try {
    const { convertFile } = await import('../../services/libreoffice');
    const result = await convertFile(req.file.buffer, req.file.originalname, format);
    const mimeTypes: Record<string, string> = {
      pdf: 'application/pdf',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    };
    const baseName = req.file.originalname.replace(/\.[^.]+$/, '');
    res.setHeader('Content-Type', mimeTypes[format] || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${baseName}.${format}"`);
    res.send(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Conversion failed';
    res.status(500).json({ success: false, error: msg });
  }
});

export default router;
