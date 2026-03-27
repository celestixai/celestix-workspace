import { Router, Request, Response } from 'express';
import { meetingsService } from './meetings.service';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import {
  createMeetingSchema,
  updateMeetingSchema,
  meetingChatSchema,
  createBreakoutRoomsSchema,
  assignBreakoutRoomSchema,
  createWhiteboardSchema,
  updateWhiteboardSchema,
  reactionSchema,
  createPollSchema,
  votePollSchema,
  updateMeetingSettingsSchema,
} from './meetings.schema';

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

// =============================================
//  RECORDING
// =============================================

// POST /api/v1/meetings/:meetingCode/recording/start
router.post('/:meetingCode/recording/start', authenticate, async (req: Request, res: Response) => {
  const recording = await meetingsService.startRecording(req.user!.id, req.params.meetingCode);
  res.json({ success: true, data: recording });
});

// POST /api/v1/meetings/:meetingCode/recording/stop
router.post('/:meetingCode/recording/stop', authenticate, async (req: Request, res: Response) => {
  const recording = await meetingsService.stopRecording(req.user!.id, req.params.meetingCode);
  res.json({ success: true, data: recording });
});

// GET /api/v1/meetings/:meetingCode/recordings
router.get('/:meetingCode/recordings', authenticate, async (req: Request, res: Response) => {
  const recordings = await meetingsService.getRecordings(req.params.meetingCode);
  res.json({ success: true, data: recordings });
});

// =============================================
//  TRANSCRIPTION
// =============================================

// POST /api/v1/meetings/:meetingCode/transcription/start
router.post('/:meetingCode/transcription/start', authenticate, async (req: Request, res: Response) => {
  const result = await meetingsService.startTranscription(req.user!.id, req.params.meetingCode);
  res.json({ success: true, data: result });
});

// POST /api/v1/meetings/:meetingCode/transcription/stop
router.post('/:meetingCode/transcription/stop', authenticate, async (req: Request, res: Response) => {
  const result = await meetingsService.stopTranscription(req.user!.id, req.params.meetingCode);
  res.json({ success: true, data: result });
});

// GET /api/v1/meetings/:meetingCode/transcript
router.get('/:meetingCode/transcript', authenticate, async (req: Request, res: Response) => {
  const transcript = await meetingsService.getTranscript(req.params.meetingCode);
  res.json({ success: true, data: transcript });
});

// =============================================
//  BREAKOUT ROOMS
// =============================================

// POST /api/v1/meetings/:meetingCode/breakout-rooms
router.post(
  '/:meetingCode/breakout-rooms',
  authenticate,
  validate(createBreakoutRoomsSchema),
  async (req: Request, res: Response) => {
    const rooms = await meetingsService.createBreakoutRooms(
      req.user!.id,
      req.params.meetingCode,
      req.body.rooms,
      req.body.autoAssign
    );
    res.status(201).json({ success: true, data: rooms });
  }
);

// POST /api/v1/meetings/:meetingCode/breakout-rooms/:roomId/assign
router.post(
  '/:meetingCode/breakout-rooms/:roomId/assign',
  authenticate,
  validate(assignBreakoutRoomSchema),
  async (req: Request, res: Response) => {
    const room = await meetingsService.assignBreakoutRoom(
      req.user!.id,
      req.params.meetingCode,
      req.params.roomId,
      req.body.userIds
    );
    res.json({ success: true, data: room });
  }
);

// POST /api/v1/meetings/:meetingCode/breakout-rooms/close
router.post('/:meetingCode/breakout-rooms/close', authenticate, async (req: Request, res: Response) => {
  const result = await meetingsService.closeBreakoutRooms(req.user!.id, req.params.meetingCode);
  res.json({ success: true, data: result });
});

// GET /api/v1/meetings/:meetingCode/breakout-rooms
router.get('/:meetingCode/breakout-rooms', authenticate, async (req: Request, res: Response) => {
  const rooms = await meetingsService.getBreakoutRooms(req.params.meetingCode);
  res.json({ success: true, data: rooms });
});

// =============================================
//  WHITEBOARD
// =============================================

// POST /api/v1/meetings/:meetingCode/whiteboard
router.post(
  '/:meetingCode/whiteboard',
  authenticate,
  validate(createWhiteboardSchema),
  async (req: Request, res: Response) => {
    const wb = await meetingsService.createOrGetWhiteboard(
      req.user!.id,
      req.params.meetingCode,
      req.body.title
    );
    res.json({ success: true, data: wb });
  }
);

