import { Router, Request, Response } from 'express';
import { syncUpsService } from './syncups.service';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { startSyncUpSchema, toggleMediaSchema } from './syncups.validation';

const router = Router();

// ==========================================
// SyncUps (Video/Audio in Chat)
// Route prefix: /api/v1/workspace/channels/:channelId/syncups
// ==========================================

// POST /channels/:channelId/syncups/start — start SyncUp
router.post('/channels/:channelId/syncups/start', authenticate, validate(startSyncUpSchema), async (req: Request, res: Response) => {
  const syncUp = await syncUpsService.startSyncUp(req.params.channelId, req.user!.id, req.body.title);
  res.status(201).json({ success: true, data: syncUp });
});

// GET /channels/:channelId/syncups/active — check for active SyncUp
router.get('/channels/:channelId/syncups/active', authenticate, async (req: Request, res: Response) => {
  const syncUp = await syncUpsService.getActiveSyncUp(req.params.channelId);
  res.json({ success: true, data: syncUp });
});

// POST /channels/:channelId/syncups/:syncUpId/join — join
router.post('/channels/:channelId/syncups/:syncUpId/join', authenticate, async (req: Request, res: Response) => {
  const syncUp = await syncUpsService.joinSyncUp(req.params.syncUpId, req.user!.id);
  res.json({ success: true, data: syncUp });
});

// POST /channels/:channelId/syncups/:syncUpId/leave — leave
router.post('/channels/:channelId/syncups/:syncUpId/leave', authenticate, async (req: Request, res: Response) => {
  const syncUp = await syncUpsService.leaveSyncUp(req.params.syncUpId, req.user!.id);
  res.json({ success: true, data: syncUp });
});

// POST /channels/:channelId/syncups/:syncUpId/end — end
router.post('/channels/:channelId/syncups/:syncUpId/end', authenticate, async (req: Request, res: Response) => {
  const syncUp = await syncUpsService.endSyncUp(req.params.syncUpId, req.user!.id);
  res.json({ success: true, data: syncUp });
});

// GET /channels/:channelId/syncups/:syncUpId — get details
router.get('/channels/:channelId/syncups/:syncUpId', authenticate, async (req: Request, res: Response) => {
  const syncUp = await syncUpsService.getSyncUp(req.params.syncUpId);
  res.json({ success: true, data: syncUp });
});

// GET /channels/:channelId/syncups/:syncUpId/participants — list participants
router.get('/channels/:channelId/syncups/:syncUpId/participants', authenticate, async (req: Request, res: Response) => {
  const participants = await syncUpsService.getParticipants(req.params.syncUpId);
  res.json({ success: true, data: participants });
});

// POST /channels/:channelId/syncups/:syncUpId/recording/start — start recording
router.post('/channels/:channelId/syncups/:syncUpId/recording/start', authenticate, async (req: Request, res: Response) => {
  const syncUp = await syncUpsService.startRecording(req.params.syncUpId);
  res.json({ success: true, data: syncUp });
});

// POST /channels/:channelId/syncups/:syncUpId/recording/stop — stop recording
router.post('/channels/:channelId/syncups/:syncUpId/recording/stop', authenticate, async (req: Request, res: Response) => {
  const syncUp = await syncUpsService.stopRecording(req.params.syncUpId);
  res.json({ success: true, data: syncUp });
});

// POST /channels/:channelId/syncups/:syncUpId/audio — toggle audio
router.post('/channels/:channelId/syncups/:syncUpId/audio', authenticate, validate(toggleMediaSchema), async (req: Request, res: Response) => {
  const participant = await syncUpsService.toggleAudio(req.params.syncUpId, req.user!.id, req.body.enabled);
  res.json({ success: true, data: participant });
});

// POST /channels/:channelId/syncups/:syncUpId/video — toggle video
router.post('/channels/:channelId/syncups/:syncUpId/video', authenticate, validate(toggleMediaSchema), async (req: Request, res: Response) => {
  const participant = await syncUpsService.toggleVideo(req.params.syncUpId, req.user!.id, req.body.enabled);
  res.json({ success: true, data: participant });
});

export default router;
