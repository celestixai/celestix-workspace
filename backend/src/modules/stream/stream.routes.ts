import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { streamService } from './stream.service';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import {
  createVideoSchema,
  updateVideoSchema,
  createChannelSchema,
  createCommentSchema,
  createPlaylistSchema,
  updatePlaylistSchema,
} from './stream.schema';
import { config } from '../../config';

const router = Router();

// Video upload config — disk storage to storage/videos/
const videoUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      const dir = path.resolve(config.storage.path, 'videos');
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

// ==================================
// VIDEO ROUTES
// ==================================

// GET /api/v1/stream/videos — List videos (with search query param)
router.get('/videos', authenticate, async (req: Request, res: Response) => {
  const query = {
    search: req.query.search as string | undefined,
    channelId: req.query.channelId as string | undefined,
    privacy: req.query.privacy as string | undefined,
  };
  const videos = await streamService.getAll(req.user!.id, query);
  res.json({ success: true, data: videos });
});

// POST /api/v1/stream/videos — Upload video (multipart form)
router.post('/videos', authenticate, videoUpload.single('video'), async (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ success: false, error: 'No video file uploaded' });
    return;
  }

  // Parse metadata from the form body
  let metadata: Record<string, unknown> = {};
  if (req.body.metadata) {
    try {
      metadata = JSON.parse(req.body.metadata);
    } catch {
      // If metadata is not JSON, use individual fields
    }
  }

  const input = createVideoSchema.parse({
    title: metadata.title || req.body.title || req.file.originalname,
    description: metadata.description || req.body.description,
    channelId: metadata.channelId || req.body.channelId,
    tags: metadata.tags || (req.body.tags ? JSON.parse(req.body.tags) : undefined),
    privacy: metadata.privacy || req.body.privacy,
    chapters: metadata.chapters || (req.body.chapters ? JSON.parse(req.body.chapters) : undefined),
  });

  const storagePath = `/videos/${req.file.filename}`;
  const video = await streamService.create(req.user!.id, input, storagePath);
  res.status(201).json({ success: true, data: video });
});

// GET /api/v1/stream/videos/:id — Get video
router.get('/videos/:id', authenticate, async (req: Request, res: Response) => {
  const video = await streamService.getById(req.params.id);
  res.json({ success: true, data: video });
});

// PATCH /api/v1/stream/videos/:id — Update video metadata
router.patch('/videos/:id', authenticate, validate(updateVideoSchema), async (req: Request, res: Response) => {
  const video = await streamService.update(req.user!.id, req.params.id, req.body);
  res.json({ success: true, data: video });
});

// DELETE /api/v1/stream/videos/:id — Delete video
router.delete('/videos/:id', authenticate, async (req: Request, res: Response) => {
  await streamService.delete(req.user!.id, req.params.id);
  res.json({ success: true, data: { message: 'Video deleted' } });
});

// POST /api/v1/stream/videos/:id/view — Record view
router.post('/videos/:id/view', authenticate, async (req: Request, res: Response) => {
  const watchedSeconds = req.body.watchedSeconds ?? 0;
  const view = await streamService.recordView(req.params.id, req.user!.id, watchedSeconds);
  res.json({ success: true, data: view });
});

// ==================================
// COMMENT ROUTES
// ==================================

// GET /api/v1/stream/videos/:id/comments — Get comments
router.get('/videos/:id/comments', authenticate, async (req: Request, res: Response) => {
  const comments = await streamService.getComments(req.params.id);
  res.json({ success: true, data: comments });
});

// POST /api/v1/stream/videos/:id/comments — Add comment
router.post('/videos/:id/comments', authenticate, validate(createCommentSchema), async (req: Request, res: Response) => {
  const comment = await streamService.addComment(req.user!.id, req.params.id, req.body);
  res.status(201).json({ success: true, data: comment });
});

// DELETE /api/v1/stream/comments/:id — Delete comment
router.delete('/comments/:id', authenticate, async (req: Request, res: Response) => {
  await streamService.deleteComment(req.user!.id, req.params.id);
  res.json({ success: true, data: { message: 'Comment deleted' } });
});

// ==================================
// CHANNEL ROUTES
// ==================================

// GET /api/v1/stream/channels — List channels
router.get('/channels', authenticate, async (req: Request, res: Response) => {
  const channels = await streamService.getChannels(req.user!.id);
  res.json({ success: true, data: channels });
});

// POST /api/v1/stream/channels — Create channel
router.post('/channels', authenticate, validate(createChannelSchema), async (req: Request, res: Response) => {
  const channel = await streamService.createChannel(req.user!.id, req.body);
  res.status(201).json({ success: true, data: channel });
});

// GET /api/v1/stream/channels/:id — Get channel with videos
router.get('/channels/:id', authenticate, async (req: Request, res: Response) => {
  const channel = await streamService.getChannelById(req.params.id);
  res.json({ success: true, data: channel });
});

// ==================================
// PLAYLIST ROUTES
// ==================================

// GET /api/v1/stream/playlists — My playlists
router.get('/playlists', authenticate, async (req: Request, res: Response) => {
  const playlists = await streamService.getPlaylists(req.user!.id);
  res.json({ success: true, data: playlists });
});

// POST /api/v1/stream/playlists — Create playlist
router.post('/playlists', authenticate, validate(createPlaylistSchema), async (req: Request, res: Response) => {
  const playlist = await streamService.createPlaylist(req.user!.id, req.body);
  res.status(201).json({ success: true, data: playlist });
});

// PATCH /api/v1/stream/playlists/:id — Update playlist
router.patch('/playlists/:id', authenticate, validate(updatePlaylistSchema), async (req: Request, res: Response) => {
  const playlist = await streamService.updatePlaylist(req.user!.id, req.params.id, req.body);
  res.json({ success: true, data: playlist });
});

// DELETE /api/v1/stream/playlists/:id — Delete playlist
router.delete('/playlists/:id', authenticate, async (req: Request, res: Response) => {
  await streamService.deletePlaylist(req.user!.id, req.params.id);
  res.json({ success: true, data: { message: 'Playlist deleted' } });
});

export default router;
