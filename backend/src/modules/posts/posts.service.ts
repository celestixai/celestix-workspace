import { prisma } from '../../config/database';
import { AppError } from '../../middleware/error-handler';

export class PostsService {
  // ==========================================
  // Posts
  // ==========================================

  async createPost(
    channelId: string,
    userId: string,
    data: { title: string; content: string; contentJson?: any; coverImageUrl?: string },
  ) {
    // Verify user is a member of the channel
    await this.requireChannelMembership(userId, channelId);

    return prisma.post.create({
      data: {
        channelId,
        authorId: userId,
        title: data.title,
        content: data.content,
        contentJson: data.contentJson ?? undefined,
        coverImageUrl: data.coverImageUrl,
      },
      include: {
        author: { select: { id: true, displayName: true, avatarUrl: true } },
        _count: { select: { comments: true } },
      },
    });
  }

  async getPosts(channelId: string, limit = 20, cursor?: string) {
    const posts = await prisma.post.findMany({
      where: { channelId },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { createdAt: 'desc' },
      include: {
        author: { select: { id: true, displayName: true, avatarUrl: true } },
        _count: { select: { comments: true } },
      },
    });

    const hasMore = posts.length > limit;
    if (hasMore) posts.pop();

    return {
      posts,
      hasMore,
      cursor: posts.length > 0 ? posts[posts.length - 1].id : null,
    };
  }

  async getPost(postId: string) {
    const post = await prisma.post.findUnique({
      where: { id: postId },
      include: {
        author: { select: { id: true, displayName: true, avatarUrl: true } },
        comments: {
          orderBy: { createdAt: 'asc' },
          include: {
            author: { select: { id: true, displayName: true, avatarUrl: true } },
            replies: {
              orderBy: { createdAt: 'asc' },
              include: {
                author: { select: { id: true, displayName: true, avatarUrl: true } },
              },
            },
          },
          where: { parentCommentId: null },
        },
      },
    });

    if (!post) throw new AppError(404, 'Post not found', 'NOT_FOUND');
    return post;
  }

