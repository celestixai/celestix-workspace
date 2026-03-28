import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { filesService } from './files.service';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { uploadLimiter } from '../../middleware/rate-limit';
import {
  createFolderSchema,
  renameFileSchema,
  moveFileSchema,
  shareFileSchema,
  filesQuerySchema,
  bulkOperationSchema,
} from './files.schema';
import { config } from '../../config';
import { prisma } from '../../config/database';
import {
  isSupabaseConfigured,
  uploadFile as supabaseUpload,
  getSignedUrl,
} from '../../config/supabase-storage';

const router = Router();

// File upload config — use memoryStorage for Supabase, fall back to disk for local dev
const fileUpload = multer(
  isSupabaseConfigured()
    ? {
        storage: multer.memoryStorage(),
        limits: { fileSize: config.storage.maxFileSize },
      }
    : {
        storage: multer.diskStorage({
          destination: (req, _file, cb) => {
            const dir = path.resolve(config.storage.path, 'users', req.user!.id);
            fs.mkdirSync(dir, { recursive: true });
            cb(null, dir);
          },
          filename: (_req, file, cb) => {
            const ext = path.extname(file.originalname);
            cb(null, `${uuidv4()}${ext}`);
          },
        }),
        limits: { fileSize: config.storage.maxFileSize },
      },
);

// GET /api/v1/files
router.get('/', authenticate, validate(filesQuerySchema, 'query'), async (req: Request, res: Response) => {
  const result = await filesService.getFiles(req.user!.id, req.query as never);
  res.json({ success: true, data: result.files, pagination: result.pagination });
});

// POST /api/v1/files/folders
router.post('/folders', authenticate, validate(createFolderSchema), async (req: Request, res: Response) => {
  const folder = await filesService.createFolder(req.user!.id, req.body);
  res.status(201).json({ success: true, data: folder });
});

// POST /api/v1/files/upload
router.post('/upload', authenticate, uploadLimiter, fileUpload.single('file'), async (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ success: false, error: 'No file uploaded' });
    return;
  }

  const parentFolderId = req.body.parentFolderId || null;

  // When Supabase is configured, upload buffer there and synthesize the multer fields the service expects
  if (isSupabaseConfigured() && req.file.buffer) {
    const ext = path.extname(req.file.originalname);
    const filename = `${uuidv4()}${ext}`;
    const storagePath = `users/${req.user!.id}/${filename}`;
    await supabaseUpload(storagePath, req.file.buffer, req.file.mimetype);
    // Provide the fields filesService.uploadFile expects
    (req.file as any).filename = filename;
    (req.file as any).path = storagePath; // not used but keeps compat
  }

  const file = await filesService.uploadFile(req.user!.id, req.file as any, parentFolderId);
  res.status(201).json({ success: true, data: file });
});

// POST /api/v1/files/upload-multiple
router.post('/upload-multiple', authenticate, uploadLimiter, fileUpload.array('files', 20), async (req: Request, res: Response) => {
  const files = req.files as Express.Multer.File[];
  if (!files?.length) {
    res.status(400).json({ success: false, error: 'No files uploaded' });
    return;
  }
  const parentFolderId = req.body.parentFolderId || null;

  // Upload each file to Supabase if configured
  if (isSupabaseConfigured()) {
    for (const f of files) {
      if (f.buffer) {
        const ext = path.extname(f.originalname);
        const filename = `${uuidv4()}${ext}`;
        const storagePath = `users/${req.user!.id}/${filename}`;
        await supabaseUpload(storagePath, f.buffer, f.mimetype);
        (f as any).filename = filename;
        (f as any).path = storagePath;
      }
    }
  }

  const results = await Promise.all(
    files.map((f) => filesService.uploadFile(req.user!.id, f as any, parentFolderId))
  );
  res.status(201).json({ success: true, data: results });
});