// GET /api/v1/meetings/:meetingCode/whiteboard
router.get('/:meetingCode/whiteboard', authenticate, async (req: Request, res: Response) => {
  const wb = await meetingsService.getWhiteboard(req.params.meetingCode);
  res.json({ success: true, data: wb });
});

// PATCH /api/v1/meetings/:meetingCode/whiteboard
router.patch(
  '/:meetingCode/whiteboard',
  authenticate,
  validate(updateWhiteboardSchema),
  async (req: Request, res: Response) => {
    const wb = await meetingsService.updateWhiteboard(req.params.meetingCode, req.body);
    res.json({ success: true, data: wb });
  }
);

// =============================================
//  REACTIONS & HAND RAISE
// =============================================

// POST /api/v1/meetings/:meetingCode/reaction
router.post(
  '/:meetingCode/reaction',
  authenticate,
  validate(reactionSchema),
  async (req: Request, res: Response) => {
    const reaction = await meetingsService.sendReaction(
      req.user!.id,
      req.params.meetingCode,
      req.body.emoji
    );
    res.json({ success: true, data: reaction });
  }
);

// POST /api/v1/meetings/:meetingCode/hand-raise
router.post('/:meetingCode/hand-raise', authenticate, async (req: Request, res: Response) => {
  const result = await meetingsService.toggleHandRaise(req.user!.id, req.params.meetingCode);
  res.json({ success: true, data: result });
});

// GET /api/v1/meetings/:meetingCode/raised-hands
router.get('/:meetingCode/raised-hands', authenticate, async (req: Request, res: Response) => {
  const hands = await meetingsService.getRaisedHands(req.params.meetingCode);
  res.json({ success: true, data: hands });
});

// =============================================
//  POLLS
// =============================================

// POST /api/v1/meetings/:meetingCode/polls
router.post(
  '/:meetingCode/polls',
  authenticate,
  validate(createPollSchema),
  async (req: Request, res: Response) => {
    const poll = await meetingsService.createPoll(req.user!.id, req.params.meetingCode, req.body);
    res.status(201).json({ success: true, data: poll });
  }
);

// GET /api/v1/meetings/:meetingCode/polls
router.get('/:meetingCode/polls', authenticate, async (req: Request, res: Response) => {
  const polls = await meetingsService.getPolls(req.params.meetingCode);
  res.json({ success: true, data: polls });
});

// POST /api/v1/meetings/:meetingCode/polls/:pollId/vote
router.post(
  '/:meetingCode/polls/:pollId/vote',
  authenticate,
  validate(votePollSchema),
  async (req: Request, res: Response) => {
    const poll = await meetingsService.votePoll(
      req.user!.id,
      req.params.meetingCode,
      req.params.pollId,
      req.body.optionIndices
    );
    res.json({ success: true, data: poll });
  }
);

// POST /api/v1/meetings/:meetingCode/polls/:pollId/end
router.post('/:meetingCode/polls/:pollId/end', authenticate, async (req: Request, res: Response) => {
  const poll = await meetingsService.endPoll(req.user!.id, req.params.meetingCode, req.params.pollId);
  res.json({ success: true, data: poll });
});

// =============================================
//  SETTINGS & CONTROLS
// =============================================

// PATCH /api/v1/meetings/:meetingCode/settings
router.patch(
  '/:meetingCode/settings',
  authenticate,
  validate(updateMeetingSettingsSchema),
  async (req: Request, res: Response) => {
    const settings = await meetingsService.updateMeetingSettings(
      req.user!.id,
      req.params.meetingCode,
      req.body
    );
    res.json({ success: true, data: settings });
  }
);

// POST /api/v1/meetings/:meetingCode/kick/:userId
router.post('/:meetingCode/kick/:userId', authenticate, async (req: Request, res: Response) => {
  const result = await meetingsService.kickParticipant(
    req.user!.id,
    req.params.meetingCode,
    req.params.userId
  );
  res.json({ success: true, data: result });
});

// POST /api/v1/meetings/:meetingCode/mute/:userId
router.post('/:meetingCode/mute/:userId', authenticate, async (req: Request, res: Response) => {
  const result = await meetingsService.muteParticipant(
    req.user!.id,
    req.params.meetingCode,
    req.params.userId
  );
  res.json({ success: true, data: result });
});

export default router;
