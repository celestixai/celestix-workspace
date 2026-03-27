import { prisma } from '../../config/database';
import { AppError } from '../../middleware/error-handler';

export class SyncUpsService {
  // ==========================================
  // Start SyncUp
  // ==========================================

  async startSyncUp(channelId: string, userId: string, title?: string) {
    // Check for existing active SyncUp in this channel
    const existing = await prisma.syncUp.findFirst({
      where: { channelId, status: 'ACTIVE' },
    });
    if (existing) {
      throw new AppError(409, 'Channel already has an active SyncUp');
    }

    // Create SyncUp and add starter as first participant
    const syncUp = await prisma.syncUp.create({
      data: {
        channelId,
        startedById: userId,
        title,
      },
      include: {
        startedBy: { select: { id: true, displayName: true, avatarUrl: true } },
        participants: {
          where: { leftAt: null },
          include: { user: { select: { id: true, displayName: true, avatarUrl: true } } },
        },
      },
    });

    // Add starter as first participant
    await prisma.syncUpParticipant.create({
      data: {
        syncUpId: syncUp.id,
        userId,
        isAudioEnabled: true,
        isVideoEnabled: false,
      },
    });

    // Re-fetch with participant
    return this.getSyncUp(syncUp.id);
  }

  // ==========================================
  // Join SyncUp
  // ==========================================

  async joinSyncUp(syncUpId: string, userId: string) {
    const syncUp = await prisma.syncUp.findUnique({ where: { id: syncUpId } });
    if (!syncUp || syncUp.status !== 'ACTIVE') {
      throw new AppError(404, 'SyncUp not found or already ended');
    }

    // Check if already an active participant
    const existing = await prisma.syncUpParticipant.findFirst({
      where: { syncUpId, userId, leftAt: null },
    });
    if (existing) {
      return this.getSyncUp(syncUpId);
    }

    await prisma.syncUpParticipant.create({
      data: {
        syncUpId,
        userId,
        isAudioEnabled: true,
        isVideoEnabled: false,
      },
    });

    return this.getSyncUp(syncUpId);
  }

  // ==========================================
  // Leave SyncUp
  // ==========================================

  async leaveSyncUp(syncUpId: string, userId: string) {
    const participant = await prisma.syncUpParticipant.findFirst({
      where: { syncUpId, userId, leftAt: null },
    });
    if (!participant) {
      throw new AppError(404, 'Not a participant in this SyncUp');
    }

    await prisma.syncUpParticipant.update({
      where: { id: participant.id },
      data: { leftAt: new Date() },
    });

    // Check if last participant left — auto-end
    const remaining = await prisma.syncUpParticipant.count({
      where: { syncUpId, leftAt: null },
    });
    if (remaining === 0) {
      await prisma.syncUp.update({
        where: { id: syncUpId },
        data: { status: 'ENDED', endedAt: new Date() },
      });
    }

    return this.getSyncUp(syncUpId);
  }

  // ==========================================
  // End SyncUp
  // ==========================================

  async endSyncUp(syncUpId: string, userId: string) {
    const syncUp = await prisma.syncUp.findUnique({ where: { id: syncUpId } });
    if (!syncUp || syncUp.status !== 'ACTIVE') {
      throw new AppError(404, 'SyncUp not found or already ended');
    }

    // Only the starter can end (or any participant for now)
    const now = new Date();

    // Set leftAt on all remaining participants
    await prisma.syncUpParticipant.updateMany({
      where: { syncUpId, leftAt: null },
      data: { leftAt: now },
    });

    // End the SyncUp
    await prisma.syncUp.update({
      where: { id: syncUpId },
      data: { status: 'ENDED', endedAt: now },
    });

    return this.getSyncUp(syncUpId);
  }

  // ==========================================
  // Get SyncUp
  // ==========================================

  async getSyncUp(syncUpId: string) {
    const syncUp = await prisma.syncUp.findUnique({
      where: { id: syncUpId },
      include: {
        startedBy: { select: { id: true, displayName: true, avatarUrl: true } },
        participants: {
          where: { leftAt: null },
          include: { user: { select: { id: true, displayName: true, avatarUrl: true } } },
        },
      },
    });
    if (!syncUp) {
      throw new AppError(404, 'SyncUp not found');
    }
    return syncUp;
  }

  // ==========================================
  // Get Participants
  // ==========================================

  async getParticipants(syncUpId: string) {
    return prisma.syncUpParticipant.findMany({
      where: { syncUpId, leftAt: null },
      include: { user: { select: { id: true, displayName: true, avatarUrl: true } } },
    });
  }

  // ==========================================
  // Get Active SyncUp
  // ==========================================

  async getActiveSyncUp(channelId: string) {
    const syncUp = await prisma.syncUp.findFirst({
      where: { channelId, status: 'ACTIVE' },
      include: {
        startedBy: { select: { id: true, displayName: true, avatarUrl: true } },
        participants: {
          where: { leftAt: null },
          include: { user: { select: { id: true, displayName: true, avatarUrl: true } } },
        },
      },
    });
    return syncUp || null;
  }

  // ==========================================
  // Recording
  // ==========================================

  async startRecording(syncUpId: string) {
    const syncUp = await prisma.syncUp.findUnique({ where: { id: syncUpId } });
    if (!syncUp || syncUp.status !== 'ACTIVE') {
      throw new AppError(404, 'SyncUp not found or already ended');
    }

    return prisma.syncUp.update({
      where: { id: syncUpId },
      data: { recordingUrl: `pending://recording/${syncUpId}` },
    });
  }

  async stopRecording(syncUpId: string) {
    const syncUp = await prisma.syncUp.findUnique({ where: { id: syncUpId } });
    if (!syncUp) {
      throw new AppError(404, 'SyncUp not found');
    }

    // In a real implementation, this would finalize the recording URL
    return prisma.syncUp.update({
      where: { id: syncUpId },
      data: { recordingUrl: syncUp.recordingUrl?.replace('pending://', 'recorded://') || null },
    });
  }

  // ==========================================
  // Toggle Audio / Video
  // ==========================================

  async toggleAudio(syncUpId: string, userId: string, enabled: boolean) {
    const participant = await prisma.syncUpParticipant.findFirst({
      where: { syncUpId, userId, leftAt: null },
    });
    if (!participant) {
      throw new AppError(404, 'Not a participant in this SyncUp');
    }

    return prisma.syncUpParticipant.update({
      where: { id: participant.id },
      data: { isAudioEnabled: enabled },
      include: { user: { select: { id: true, displayName: true, avatarUrl: true } } },
    });
  }

  async toggleVideo(syncUpId: string, userId: string, enabled: boolean) {
    const participant = await prisma.syncUpParticipant.findFirst({
      where: { syncUpId, userId, leftAt: null },
    });
    if (!participant) {
      throw new AppError(404, 'Not a participant in this SyncUp');
    }

    return prisma.syncUpParticipant.update({
      where: { id: participant.id },
      data: { isVideoEnabled: enabled },
      include: { user: { select: { id: true, displayName: true, avatarUrl: true } } },
    });
  }
}

export const syncUpsService = new SyncUpsService();
