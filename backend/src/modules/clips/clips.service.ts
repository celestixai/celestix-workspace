import { prisma } from '../../config/database';
import { AppError } from '../../middleware/error-handler';
import { config } from '../../config';
import path from 'path';
import fs from 'fs';
import type { UpdateClipInput } from './clips.validation';
import type { ClipType } from '@prisma/client';

const userSelect = { id: true, displayName: true, avatarUrl: true } as const;

export class ClipsService {
  // List clips for a workspace
  async getClips(
    workspaceId: string,
    filters?: { type?: ClipType; userId?: string; search?: string },
  ) {
    const where: Record<string, unknown> = { workspaceId };

    if (filters?.type) {
      where.type = filters.type;
    }
    if (filters?.userId) {
      where.createdById = filters.userId;
    }
    if (filters?.search) {
      where.title = { contains: filters.search, mode: 'insensitive' };
    }

    return prisma.clip.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: { select: userSelect },
      },
    });
  }

  // Upload a new clip
  async uploadClip(
    workspaceId: string,
    userId: string,
    filePath: string,
    metadata: {
      title: string;
      type: ClipType;
      duration?: number;
      mimeType: string;
      fileSize?: number;
    },
  ) {
    return prisma.clip.create({
      data: {
        workspaceId,
        createdById: userId,
        title: metadata.title,
        type: metadata.type,
        duration: metadata.duration ?? null,
        fileUrl: filePath,
        mimeType: metadata.mimeType,
        fileSize: metadata.fileSize ? BigInt(metadata.fileSize) : null,
      },
      include: {
        createdBy: { select: userSelect },
      },
    });
  }

  // Get clip record without side effects (for streaming redirect)
  async getClipRaw(clipId: string) {
    const clip = await prisma.clip.findUnique({ where: { id: clipId } });
    if (!clip) throw new AppError(404, 'Clip not found');
    return clip;
  }

  // Get clip details + increment view count
  async getClip(clipId: string) {
    const clip = await prisma.clip.findUnique({
      where: { id: clipId },
      include: {
        createdBy: { select: userSelect },
      },
    });

    if (!clip) throw new AppError(404, 'Clip not found');

    // Increment view count
    await prisma.clip.update({
      where: { id: clipId },
      data: { viewCount: { increment: 1 } },
    });

    return { ...clip, viewCount: clip.viewCount + 1 };
  }

  // Update clip metadata
  async updateClip(clipId: string, userId: string, data: UpdateClipInput) {
    const clip = await prisma.clip.findUnique({ where: { id: clipId } });
    if (!clip) throw new AppError(404, 'Clip not found');
    if (clip.createdById !== userId) throw new AppError(403, 'Not authorized');

    return prisma.clip.update({
      where: { id: clipId },
      data,
      include: {
        createdBy: { select: userSelect },
      },
    });
  }

  // Delete clip + file from disk
  async deleteClip(clipId: string, userId: string) {
    const clip = await prisma.clip.findUnique({ where: { id: clipId } });
    if (!clip) throw new AppError(404, 'Clip not found');
    if (clip.createdById !== userId) throw new AppError(403, 'Not authorized');

    // Remove file from disk
    const fullPath = path.resolve(config.storage.path, clip.fileUrl.replace(/^\//, ''));
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }

    await prisma.clip.delete({ where: { id: clipId } });
    return { message: 'Clip deleted' };
  }

  // Stream — return file path for piping
  async streamClip(clipId: string) {
    const clip = await prisma.clip.findUnique({ where: { id: clipId } });
    if (!clip) throw new AppError(404, 'Clip not found');

    const fullPath = path.resolve(config.storage.path, clip.fileUrl.replace(/^\//, ''));
    if (!fs.existsSync(fullPath)) {
      throw new AppError(404, 'Clip file not found on disk');
    }

    return { filePath: fullPath, mimeType: clip.mimeType, fileSize: clip.fileSize };
  }

  // Share — make public
  async shareClip(clipId: string, userId: string) {
    const clip = await prisma.clip.findUnique({ where: { id: clipId } });
    if (!clip) throw new AppError(404, 'Clip not found');
    if (clip.createdById !== userId) throw new AppError(403, 'Not authorized');

    const updated = await prisma.clip.update({
      where: { id: clipId },
      data: { isPublic: true },
      include: {
        createdBy: { select: userSelect },
      },
    });

    return {
      ...updated,
      publicUrl: `/api/v1/clips/${clipId}/stream`,
    };
  }

  // Clips hub — centralized view with stats
  async getClipsHub(workspaceId: string, userId: string) {
    const [clips, stats] = await Promise.all([
      prisma.clip.findMany({
        where: { workspaceId },
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: {
          createdBy: { select: userSelect },
        },
      }),
      prisma.clip.groupBy({
        by: ['type'],
        where: { workspaceId },
        _count: { id: true },
        _sum: { duration: true },
      }),
    ]);

    const totalClips = stats.reduce((sum, s) => sum + s._count.id, 0);
    const totalDuration = stats.reduce((sum, s) => sum + (s._sum.duration ?? 0), 0);
    const byType = Object.fromEntries(
      stats.map((s) => [s.type, { count: s._count.id, duration: s._sum.duration ?? 0 }]),
    );

    return {
      clips,
      stats: {
        totalClips,
        totalDuration,
        byType,
      },
    };
  }
}

export const clipsService = new ClipsService();