  async updatePost(
    postId: string,
    userId: string,
    data: { title?: string; content?: string; contentJson?: any; coverImageUrl?: string | null },
  ) {
    const post = await prisma.post.findUnique({ where: { id: postId } });
    if (!post) throw new AppError(404, 'Post not found', 'NOT_FOUND');
    if (post.authorId !== userId) throw new AppError(403, 'Only the author can edit this post', 'FORBIDDEN');

    return prisma.post.update({
      where: { id: postId },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.content !== undefined && { content: data.content }),
        ...(data.contentJson !== undefined && { contentJson: data.contentJson }),
        ...(data.coverImageUrl !== undefined && { coverImageUrl: data.coverImageUrl }),
      },
      include: {
        author: { select: { id: true, displayName: true, avatarUrl: true } },
        _count: { select: { comments: true } },
      },
    });
  }

  async deletePost(postId: string, userId: string) {
    const post = await prisma.post.findUnique({ where: { id: postId } });
    if (!post) throw new AppError(404, 'Post not found', 'NOT_FOUND');
    if (post.authorId !== userId) throw new AppError(403, 'Only the author can delete this post', 'FORBIDDEN');

    await prisma.post.delete({ where: { id: postId } });
    return { deleted: true };
  }

  async addComment(postId: string, userId: string, content: string, parentCommentId?: string) {
    const post = await prisma.post.findUnique({ where: { id: postId } });
    if (!post) throw new AppError(404, 'Post not found', 'NOT_FOUND');

    if (parentCommentId) {
      const parent = await prisma.postComment.findUnique({ where: { id: parentCommentId } });
      if (!parent || parent.postId !== postId) {
        throw new AppError(404, 'Parent comment not found', 'NOT_FOUND');
      }
    }

    return prisma.postComment.create({
      data: {
        postId,
        authorId: userId,
        content,
        parentCommentId,
      },
      include: {
        author: { select: { id: true, displayName: true, avatarUrl: true } },
      },
    });
  }

  async togglePin(postId: string) {
    const post = await prisma.post.findUnique({ where: { id: postId } });
    if (!post) throw new AppError(404, 'Post not found', 'NOT_FOUND');

    return prisma.post.update({
      where: { id: postId },
      data: { isPinned: !post.isPinned },
      include: {
        author: { select: { id: true, displayName: true, avatarUrl: true } },
        _count: { select: { comments: true } },
      },
    });
  }

  // ==========================================
  // Follow-Ups
  // ==========================================

  async createFollowUp(
    messageId: string,
    channelId: string,
    assignedById: string,
    assignedToId: string,
    dueDate?: string,
    note?: string,
  ) {
    const message = await prisma.wsMessage.findUnique({ where: { id: messageId } });
    if (!message) throw new AppError(404, 'Message not found', 'NOT_FOUND');

    // Mark the message as a follow-up
    await prisma.wsMessage.update({
      where: { id: messageId },
      data: { isFollowUp: true },
    });

    return prisma.followUp.create({
      data: {
        messageId,
        channelId,
        assignedById,
        assignedToId,
        dueDate: dueDate ? new Date(dueDate) : undefined,
        note,
      },
      include: {
        message: { select: { id: true, content: true, createdAt: true } },
        channel: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, displayName: true, avatarUrl: true } },
        assignedBy: { select: { id: true, displayName: true, avatarUrl: true } },
      },
    });
  }

  async getUserFollowUps(userId: string, workspaceId: string) {
    return prisma.followUp.findMany({
      where: {
        assignedToId: userId,
        channel: { workspaceId },
      },
      orderBy: [
        { status: 'asc' },
        { dueDate: 'asc' },
        { createdAt: 'desc' },
      ],
      include: {
        message: { select: { id: true, content: true, createdAt: true } },
        channel: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, displayName: true, avatarUrl: true } },
        assignedBy: { select: { id: true, displayName: true, avatarUrl: true } },
      },
    });
  }

  async updateFollowUp(
    followUpId: string,
    userId: string,
    data: { status?: 'PENDING' | 'IN_PROGRESS' | 'DONE'; dueDate?: string | null; note?: string | null },
  ) {
    const followUp = await prisma.followUp.findUnique({ where: { id: followUpId } });
    if (!followUp) throw new AppError(404, 'Follow-up not found', 'NOT_FOUND');

    return prisma.followUp.update({
      where: { id: followUpId },
      data: {
        ...(data.status !== undefined && { status: data.status }),
        ...(data.dueDate !== undefined && { dueDate: data.dueDate ? new Date(data.dueDate) : null }),
        ...(data.note !== undefined && { note: data.note }),
      },
      include: {
        message: { select: { id: true, content: true, createdAt: true } },
        channel: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, displayName: true, avatarUrl: true } },
        assignedBy: { select: { id: true, displayName: true, avatarUrl: true } },
      },
    });
  }

  async deleteFollowUp(followUpId: string) {
    const followUp = await prisma.followUp.findUnique({ where: { id: followUpId } });
    if (!followUp) throw new AppError(404, 'Follow-up not found', 'NOT_FOUND');

    await prisma.followUp.delete({ where: { id: followUpId } });

    // Check if there are other follow-ups for this message
    const remaining = await prisma.followUp.count({ where: { messageId: followUp.messageId } });
    if (remaining === 0) {
      await prisma.wsMessage.update({
        where: { id: followUp.messageId },
        data: { isFollowUp: false },
      });
    }

    return { deleted: true };
  }

  // ==========================================
  // Chat-to-Task
  // ==========================================

  async createTaskFromMessage(
    messageId: string,
    userId: string,
    config: { listId: string; assigneeIds?: string[]; priority?: string; dueDate?: string },
  ) {
    const message = await prisma.wsMessage.findUnique({
      where: { id: messageId },
      include: { sender: { select: { displayName: true } } },
    });
    if (!message) throw new AppError(404, 'Message not found', 'NOT_FOUND');

    // Resolve list -> space -> find/create a project for the workspace
    const list = await prisma.taskList.findUnique({
      where: { id: config.listId },
      include: { space: true },
    });
    if (!list) throw new AppError(404, 'Task list not found', 'NOT_FOUND');

    // Find user's first project or create one linked to workspace
    let project = await prisma.project.findFirst({
      where: {
        members: { some: { userId } },
        deletedAt: null,
      },
      orderBy: { createdAt: 'asc' },
    });

    if (!project) {
      project = await prisma.project.create({
        data: {
          name: 'Workspace Tasks',
          createdById: userId,
          members: { create: { userId, role: 'OWNER' } },
        },
      });
    }

    // Build task title from message content (truncated)
    const rawContent = message.content || 'Task from message';
    const title = rawContent.length > 200 ? rawContent.substring(0, 200) + '...' : rawContent;

    // Calculate position
    const lastTask = await prisma.task.findFirst({
      where: { projectId: project.id, status: 'TODO', deletedAt: null },
      orderBy: { position: 'desc' },
      select: { position: true },
    });
    const position = (lastTask?.position ?? 0) + 65536;

    const task = await prisma.task.create({
      data: {
        projectId: project.id,
        listId: config.listId,
        title,
        descriptionHtml: `<p>From message by ${message.sender.displayName}:</p><blockquote>${message.content || ''}</blockquote>`,
        status: 'TODO',
        priority: (config.priority as any) ?? 'NONE',
        dueDate: config.dueDate ? new Date(config.dueDate) : undefined,
        createdById: userId,
        position,
        assignees: config.assigneeIds?.length
          ? { create: config.assigneeIds.map((uid) => ({ userId: uid })) }
          : undefined,
      },
      include: {
        assignees: { include: { user: { select: { id: true, displayName: true, avatarUrl: true } } } },
      },
    });

    return task;
  }

  // ==========================================
  // Helpers
  // ==========================================

  private async requireChannelMembership(userId: string, channelId: string) {
    const membership = await prisma.wsChannelMember.findUnique({
      where: { channelId_userId: { channelId, userId } },
    });
    if (!membership) {
      throw new AppError(403, 'You are not a member of this channel', 'NOT_CHANNEL_MEMBER');
    }
    return membership;
  }
}

export const postsService = new PostsService();