// GET /api/v1/files/:fileId/download
router.get('/:fileId/download', authenticate, async (req: Request, res: Response) => {
  const file = await filesService.getFile(req.user!.id, req.params.fileId);
  if (!file.storagePath || file.type === 'FOLDER') {
    res.status(400).json({ success: false, error: 'Cannot download a folder' });
    return;
  }

  // Use signed URL redirect when Supabase is configured
  if (isSupabaseConfigured()) {
    const supaPath = file.storagePath.replace(/^\//, '');
    const signedUrl = await getSignedUrl(supaPath, 3600);
    res.redirect(signedUrl);
    return;
  }

  // Fallback: serve from local disk
  const filePath = path.resolve(config.storage.path, file.storagePath.replace(/^\//, ''));
  res.download(filePath, file.name);
});

// GET /api/v1/files/:fileId
router.get('/:fileId', authenticate, async (req: Request, res: Response) => {
  const file = await filesService.getFile(req.user!.id, req.params.fileId);
  res.json({ success: true, data: file });
});

// PATCH /api/v1/files/:fileId/rename
router.patch('/:fileId/rename', authenticate, validate(renameFileSchema), async (req: Request, res: Response) => {
  const file = await filesService.renameFile(req.user!.id, req.params.fileId, req.body.name);
  res.json({ success: true, data: file });
});

// PATCH /api/v1/files/:fileId/move
router.patch('/:fileId/move', authenticate, validate(moveFileSchema), async (req: Request, res: Response) => {
  const file = await filesService.moveFile(req.user!.id, req.params.fileId, req.body.parentFolderId);
  res.json({ success: true, data: file });
});

// POST /api/v1/files/:fileId/star
router.post('/:fileId/star', authenticate, async (req: Request, res: Response) => {
  const file = await filesService.toggleStar(req.user!.id, req.params.fileId);
  res.json({ success: true, data: file });
});

// DELETE /api/v1/files/:fileId
router.delete('/:fileId', authenticate, async (req: Request, res: Response) => {
  const permanent = req.query.permanent === 'true';
  if (permanent) {
    await filesService.permanentDelete(req.user!.id, req.params.fileId);
  } else {
    await filesService.trashFile(req.user!.id, req.params.fileId);
  }
  res.json({ success: true, data: { deleted: true } });
});

// POST /api/v1/files/:fileId/restore
router.post('/:fileId/restore', authenticate, async (req: Request, res: Response) => {
  const file = await filesService.restoreFile(req.user!.id, req.params.fileId);
  res.json({ success: true, data: file });
});

// POST /api/v1/files/:fileId/share
router.post('/:fileId/share', authenticate, validate(shareFileSchema), async (req: Request, res: Response) => {
  const share = await filesService.shareFile(req.user!.id, req.params.fileId, req.body);
  res.json({ success: true, data: share });
});

// GET /api/v1/files/shared/:token
router.get('/shared/:token', async (req: Request, res: Response) => {
  const password = req.query.password as string | undefined;
  const file = await filesService.getSharedFile(req.params.token, password);
  res.json({ success: true, data: file });
});

// POST /api/v1/files/:fileId/versions
router.post('/:fileId/versions', authenticate, uploadLimiter, fileUpload.single('file'), async (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ success: false, error: 'No file uploaded' });
    return;
  }

  if (isSupabaseConfigured() && req.file.buffer) {
    const ext = path.extname(req.file.originalname);
    const filename = `${uuidv4()}${ext}`;
    const storagePath = `users/${req.user!.id}/${filename}`;
    await supabaseUpload(storagePath, req.file.buffer, req.file.mimetype);
    (req.file as any).filename = filename;
  }

  const result = await filesService.uploadNewVersion(req.user!.id, req.params.fileId, req.file);
  res.json({ success: true, data: result });
});

// GET /api/v1/files/:fileId/versions
router.get('/:fileId/versions', authenticate, async (req: Request, res: Response) => {
  const versions = await filesService.getVersions(req.user!.id, req.params.fileId);
  res.json({ success: true, data: versions });
});

