import { Router, Request, Response } from 'express';
import { meetingsService } from './meetings.service';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { createMeetingSchema, updateMeetingSchema, meetingChatSchema } from './meetings.schema';

const router = Router();

// GET /api/v1/meetings
router.get('/', authenticate, async (req: Request, res: Response) => {
  const status = req.query.status as string | undefined;
  const meetings = await meetingsService.getMeetings(req.user!.id, status);
  res.json({ success: true, data: meetings });
});

// POST /api/v1/meetings
router.post('/', authenticate, validate(createMeetingSchema), async (req: Request, res: Response) => {
  const meeting = await meetingsService.createMeeting(req.user!.id, req.body);
  res.status(201).json({ success: true, data: meeting });
});

// GET /api/v1/meetings/:meetingCode
router.get('/:meetingCode', authenticate, async (req: Request, res: Response) => {
  const meeting = await meetingsService.getMeeting(req.params.meetingCode);
  res.json({ success: true, data: meeting });
});

// PATCH /api/v1/meetings/:meetingCode
router.patch('/:meetingCode', authenticate, validate(updateMeetingSchema), async (req: Request, res: Response) => {
  const meeting = await meetingsService.updateMeeting(req.user!.id, req.params.meetingCode, req.body);
  res.json({ success: true, data: meeting });
});

// POST /api/v1/meetings/:meetingCode/join
router.post('/:meetingCode/join', authenticate, async (req: Request, res: Response) => {
  const password = req.body.password;
  const result = await meetingsService.joinMeeting(req.user!.id, req.params.meetingCode, password);
  res.json({ success: true, data: result });
});

// POST /api/v1/meetings/:meetingCode/leave
router.post('/:meetingCode/leave', authenticate, async (req: Request, res: Response) => {
  await meetingsService.leaveMeeting(req.user!.id, req.params.meetingCode);
  res.json({ success: true, data: { left: true } });
});

// POST /api/v1/meetings/:meetingCode/end
router.post('/:meetingCode/end', authenticate, async (req: Request, res: Response) => {
  const meeting = await meetingsService.endMeeting(req.user!.id, req.params.meetingCode);
  res.json({ success: true, data: meeting });
});

// GET /api/v1/meetings/:meetingCode/participants
router.get('/:meetingCode/participants', authenticate, async (req: Request, res: Response) => {
  const participants = await meetingsService.getActiveParticipants(req.params.meetingCode);
  res.json({ success: true, data: participants });
});

// POST /api/v1/meetings/:meetingCode/chat
router.post('/:meetingCode/chat', authenticate, validate(meetingChatSchema), async (req: Request, res: Response) => {
  const message = await meetingsService.sendChatMessage(req.user!.id, req.params.meetingCode, req.body.message);
  res.status(201).json({ success: true, data: message });
});

// GET /api/v1/meetings/:meetingCode/chat
router.get('/:meetingCode/chat', authenticate, async (req: Request, res: Response) => {
  const messages = await meetingsService.getChatMessages(req.params.meetingCode);
  res.json({ success: true, data: messages });
});

export default router;
