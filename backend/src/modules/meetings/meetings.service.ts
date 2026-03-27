import { prisma } from '../../config/database';
import { AppError } from '../../middleware/error-handler';
import type { CreateMeetingInput } from './meetings.schema';

function generateMeetingCode(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let code = '';
  for (let i = 0; i < 10; i++) {
    if (i === 3 || i === 7) code += '-';
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// --- In-memory stores for ephemeral meeting features ---

interface Recording {
  id: string;
  meetingCode: string;
  startedAt: string;
  stoppedAt: string | null;
  startedBy: string;
  status: 'recording' | 'stopped' | 'processing' | 'ready';
  url: string | null;
  durationMs: number | null;
}

interface TranscriptionState {
  active: boolean;
  startedAt: string | null;
  startedBy: string | null;
  entries: Array<{
    userId: string;
    displayName: string;
    text: string;
    timestamp: string;
  }>;
}

interface BreakoutRoom {
  id: string;
  name: string;
  participants: string[];
  createdAt: string;
}

interface WhiteboardState {
  title: string;
  elements: Record<string, unknown>[];
  background: string;
  createdAt: string;
  updatedAt: string;
}

interface Poll {
  id: string;
  question: string;
  options: string[];
  allowMultiple: boolean;
  anonymous: boolean;
  createdBy: string;
  createdAt: string;
  endedAt: string | null;
  status: 'active' | 'ended';
  votes: Map<string, number[]>; // userId -> optionIndices
}

interface RaisedHand {
  userId: string;
  raisedAt: string;
}

// Maps keyed by meetingCode
const recordingsStore = new Map<string, Recording[]>();
const transcriptionStore = new Map<string, TranscriptionState>();
const breakoutRoomsStore = new Map<string, BreakoutRoom[]>();
const whiteboardStore = new Map<string, WhiteboardState>();
const pollsStore = new Map<string, Poll[]>();
const raisedHandsStore = new Map<string, RaisedHand[]>();
const meetingSettingsStore = new Map<string, Record<string, unknown>>();

function generateId(): string {
  return Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
}

export class MeetingsService {
  async createMeeting(userId: string, input: CreateMeetingInput) {
    const meetingCode = generateMeetingCode();

    const meeting = await prisma.meeting.create({
      data: {
        hostUserId: userId,
        title: input.title,
        description: input.description,
        meetingCode,
        scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : undefined,
        durationMinutes: input.durationMinutes,
        isRecurring: input.isRecurring,
        recurrenceRule: input.recurrenceRule,
        password: input.password,
      },
      include: {
        host: { select: { id: true, displayName: true, avatarUrl: true } },
      },
    });

    const { password: _, ...safeMeeting } = meeting;
    return { ...safeMeeting, hasPassword: !!meeting.password };
  }

  async getMeetings(userId: string, status?: string) {
    const where: Record<string, unknown> = {
      OR: [
        { hostUserId: userId },
        { participants: { some: { userId } } },
      ],
    };

    if (status) where.status = status;

    const meetings = await prisma.meeting.findMany({
      where,
      include: {
        host: { select: { id: true, displayName: true, avatarUrl: true } },
        participants: {
          include: { user: { select: { id: true, displayName: true, avatarUrl: true } } },
        },
        _count: { select: { chatMessages: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Strip passwords from all meetings
    return meetings.map((m) => {
      const { password: _, ...safe } = m;
      return { ...safe, hasPassword: !!m.password };
    });
  }

  async getMeeting(meetingCode: string) {
    const meeting = await prisma.meeting.findUnique({
      where: { meetingCode },
      include: {
        host: { select: { id: true, displayName: true, avatarUrl: true } },
        participants: {
          include: { user: { select: { id: true, displayName: true, avatarUrl: true } } },
        },
      },
    });

    if (!meeting) throw new AppError(404, 'Meeting not found', 'NOT_FOUND');
    // Never expose password in API responses
    const { password: _, ...safeMeeting } = meeting;
    return { ...safeMeeting, hasPassword: !!meeting.password };
  }

  async joinMeeting(userId: string, meetingCode: string, password?: string) {
    const meeting = await prisma.meeting.findUnique({ where: { meetingCode } });
    if (!meeting) throw new AppError(404, 'Meeting not found', 'NOT_FOUND');

    if (meeting.isLocked && meeting.hostUserId !== userId) {
      throw new AppError(403, 'Meeting is locked', 'MEETING_LOCKED');
    }

    if (meeting.password && meeting.password !== password && meeting.hostUserId !== userId) {
      throw new AppError(401, 'Invalid meeting password', 'INVALID_PASSWORD');
    }

    // Start meeting if not yet started
    let updatedMeeting = meeting;
    if (meeting.status === 'scheduled') {
      updatedMeeting = await prisma.meeting.update({
        where: { id: meeting.id },
        data: { status: 'active', startedAt: new Date() },
      });
    }

    // Find or create participant (avoid invalid UUID in upsert)
    const existing = await prisma.meetingParticipant.findFirst({
      where: { meetingId: meeting.id, userId },
    });

    let participant;
    if (existing) {
      participant = await prisma.meetingParticipant.update({
        where: { id: existing.id },
        data: { leftAt: null, joinedAt: new Date() },
      });
    } else {
      participant = await prisma.meetingParticipant.create({
        data: {
          meetingId: meeting.id,
          userId,
          role: meeting.hostUserId === userId ? 'host' : 'participant',
        },
      });
    }

    // Strip password from response
    const { password: _, ...safeMeeting } = updatedMeeting;
    return { meeting: { ...safeMeeting, hasPassword: !!meeting.password }, participant };
  }

  async leaveMeeting(userId: string, meetingCode: string) {
    const meeting = await prisma.meeting.findUnique({ where: { meetingCode } });
    if (!meeting) throw new AppError(404, 'Meeting not found', 'NOT_FOUND');

    await prisma.meetingParticipant.updateMany({
      where: { meetingId: meeting.id, userId, leftAt: null },
      data: { leftAt: new Date() },
    });

    // Check if all participants have left
    const activeCount = await prisma.meetingParticipant.count({
      where: { meetingId: meeting.id, leftAt: null },
    });

    if (activeCount === 0 && meeting.status === 'active') {
      await prisma.meeting.update({
        where: { id: meeting.id },
        data: { status: 'ended', endedAt: new Date() },
      });
    }
  }

  async endMeeting(userId: string, meetingCode: string) {
    const meeting = await prisma.meeting.findUnique({ where: { meetingCode } });
    if (!meeting) throw new AppError(404, 'Meeting not found', 'NOT_FOUND');
    if (meeting.hostUserId !== userId) {
      throw new AppError(403, 'Only host can end the meeting', 'FORBIDDEN');
    }

    // Mark all participants as left
    await prisma.meetingParticipant.updateMany({
      where: { meetingId: meeting.id, leftAt: null },
      data: { leftAt: new Date() },
    });

    return prisma.meeting.update({
      where: { id: meeting.id },
      data: { status: 'ended', endedAt: new Date() },
    });
  }

  async updateMeeting(userId: string, meetingCode: string, data: Record<string, unknown>) {
    const meeting = await prisma.meeting.findUnique({ where: { meetingCode } });
    if (!meeting) throw new AppError(404, 'Meeting not found', 'NOT_FOUND');
    if (meeting.hostUserId !== userId) {
      throw new AppError(403, 'Only host can update meeting', 'FORBIDDEN');
    }

    return prisma.meeting.update({ where: { id: meeting.id }, data: data as never });
  }

  async sendChatMessage(userId: string, meetingCode: string, message: string) {
    const meeting = await prisma.meeting.findUnique({ where: { meetingCode } });
    if (!meeting) throw new AppError(404, 'Meeting not found', 'NOT_FOUND');

    return prisma.meetingChat.create({
      data: {
        meetingId: meeting.id,
        userId,
        message,
      },
    });
  }

  async getChatMessages(meetingCode: string) {
    const meeting = await prisma.meeting.findUnique({ where: { meetingCode } });
    if (!meeting) throw new AppError(404, 'Meeting not found', 'NOT_FOUND');

    return prisma.meetingChat.findMany({
      where: { meetingId: meeting.id },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getActiveParticipants(meetingCode: string) {
    const meeting = await prisma.meeting.findUnique({ where: { meetingCode } });
    if (!meeting) throw new AppError(404, 'Meeting not found', 'NOT_FOUND');

    return prisma.meetingParticipant.findMany({
      where: { meetingId: meeting.id, leftAt: null },
      include: { user: { select: { id: true, displayName: true, avatarUrl: true } } },
    });
  }

  // =============================================
  //  RECORDING
  // =============================================

  private async assertHost(userId: string, meetingCode: string) {
    const meeting = await prisma.meeting.findUnique({ where: { meetingCode } });
    if (!meeting) throw new AppError(404, 'Meeting not found', 'NOT_FOUND');
    if (meeting.hostUserId !== userId) {
      throw new AppError(403, 'Only the host can perform this action', 'FORBIDDEN');
    }
    return meeting;
  }

  private async assertMeetingExists(meetingCode: string) {
    const meeting = await prisma.meeting.findUnique({ where: { meetingCode } });
    if (!meeting) throw new AppError(404, 'Meeting not found', 'NOT_FOUND');
    return meeting;
  }

  async startRecording(userId: string, meetingCode: string) {
    await this.assertHost(userId, meetingCode);

    const recordings = recordingsStore.get(meetingCode) || [];
    const activeRecording = recordings.find((r) => r.status === 'recording');
    if (activeRecording) {
      throw new AppError(409, 'Recording is already in progress', 'RECORDING_ACTIVE');
    }

    const recording: Recording = {
      id: generateId(),
      meetingCode,
      startedAt: new Date().toISOString(),
      stoppedAt: null,
      startedBy: userId,
      status: 'recording',
      url: null,
      durationMs: null,
    };

    recordings.push(recording);
    recordingsStore.set(meetingCode, recordings);

    return recording;
  }

  async stopRecording(userId: string, meetingCode: string) {
    await this.assertHost(userId, meetingCode);

    const recordings = recordingsStore.get(meetingCode) || [];
    const activeRecording = recordings.find((r) => r.status === 'recording');
    if (!activeRecording) {
      throw new AppError(404, 'No active recording found', 'NO_ACTIVE_RECORDING');
    }

    activeRecording.status = 'stopped';
    activeRecording.stoppedAt = new Date().toISOString();
    activeRecording.durationMs =
      new Date(activeRecording.stoppedAt).getTime() - new Date(activeRecording.startedAt).getTime();

    return activeRecording;
  }

  async getRecordings(meetingCode: string) {
    await this.assertMeetingExists(meetingCode);
    return recordingsStore.get(meetingCode) || [];
  }

  // =============================================
  //  TRANSCRIPTION
  // =============================================

  async startTranscription(userId: string, meetingCode: string) {
    await this.assertHost(userId, meetingCode);

    let state = transcriptionStore.get(meetingCode);
    if (state?.active) {
      throw new AppError(409, 'Transcription is already active', 'TRANSCRIPTION_ACTIVE');
    }

    state = {
      active: true,
      startedAt: new Date().toISOString(),
      startedBy: userId,
      entries: state?.entries || [],
    };
    transcriptionStore.set(meetingCode, state);

    return { active: state.active, startedAt: state.startedAt, startedBy: state.startedBy };
  }

  async stopTranscription(userId: string, meetingCode: string) {
    await this.assertHost(userId, meetingCode);

    const state = transcriptionStore.get(meetingCode);
    if (!state?.active) {
      throw new AppError(404, 'Transcription is not active', 'TRANSCRIPTION_NOT_ACTIVE');
    }

    state.active = false;

    return { active: false, totalEntries: state.entries.length };
  }

  async getTranscript(meetingCode: string) {
    await this.assertMeetingExists(meetingCode);

    const state = transcriptionStore.get(meetingCode);
    return {
      active: state?.active || false,
      startedAt: state?.startedAt || null,
      entries: state?.entries || [],
    };
  }

  // =============================================
  //  BREAKOUT ROOMS
  // =============================================

  async createBreakoutRooms(
    userId: string,
    meetingCode: string,
    rooms: Array<{ name: string }>,
    autoAssign: boolean
  ) {
    const meeting = await this.assertHost(userId, meetingCode);

    const breakoutRooms: BreakoutRoom[] = rooms.map((r) => ({
      id: generateId(),
      name: r.name,
      participants: [],
      createdAt: new Date().toISOString(),
    }));

    // If autoAssign, distribute active participants across rooms
    if (autoAssign) {
      const participants = await prisma.meetingParticipant.findMany({
        where: { meetingId: meeting.id, leftAt: null },
      });

      const nonHostParticipants = participants.filter((p) => p.userId !== userId);
      nonHostParticipants.forEach((p, i) => {
        const roomIndex = i % breakoutRooms.length;
        breakoutRooms[roomIndex].participants.push(p.userId);
      });
    }

    breakoutRoomsStore.set(meetingCode, breakoutRooms);

    return breakoutRooms;
  }

  async assignBreakoutRoom(userId: string, meetingCode: string, roomId: string, userIds: string[]) {
    await this.assertHost(userId, meetingCode);

    const rooms = breakoutRoomsStore.get(meetingCode);
    if (!rooms || rooms.length === 0) {
      throw new AppError(404, 'No breakout rooms found', 'NO_BREAKOUT_ROOMS');
    }

    const room = rooms.find((r) => r.id === roomId);
    if (!room) {
      throw new AppError(404, 'Breakout room not found', 'BREAKOUT_ROOM_NOT_FOUND');
    }

    // Remove these users from any other room first
    for (const r of rooms) {
      r.participants = r.participants.filter((uid) => !userIds.includes(uid));
    }

    // Assign to target room
    room.participants.push(...userIds);

    return room;
  }

  async closeBreakoutRooms(userId: string, meetingCode: string) {
    await this.assertHost(userId, meetingCode);

    const rooms = breakoutRoomsStore.get(meetingCode);
    if (!rooms || rooms.length === 0) {
      throw new AppError(404, 'No breakout rooms found', 'NO_BREAKOUT_ROOMS');
    }

    breakoutRoomsStore.delete(meetingCode);

    return { closed: true, roomsClosed: rooms.length };
  }

  async getBreakoutRooms(meetingCode: string) {
    await this.assertMeetingExists(meetingCode);
    return breakoutRoomsStore.get(meetingCode) || [];
  }

  // =============================================
  //  WHITEBOARD
  // =============================================

  async createOrGetWhiteboard(userId: string, meetingCode: string, title?: string) {
    await this.assertMeetingExists(meetingCode);

    let wb = whiteboardStore.get(meetingCode);
    if (!wb) {
      wb = {
        title: title || 'Meeting Whiteboard',
        elements: [],
        background: '#ffffff',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      whiteboardStore.set(meetingCode, wb);
    }

    return wb;
  }

  async getWhiteboard(meetingCode: string) {
    await this.assertMeetingExists(meetingCode);

    const wb = whiteboardStore.get(meetingCode);
    if (!wb) {
      throw new AppError(404, 'No whiteboard found for this meeting', 'WHITEBOARD_NOT_FOUND');
    }

    return wb;
  }

  async updateWhiteboard(
    meetingCode: string,
    data: { elements?: Record<string, unknown>[]; background?: string; snapshot?: string }
  ) {
    await this.assertMeetingExists(meetingCode);

    const wb = whiteboardStore.get(meetingCode);
    if (!wb) {
      throw new AppError(404, 'No whiteboard found for this meeting', 'WHITEBOARD_NOT_FOUND');
    }

    if (data.elements !== undefined) wb.elements = data.elements;
    if (data.background !== undefined) wb.background = data.background;
    wb.updatedAt = new Date().toISOString();

    return wb;
  }

  // =============================================
  //  REACTIONS & HAND RAISE
  // =============================================

  async sendReaction(userId: string, meetingCode: string, emoji: string) {
    await this.assertMeetingExists(meetingCode);

    const reaction = {
      userId,
      emoji,
      timestamp: new Date().toISOString(),
    };

    // Reactions are fire-and-forget; return it for broadcast via WebSocket
    return reaction;
  }

  async toggleHandRaise(userId: string, meetingCode: string) {
    await this.assertMeetingExists(meetingCode);

    const hands = raisedHandsStore.get(meetingCode) || [];
    const existingIndex = hands.findIndex((h) => h.userId === userId);

    let raised: boolean;
    if (existingIndex >= 0) {
      hands.splice(existingIndex, 1);
      raised = false;
    } else {
      hands.push({ userId, raisedAt: new Date().toISOString() });
      raised = true;
    }

    raisedHandsStore.set(meetingCode, hands);

    return { userId, raised };
  }

  async getRaisedHands(meetingCode: string) {
    await this.assertMeetingExists(meetingCode);
    return raisedHandsStore.get(meetingCode) || [];
  }

  // =============================================
  //  POLLS
  // =============================================

  async createPoll(
    userId: string,
    meetingCode: string,
    data: { question: string; options: string[]; allowMultiple: boolean; anonymous: boolean }
  ) {
    await this.assertHost(userId, meetingCode);

    const polls = pollsStore.get(meetingCode) || [];

    const poll: Poll = {
      id: generateId(),
      question: data.question,
      options: data.options,
      allowMultiple: data.allowMultiple,
      anonymous: data.anonymous,
      createdBy: userId,
      createdAt: new Date().toISOString(),
      endedAt: null,
      status: 'active',
      votes: new Map(),
    };

    polls.push(poll);
    pollsStore.set(meetingCode, polls);

    return this.serializePoll(poll);
  }

  async getPolls(meetingCode: string) {
    await this.assertMeetingExists(meetingCode);

    const polls = pollsStore.get(meetingCode) || [];
    return polls.map((p) => this.serializePoll(p));
  }

  async votePoll(userId: string, meetingCode: string, pollId: string, optionIndices: number[]) {
    await this.assertMeetingExists(meetingCode);

    const polls = pollsStore.get(meetingCode) || [];
    const poll = polls.find((p) => p.id === pollId);
    if (!poll) throw new AppError(404, 'Poll not found', 'POLL_NOT_FOUND');
    if (poll.status === 'ended') throw new AppError(400, 'Poll has ended', 'POLL_ENDED');

    // Validate option indices
    for (const idx of optionIndices) {
      if (idx < 0 || idx >= poll.options.length) {
        throw new AppError(400, `Invalid option index: ${idx}`, 'INVALID_OPTION');
      }
    }

    if (!poll.allowMultiple && optionIndices.length > 1) {
      throw new AppError(400, 'This poll only allows a single vote', 'SINGLE_VOTE_ONLY');
    }

    poll.votes.set(userId, optionIndices);

    return this.serializePoll(poll);
  }

  async endPoll(userId: string, meetingCode: string, pollId: string) {
    await this.assertHost(userId, meetingCode);

    const polls = pollsStore.get(meetingCode) || [];
    const poll = polls.find((p) => p.id === pollId);
    if (!poll) throw new AppError(404, 'Poll not found', 'POLL_NOT_FOUND');
    if (poll.status === 'ended') throw new AppError(400, 'Poll already ended', 'POLL_ALREADY_ENDED');

    poll.status = 'ended';
    poll.endedAt = new Date().toISOString();

    return this.serializePoll(poll);
  }

  private serializePoll(poll: Poll) {
    // Tally votes per option
    const results = poll.options.map((_, idx) => {
      let count = 0;
      poll.votes.forEach((indices) => {
        if (indices.includes(idx)) count++;
      });
      return count;
    });

    return {
      id: poll.id,
      question: poll.question,
      options: poll.options,
      allowMultiple: poll.allowMultiple,
      anonymous: poll.anonymous,
      createdBy: poll.createdBy,
      createdAt: poll.createdAt,
      endedAt: poll.endedAt,
      status: poll.status,
      totalVotes: poll.votes.size,
      results,
      // Include voter breakdown only if not anonymous
      ...(poll.anonymous
        ? {}
        : { voters: Object.fromEntries(poll.votes) }),
    };
  }

  // =============================================
  //  SETTINGS & CONTROLS
  // =============================================

  async updateMeetingSettings(userId: string, meetingCode: string, settings: Record<string, unknown>) {
    const meeting = await this.assertHost(userId, meetingCode);

    // Persist isLocked to the database
    if (settings.isLocked !== undefined) {
      await prisma.meeting.update({
        where: { id: meeting.id },
        data: { isLocked: settings.isLocked as boolean },
      });
    }

    // Store other ephemeral settings in memory
    const current = meetingSettingsStore.get(meetingCode) || {};
    const merged = { ...current, ...settings };
    meetingSettingsStore.set(meetingCode, merged);

    return merged;
  }

  async kickParticipant(userId: string, meetingCode: string, targetUserId: string) {
    const meeting = await this.assertHost(userId, meetingCode);

    if (targetUserId === userId) {
      throw new AppError(400, 'Cannot kick yourself', 'CANNOT_KICK_SELF');
    }

    const participant = await prisma.meetingParticipant.findFirst({
      where: { meetingId: meeting.id, userId: targetUserId, leftAt: null },
    });

    if (!participant) {
      throw new AppError(404, 'Participant not found or already left', 'PARTICIPANT_NOT_FOUND');
    }

    await prisma.meetingParticipant.update({
      where: { id: participant.id },
      data: { leftAt: new Date() },
    });

    // Also remove from raised hands and breakout rooms
    const hands = raisedHandsStore.get(meetingCode) || [];
    raisedHandsStore.set(
      meetingCode,
      hands.filter((h) => h.userId !== targetUserId)
    );

    const rooms = breakoutRoomsStore.get(meetingCode);
    if (rooms) {
      for (const room of rooms) {
        room.participants = room.participants.filter((uid) => uid !== targetUserId);
      }
    }

    return { kicked: true, userId: targetUserId };
  }

  async muteParticipant(userId: string, meetingCode: string, targetUserId: string) {
    const meeting = await this.assertHost(userId, meetingCode);

    const participant = await prisma.meetingParticipant.findFirst({
      where: { meetingId: meeting.id, userId: targetUserId, leftAt: null },
    });

    if (!participant) {
      throw new AppError(404, 'Participant not found or already left', 'PARTICIPANT_NOT_FOUND');
    }

    // In a real implementation this would signal the client via WebSocket.
    // Here we return confirmation for the API layer.
    return { muted: true, userId: targetUserId };
  }
}

export const meetingsService = new MeetingsService();
