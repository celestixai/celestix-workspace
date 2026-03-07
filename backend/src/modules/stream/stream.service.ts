import { prisma } from '../../config/database';
import { AppError } from '../../middleware/error-handler';
import type {
  CreateVideoInput,
  UpdateVideoInput,
  CreateChannelInput,
  CreateCommentInput,
  CreatePlaylistInput,
  UpdatePlaylistInput,
} from './stream.schema';

const userSelect = { id: true, displayName: true, avatarUrl: true, email: true } as const;

export class StreamService {
  // ==================================
  // VIDEOS
  // ==================================

  async create(userId: string, data: CreateVideoInput, storagePath: string) {
    const video = await prisma.video.create({
      data: {
        title: data.title,
        description: data.description,
        channelId: data.channelId,
        tags: data.tags ?? [],
        privacy: data.privacy ?? 'PUBLIC',
        chapters: data.chapters ?? [],
        storagePath,
        thumbnailPath: null,
        uploadedById: userId,
      },
      include: {
        uploadedBy: { select: userSelect },
        channel: { select: { id: true, name: true } },
      },
    });

    return video;
  }

  async getAll(userId: string, query?: { search?: string; channelId?: string; privacy?: string }) {
    const where: Record<string, unknown> = { deletedAt: null };

    // Public videos + user's own private/unlisted videos
    if (query?.privacy) {
      where.privacy = query.privacy;
    } else {
      where.OR = [
        { privacy: 'PUBLIC' },
        { uploadedById: userId },
      ];
    }

    if (query?.channelId) {
      where.channelId = query.channelId;
    }

    if (query?.search) {
      where.title = { contains: query.search, mode: 'insensitive' };
    }

    return prisma.video.findMany({
      where,
      include: {
        uploadedBy: { select: userSelect },
        channel: { select: { id: true, name: true } },
        _count: { select: { comments: true, views: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getById(videoId: string) {
    const video = await prisma.video.findFirst({
      where: { id: videoId, deletedAt: null },
      include: {
        uploadedBy: { select: userSelect },
        channel: { select: { id: true, name: true } },
        _count: { select: { comments: true, views: true } },
      },
    });

    if (!video) {
      throw new AppError(404, 'Video not found', 'NOT_FOUND');
    }

    return video;
  }

  async update(userId: string, videoId: string, input: UpdateVideoInput) {
    const video = await prisma.video.findFirst({
      where: { id: videoId, deletedAt: null },
    });

    if (!video) {
      throw new AppError(404, 'Video not found', 'NOT_FOUND');
    }

    if (video.uploadedById !== userId) {
      throw new AppError(403, 'Not authorized to update this video', 'FORBIDDEN');
    }

    return prisma.video.update({
      where: { id: videoId },
      data: {
        title: input.title,
        description: input.description,
        channelId: input.channelId,
        tags: input.tags,
        privacy: input.privacy,
        chapters: input.chapters ?? undefined,
      },
      include: {
        uploadedBy: { select: userSelect },
        channel: { select: { id: true, name: true } },
        _count: { select: { comments: true, views: true } },
      },
    });
  }

  async delete(userId: string, videoId: string) {
    const video = await prisma.video.findFirst({
      where: { id: videoId, deletedAt: null },
    });

    if (!video) {
      throw new AppError(404, 'Video not found', 'NOT_FOUND');
    }

    if (video.uploadedById !== userId) {
      throw new AppError(403, 'Not authorized to delete this video', 'FORBIDDEN');
    }

    await prisma.video.update({
      where: { id: videoId },
      data: { deletedAt: new Date() },
    });
  }

  async recordView(videoId: string, userId: string, watchedSeconds: number) {
    const video = await prisma.video.findFirst({
      where: { id: videoId, deletedAt: null },
    });

    if (!video) {
      throw new AppError(404, 'Video not found', 'NOT_FOUND');
    }

    // Upsert: update if the user already has a view record, create otherwise
    const existing = await prisma.videoView.findFirst({
      where: { videoId, userId },
    });

    if (existing) {
      return prisma.videoView.update({
        where: { id: existing.id },
        data: { watchedSeconds, viewedAt: new Date() },
      });
    }

    return prisma.videoView.create({
      data: { videoId, userId, watchedSeconds },
    });
  }

  async search(query: string) {
    return prisma.video.findMany({
      where: {
        deletedAt: null,
        privacy: 'PUBLIC',
        OR: [
          { title: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } },
        ],
      },
      include: {
        uploadedBy: { select: userSelect },
        channel: { select: { id: true, name: true } },
        _count: { select: { comments: true, views: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ==================================
  // CHANNELS
  // ==================================

  async createChannel(userId: string, input: CreateChannelInput) {
    return prisma.videoChannel.create({
      data: {
        name: input.name,
        description: input.description,
        workspaceId: input.workspaceId,
        createdById: userId,
      },
      include: {
        createdBy: { select: userSelect },
        _count: { select: { videos: true } },
      },
    });
  }

  async getChannels(userId: string) {
    return prisma.videoChannel.findMany({
      where: {
        OR: [
          { createdById: userId },
          { workspaceId: { not: null } },
        ],
      },
      include: {
        createdBy: { select: userSelect },
        _count: { select: { videos: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getChannelById(channelId: string) {
    const channel = await prisma.videoChannel.findUnique({
      where: { id: channelId },
      include: {
        createdBy: { select: userSelect },
        videos: {
          where: { deletedAt: null, privacy: 'PUBLIC' },
          include: {
            uploadedBy: { select: userSelect },
            _count: { select: { comments: true, views: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
        _count: { select: { videos: true } },
      },
    });

    if (!channel) {
      throw new AppError(404, 'Channel not found', 'NOT_FOUND');
    }

    return channel;
  }

  // ==================================
  // COMMENTS
  // ==================================

  async addComment(userId: string, videoId: string, input: CreateCommentInput) {
    const video = await prisma.video.findFirst({
      where: { id: videoId, deletedAt: null },
    });

    if (!video) {
      throw new AppError(404, 'Video not found', 'NOT_FOUND');
    }

    if (input.parentCommentId) {
      const parent = await prisma.videoComment.findUnique({
        where: { id: input.parentCommentId },
      });
      if (!parent || parent.videoId !== videoId) {
        throw new AppError(404, 'Parent comment not found', 'NOT_FOUND');
      }
    }

    return prisma.videoComment.create({
      data: {
        videoId,
        userId,
        body: input.body,
        timestampSeconds: input.timestampSeconds,
        parentCommentId: input.parentCommentId,
      },
      include: {
        user: { select: userSelect },
        replies: {
          include: { user: { select: userSelect } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  }

  async getComments(videoId: string) {
    const video = await prisma.video.findFirst({
      where: { id: videoId, deletedAt: null },
    });

    if (!video) {
      throw new AppError(404, 'Video not found', 'NOT_FOUND');
    }

    return prisma.videoComment.findMany({
      where: { videoId, parentCommentId: null },
      include: {
        user: { select: userSelect },
        replies: {
          include: { user: { select: userSelect } },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async deleteComment(userId: string, commentId: string) {
    const comment = await prisma.videoComment.findUnique({
      where: { id: commentId },
    });

    if (!comment) {
      throw new AppError(404, 'Comment not found', 'NOT_FOUND');
    }

    if (comment.userId !== userId) {
      // Check if user owns the video
      const video = await prisma.video.findFirst({
        where: { id: comment.videoId, uploadedById: userId },
      });
      if (!video) {
        throw new AppError(403, 'Not authorized to delete this comment', 'FORBIDDEN');
      }
    }

    await prisma.videoComment.delete({ where: { id: commentId } });
  }

  // ==================================
  // PLAYLISTS
  // ==================================

  async createPlaylist(userId: string, input: CreatePlaylistInput) {
    return prisma.videoPlaylist.create({
      data: {
        name: input.name,
        description: input.description,
        videoIds: input.videoIds,
        createdById: userId,
      },
      include: {
        createdBy: { select: userSelect },
      },
    });
  }

  async getPlaylists(userId: string) {
    return prisma.videoPlaylist.findMany({
      where: { createdById: userId },
      include: {
        createdBy: { select: userSelect },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async updatePlaylist(userId: string, playlistId: string, input: UpdatePlaylistInput) {
    const playlist = await prisma.videoPlaylist.findUnique({
      where: { id: playlistId },
    });

    if (!playlist) {
      throw new AppError(404, 'Playlist not found', 'NOT_FOUND');
    }

    if (playlist.createdById !== userId) {
      throw new AppError(403, 'Not authorized to update this playlist', 'FORBIDDEN');
    }

    return prisma.videoPlaylist.update({
      where: { id: playlistId },
      data: {
        name: input.name,
        description: input.description,
        videoIds: input.videoIds,
      },
      include: {
        createdBy: { select: userSelect },
      },
    });
  }

  async deletePlaylist(userId: string, playlistId: string) {
    const playlist = await prisma.videoPlaylist.findUnique({
      where: { id: playlistId },
    });

    if (!playlist) {
      throw new AppError(404, 'Playlist not found', 'NOT_FOUND');
    }

    if (playlist.createdById !== userId) {
      throw new AppError(403, 'Not authorized to delete this playlist', 'FORBIDDEN');
    }

    await prisma.videoPlaylist.delete({ where: { id: playlistId } });
  }
}

export const streamService = new StreamService();
