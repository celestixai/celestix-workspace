import { z } from 'zod';

export const createMeetingSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  scheduledAt: z.string().datetime().optional(),
  durationMinutes: z.number().min(5).max(480).optional(),
  isRecurring: z.boolean().optional().default(false),
  recurrenceRule: z.string().optional(),
  password: z.string().max(20).optional(),
  attendeeIds: z.array(z.string().uuid()).optional(),
});

export const updateMeetingSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  scheduledAt: z.string().datetime().optional(),
  durationMinutes: z.number().min(5).max(480).optional(),
  password: z.string().max(20).optional(),
  isLocked: z.boolean().optional(),
});

export const meetingChatSchema = z.object({
  message: z.string().min(1).max(2000),
});

// --- Recording ---

// No body needed for start/stop recording (meetingCode comes from params)

// --- Transcription ---

// No body needed for start/stop transcription

// --- Breakout Rooms ---

export const createBreakoutRoomsSchema = z.object({
  rooms: z.array(
    z.object({
      name: z.string().min(1).max(100),
    })
  ).min(1).max(50),
  autoAssign: z.boolean().optional().default(false),
});

export const assignBreakoutRoomSchema = z.object({
  userIds: z.array(z.string().uuid()).min(1),
});

// --- Whiteboard ---

export const createWhiteboardSchema = z.object({
  title: z.string().min(1).max(200).optional().default('Meeting Whiteboard'),
});

export const updateWhiteboardSchema = z.object({
  elements: z.array(z.record(z.unknown())).optional(),
  background: z.string().max(100).optional(),
  snapshot: z.string().optional(),
});

// --- Reactions & Hand Raise ---

export const reactionSchema = z.object({
  emoji: z.string().min(1).max(10),
});

// No body needed for hand-raise toggle

// --- Polls ---

export const createPollSchema = z.object({
  question: z.string().min(1).max(500),
  options: z.array(z.string().min(1).max(200)).min(2).max(20),
  allowMultiple: z.boolean().optional().default(false),
  anonymous: z.boolean().optional().default(false),
});

export const votePollSchema = z.object({
  optionIndices: z.array(z.number().int().min(0)).min(1),
});

// --- Meeting Settings & Controls ---

export const updateMeetingSettingsSchema = z.object({
  muteAll: z.boolean().optional(),
  isLocked: z.boolean().optional(),
  waitingRoomEnabled: z.boolean().optional(),
  allowScreenShare: z.boolean().optional(),
  allowChat: z.boolean().optional(),
});

export type CreateMeetingInput = z.infer<typeof createMeetingSchema>;