// GET /api/v1/files/breadcrumbs/:folderId
router.get('/breadcrumbs/:folderId', authenticate, async (req: Request, res: Response) => {
  const crumbs = await filesService.getBreadcrumbs(req.user!.id, req.params.folderId);
  res.json({ success: true, data: crumbs });
});

// POST /api/v1/files/bulk
router.post('/bulk', authenticate, validate(bulkOperationSchema), async (req: Request, res: Response) => {
  const result = await filesService.bulkOperation(
    req.user!.id,
    req.body.fileIds,
    req.body.action,
    req.body.targetFolderId
  );
  res.json({ success: true, data: result });
});

// GET /api/v1/files/storage/usage
router.get('/storage/usage', authenticate, async (req: Request, res: Response) => {
  const usage = await filesService.getStorageUsage(req.user!.id);
  res.json({ success: true, data: usage });
});

// File comments
router.get('/:fileId/comments', authenticate, async (req, res, next) => {
  try {
    // Using a generic approach since we don't have a dedicated FileComment model
    // Store comments as notifications with type and metadata
    const comments = await prisma.notification.findMany({
      where: {
        type: 'FILE_SHARED',
        metadata: { path: ['fileId'], equals: req.params.fileId },
      },
      orderBy: { createdAt: 'desc' },
      include: { sender: { select: { id: true, displayName: true, avatarUrl: true } } },
    });
    res.json({ success: true, data: comments });
  } catch (err) { next(err); }
});

// File activity/history
router.get('/:fileId/activity', authenticate, async (req, res, next) => {
  try {
    const versions = await prisma.fileVersion.findMany({
      where: { fileId: req.params.fileId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    const shares = await prisma.fileShare.findMany({
      where: { fileId: req.params.fileId },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: { versions, shares } });
  } catch (err) { next(err); }
});

// Recycle bin (trashed files)
router.get('/trash/list', authenticate, async (req, res, next) => {
  try {
    const trashedFiles = await prisma.file.findMany({
      where: { userId: req.user!.id, isTrashed: true },
      orderBy: { trashedAt: 'desc' },
    });
    res.json({ success: true, data: trashedFiles });
  } catch (err) { next(err); }
});

router.post('/:fileId/restore', authenticate, async (req, res, next) => {
  try {
    const file = await prisma.file.update({
      where: { id: req.params.fileId, userId: req.user!.id },
      data: { isTrashed: false, trashedAt: null },
    });
    res.json({ success: true, data: file });
  } catch (err) { next(err); }
});

router.delete('/:fileId/permanent', authenticate, async (req, res, next) => {
  try {
    await prisma.file.delete({
      where: { id: req.params.fileId, userId: req.user!.id, isTrashed: true },
    });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// Empty trash
router.delete('/trash/empty', authenticate, async (req, res, next) => {
  try {
    await prisma.file.deleteMany({
      where: { userId: req.user!.id, isTrashed: true },
    });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// Request file upload link (for external users)
router.post('/request-upload', authenticate, async (req, res, next) => {
  try {
    const { folderId, description } = req.body;
    const token = require('crypto').randomUUID();
    const share = await prisma.fileShare.create({
      data: {
        fileId: folderId || req.user!.id, // use folderId or user's root
        permission: 'EDIT',
        shareLinkToken: `upload-${token}`,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });
    res.json({ success: true, data: { uploadToken: share.shareLinkToken, expiresAt: share.expiresAt } });
  } catch (err) { next(err); }
});

// Share link with expiry
router.post('/:fileId/share-link', authenticate, async (req, res, next) => {
  try {
    const { permission, expiryDays } = req.body;
    const token = require('crypto').randomUUID();
    const share = await prisma.fileShare.create({
      data: {
        fileId: req.params.fileId,
        permission: permission || 'VIEW',
        shareLinkToken: token,
        expiresAt: expiryDays ? new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000) : null,
      },
    });
    res.json({ success: true, data: share });
  } catch (err) { next(err); }
});

export default router;
