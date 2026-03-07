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

const router = Router();

// File upload config
const fileUpload = multer({
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
});

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
  const file = await filesService.uploadFile(req.user!.id, req.file, parentFolderId);
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
  const results = await Promise.all(
    files.map((f) => filesService.uploadFile(req.user!.id, f, parentFolderId))
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

export default router;
