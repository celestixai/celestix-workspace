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
}

export const meetingsService = new MeetingsService();
