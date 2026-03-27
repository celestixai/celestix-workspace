import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { clipsService } from './clips.service';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { updateClipSchema } from './clips.validation';
import { config } from '../../config';
import type { ClipType } from '@prisma/client';

const router = Router();

// Multer config — disk storage to storage/clips/
const clipUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      const dir = path.resolve(config.storage.path, 'clips');
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

// GET /api/v1/clips/workspace/:workspaceId — list clips
router.get('/workspace/:workspaceId', authenticate, async (req: Request, res: Response) => {
  const filters = {
    type: req.query.type as ClipType | undefined,
    userId: req.query.userId as string | undefined,
    search: req.query.search as string | undefined,
  };
  const clips = await clipsService.getClips(req.params.workspaceId, filters);
  res.json({ success: true, data: clips });
});

// POST /api/v1/clips/upload — upload clip (multipart)
router.post('/upload', authenticate, clipUpload.single('file'), async (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ success: false, error: 'No file uploaded' });
    return;
  }

  let metadata: Record<string, unknown> = {};
  if (req.body.metadata) {
    try {
      metadata = JSON.parse(req.body.metadata);
    } catch {
      // Use individual fields
    }
  }

  const title = (metadata.title as string) || req.body.title || req.file.originalname;
  const type = (metadata.type as ClipType) || req.body.type || 'VOICE_CLIP';
  const duration = metadata.duration ?? req.body.duration;
  const workspaceId = (metadata.workspaceId as string) || req.body.workspaceId;

  if (!workspaceId) {
    res.status(400).json({ success: false, error: 'workspaceId is required' });
    return;
  }

  const storagePath = `clips/${req.file.filename}`;
  const clip = await clipsService.uploadClip(workspaceId, req.user!.id, storagePath, {
    title,
    type,
    duration: duration ? Number(duration) : undefined,
    mimeType: req.file.mimetype,
    fileSize: req.file.size,
  });

  res.status(201).json({ success: true, data: clip });
});

// GET /api/v1/clips/hub/:workspaceId — clips hub with stats
router.get('/hub/:workspaceId', authenticate, async (req: Request, res: Response) => {
  const hub = await clipsService.getClipsHub(req.params.workspaceId, req.user!.id);
  res.json({ success: true, data: hub });
});

// GET /api/v1/clips/:clipId — get clip details
router.get('/:clipId', authenticate, async (req: Request, res: Response) => {
  const clip = await clipsService.getClip(req.params.clipId);
  res.json({ success: true, data: clip });
});

// PATCH /api/v1/clips/:clipId — update clip
router.patch('/:clipId', authenticate, validate(updateClipSchema), async (req: Request, res: Response) => {
  const clip = await clipsService.updateClip(req.params.clipId, req.user!.id, req.body);
  res.json({ success: true, data: clip });
});

// DELETE /api/v1/clips/:clipId — delete clip
router.delete('/:clipId', authenticate, async (req: Request, res: Response) => {
  const result = await clipsService.deleteClip(req.params.clipId, req.user!.id);
  res.json({ success: true, data: result });
});

// GET /api/v1/clips/:clipId/stream — stream for playback
router.get('/:clipId/stream', async (req: Request, res: Response) => {
  const { filePath, mimeType, fileSize } = await clipsService.streamClip(req.params.clipId);
  const stat = fs.statSync(filePath);
  const size = fileSize ? Number(fileSize) : stat.size;

  // Support range requests
  const range = req.headers.range;
  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : size - 1;
    const chunkSize = end - start + 1;

    const stream = fs.createReadStream(filePath, { start, end });
    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${size}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunkSize,
      'Content-Type': mimeType,
    });
    stream.pipe(res);
  } else {
    res.writeHead(200, {
      'Content-Length': size,
      'Content-Type': mimeType,
    });
    fs.createReadStream(filePath).pipe(res);
  }
});

// POST /api/v1/clips/:clipId/share — make public
router.post('/:clipId/share', authenticate, async (req: Request, res: Response) => {
  const result = await clipsService.shareClip(req.params.clipId, req.user!.id);
  res.json({ success: true, data: result });
});

export default router;
