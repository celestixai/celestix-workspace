import { prisma } from '../../config/database';
import { AppError } from '../../middleware/error-handler';
import type {
  CreateCommunityInput,
  UpdateCommunityInput,
  CreatePostInput,
  UpdatePostInput,
  CreateCommentInput,
  AddReactionInput,
  FeedQueryInput,
  PostsByTypeInput,
} from './social.schema';

const userSelect = { id: true, displayName: true, avatarUrl: true, username: true } as const;

const postInclude = {
  user: { select: userSelect },
  community: { select: { id: true, name: true } },
  _count: { select: { comments: true, reactions: true } },
  reactions: { select: { id: true, userId: true, type: true } },
} as const;

export class SocialService {
  // ==================================
  // COMMUNITY CRUD
  // ==================================

  async createCommunity(userId: string, input: CreateCommunityInput) {
    const community = await prisma.community.create({
      data: {
        name: input.name,
        description: input.description,
        coverImage: input.coverImage,
        isOfficial: input.isOfficial ?? false,
        isPrivate: input.isPrivate ?? false,
        createdBy: userId,
        members: {
          create: [{ userId, role: 'admin' }],
        },
      },
      include: {
        members: {
          include: { user: { select: userSelect } },
        },
        _count: { select: { members: true, posts: true } },
      },
    });

    return community;
  }

  async getCommunities(userId: string) {
    const communities = await prisma.community.findMany({
      where: {
        OR: [
          { isPrivate: false },
          { members: { some: { userId } } },
        ],
      },
      include: {
        _count: { select: { members: true, posts: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    // Annotate each community with the user's membership status
    const memberships = await prisma.communityMember.findMany({
      where: { userId, communityId: { in: communities.map((c) => c.id) } },
      select: { communityId: true, role: true },
    });
    const membershipMap = new Map(memberships.map((m) => [m.communityId, m.role]));

    return communities.map((c) => ({
      ...c,
      isMember: membershipMap.has(c.id),
      memberRole: membershipMap.get(c.id) ?? null,
    }));
  }

  async getCommunityById(communityId: string) {
    const community = await prisma.community.findUnique({
      where: { id: communityId },
      include: {
        members: {
          include: { user: { select: userSelect } },
          orderBy: { joinedAt: 'asc' },
        },
        _count: { select: { members: true, posts: true } },
      },
    });

    if (!community) {
      throw new AppError(404, 'Community not found', 'NOT_FOUND');
    }

    return community;
  }

  async updateCommunity(userId: string, communityId: string, input: UpdateCommunityInput) {
    await this.requireCommunityRole(userId, communityId, ['admin']);

    const community = await prisma.community.update({
      where: { id: communityId },
      data: {
        name: input.name,
        description: input.description,
        coverImage: input.coverImage,
        isOfficial: input.isOfficial,
        isPrivate: input.isPrivate,
      },
      include: {
        _count: { select: { members: true, posts: true } },
      },
    });

    return community;
  }

  async deleteCommunity(userId: string, communityId: string) {
    await this.requireCommunityRole(userId, communityId, ['admin']);

    // Verify the user is the creator
    const community = await prisma.community.findUnique({ where: { id: communityId } });
    if (!community) {
      throw new AppError(404, 'Community not found', 'NOT_FOUND');
    }
    if (community.createdBy !== userId) {
      throw new AppError(403, 'Only the community creator can delete it', 'FORBIDDEN');
    }

    await prisma.community.delete({ where: { id: communityId } });
  }

  // ==================================
  // JOIN / LEAVE
  // ==================================

  async joinCommunity(userId: string, communityId: string) {
    const community = await prisma.community.findUnique({ where: { id: communityId } });
    if (!community) {
      throw new AppError(404, 'Community not found', 'NOT_FOUND');
    }

    const existing = await prisma.communityMember.findUnique({
      where: { communityId_userId: { communityId, userId } },
    });
    if (existing) {
      throw new AppError(409, 'Already a member of this community', 'ALREADY_MEMBER');
    }

    if (community.isPrivate) {
      throw new AppError(403, 'This is a private community. You need an invitation to join.', 'PRIVATE_COMMUNITY');
    }

    const member = await prisma.communityMember.create({
      data: { communityId, userId, role: 'member' },
      include: { user: { select: userSelect } },
    });

    return member;
  }

  async leaveCommunity(userId: string, communityId: string) {
    const membership = await prisma.communityMember.findUnique({
      where: { communityId_userId: { communityId, userId } },
    });
    if (!membership) {
      throw new AppError(404, 'Not a member of this community', 'NOT_MEMBER');
    }

    // Prevent the creator from leaving
    const community = await prisma.community.findUnique({ where: { id: communityId } });
    if (community && community.createdBy === userId) {
      throw new AppError(400, 'The community creator cannot leave. Delete the community instead.', 'CREATOR_CANNOT_LEAVE');
    }

    await prisma.communityMember.delete({ where: { id: membership.id } });
  }

  // ==================================
  // POST CRUD
  // ==================================

  async createPost(userId: string, communityId: string, input: CreatePostInput) {
    await this.requireCommunityMembership(userId, communityId);

    const post = await prisma.socialPost.create({
      data: {
        communityId,
        userId,
        type: (input.type as 'DISCUSSION' | 'QUESTION' | 'POLL' | 'PRAISE' | 'ANNOUNCEMENT' | 'EVENT') ?? 'DISCUSSION',
        title: input.title,
        bodyHtml: input.bodyHtml,
        images: input.images ?? [],
        pollOptions: input.pollOptions,
        pollExpiresAt: input.pollExpiresAt ? new Date(input.pollExpiresAt) : undefined,
        praiseUserId: input.praiseUserId,
        praiseBadge: input.praiseBadge,
        eventDate: input.eventDate ? new Date(input.eventDate) : undefined,
        isPinned: input.isPinned ?? false,
      },
      include: postInclude,
    });

    return post;
  }

  async getPosts(communityId: string) {
    const posts = await prisma.socialPost.findMany({
      where: { communityId },
      include: postInclude,
      orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
    });

    return posts;
  }

  async getPostById(postId: string) {
    const post = await prisma.socialPost.findUnique({
      where: { id: postId },
      include: {
        ...postInclude,
        comments: {
          include: {
            user: { select: userSelect },
            replies: {
              include: { user: { select: userSelect } },
              orderBy: { createdAt: 'asc' },
            },
          },
          where: { parentId: null },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!post) {
      throw new AppError(404, 'Post not found', 'NOT_FOUND');
    }

    return post;
  }

  async updatePost(userId: string, postId: string, input: UpdatePostInput) {
    const existing = await prisma.socialPost.findUnique({ where: { id: postId } });
    if (!existing) {
      throw new AppError(404, 'Post not found', 'NOT_FOUND');
    }
    if (existing.userId !== userId) {
      throw new AppError(403, 'Cannot edit others\' posts', 'FORBIDDEN');
    }

    const post = await prisma.socialPost.update({
      where: { id: postId },
      data: {
        title: input.title,
        bodyHtml: input.bodyHtml,
        images: input.images,
        isPinned: input.isPinned,
      },
      include: postInclude,
    });

    return post;
  }

  async deletePost(userId: string, postId: string) {
    const existing = await prisma.socialPost.findUnique({ where: { id: postId } });
    if (!existing) {
      throw new AppError(404, 'Post not found', 'NOT_FOUND');
    }

    // Allow post owner or community admin to delete
    if (existing.userId !== userId) {
      await this.requireCommunityRole(userId, existing.communityId, ['admin']);
    }

    await prisma.socialPost.delete({ where: { id: postId } });
  }

  // ==================================
  // FEED (paginated, from joined communities)
  // ==================================

  async getFeed(userId: string, input: FeedQueryInput) {
    // Get all communities the user has joined
    const memberships = await prisma.communityMember.findMany({
      where: { userId },
      select: { communityId: true },
    });
    const communityIds = memberships.map((m) => m.communityId);

    if (communityIds.length === 0) {
      return { posts: [], hasMore: false, cursor: undefined };
    }

    let cursor: { id: string } | undefined;
    let skip: number | undefined;
    if (input.cursor) {
      cursor = { id: input.cursor };
      skip = 1;
    }

    const limit = input.limit ?? 20;

    const posts = await prisma.socialPost.findMany({
      where: { communityId: { in: communityIds } },
      include: postInclude,
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      cursor,
      skip,
    });

    const hasMore = posts.length > limit;
    if (hasMore) posts.pop();

    return {
      posts,
      hasMore,
      cursor: posts.length > 0 ? posts[posts.length - 1].id : undefined,
    };
  }

  // ==================================
  // GET BY TYPE (paginated)
  // ==================================

  async getPostsByType(communityId: string, input: PostsByTypeInput) {
    let cursor: { id: string } | undefined;
    let skip: number | undefined;
    if (input.cursor) {
      cursor = { id: input.cursor };
      skip = 1;
    }

    const limit = input.limit ?? 20;

    const posts = await prisma.socialPost.findMany({
      where: {
        communityId,
        type: input.type as 'DISCUSSION' | 'QUESTION' | 'POLL' | 'PRAISE' | 'ANNOUNCEMENT' | 'EVENT',
      },
      include: postInclude,
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      cursor,
      skip,
    });

    const hasMore = posts.length > limit;
    if (hasMore) posts.pop();

    return {
      posts,
      hasMore,
      cursor: posts.length > 0 ? posts[posts.length - 1].id : undefined,
    };
  }

  // ==================================
  // COMMENT CRUD
  // ==================================

  async createComment(userId: string, postId: string, input: CreateCommentInput) {
    const post = await prisma.socialPost.findUnique({ where: { id: postId } });
    if (!post) {
      throw new AppError(404, 'Post not found', 'NOT_FOUND');
    }

    await this.requireCommunityMembership(userId, post.communityId);

    // If replying to a parent comment, validate it exists and belongs to the same post
    if (input.parentId) {
      const parentComment = await prisma.socialComment.findFirst({
        where: { id: input.parentId, postId },
      });
      if (!parentComment) {
        throw new AppError(404, 'Parent comment not found', 'NOT_FOUND');
      }
    }

    const comment = await prisma.socialComment.create({
      data: {
        postId,
        userId,
        body: input.body,
        parentId: input.parentId,
      },
      include: {
        user: { select: userSelect },
      },
    });

    return comment;
  }

  async getComments(postId: string) {
    const post = await prisma.socialPost.findUnique({ where: { id: postId } });
    if (!post) {
      throw new AppError(404, 'Post not found', 'NOT_FOUND');
    }

    const comments = await prisma.socialComment.findMany({
      where: { postId, parentId: null },
      include: {
        user: { select: userSelect },
        replies: {
          include: { user: { select: userSelect } },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return comments;
  }

  async deleteComment(userId: string, commentId: string) {
    const comment = await prisma.socialComment.findUnique({
      where: { id: commentId },
      include: { post: { select: { communityId: true } } },
    });
    if (!comment) {
      throw new AppError(404, 'Comment not found', 'NOT_FOUND');
    }

    // Allow comment owner or community admin to delete
    if (comment.userId !== userId) {
      await this.requireCommunityRole(userId, comment.post.communityId, ['admin']);
    }

    await prisma.socialComment.delete({ where: { id: commentId } });
  }

  async markBestAnswer(userId: string, postId: string, commentId: string) {
    const post = await prisma.socialPost.findUnique({ where: { id: postId } });
    if (!post) {
      throw new AppError(404, 'Post not found', 'NOT_FOUND');
    }
    if (post.type !== 'QUESTION') {
      throw new AppError(400, 'Only question posts can have a best answer', 'NOT_A_QUESTION');
    }
    if (post.userId !== userId) {
      throw new AppError(403, 'Only the question author can mark the best answer', 'FORBIDDEN');
    }

    const comment = await prisma.socialComment.findFirst({
      where: { id: commentId, postId },
    });
    if (!comment) {
      throw new AppError(404, 'Comment not found on this post', 'NOT_FOUND');
    }

    // Unmark any previously marked best answer
    await prisma.socialComment.updateMany({
      where: { postId, isBestAnswer: true },
      data: { isBestAnswer: false },
    });

    // Mark the new best answer
    const updated = await prisma.socialComment.update({
      where: { id: commentId },
      data: { isBestAnswer: true },
      include: { user: { select: userSelect } },
    });

    // Also update the post's bestAnswerId
    await prisma.socialPost.update({
      where: { id: postId },
      data: { bestAnswerId: commentId },
    });

    return updated;
  }

  // ==================================
  // REACTION TOGGLE
  // ==================================

  async toggleReaction(userId: string, postId: string, input: AddReactionInput) {
    const post = await prisma.socialPost.findUnique({ where: { id: postId } });
    if (!post) {
      throw new AppError(404, 'Post not found', 'NOT_FOUND');
    }

    const existing = await prisma.socialReaction.findUnique({
      where: { postId_userId: { postId, userId } },
    });

    if (existing) {
      if (existing.type === input.type) {
        // Same reaction type: remove it (toggle off)
        await prisma.socialReaction.delete({ where: { id: existing.id } });
        return { action: 'removed', reaction: null };
      } else {
        // Different reaction type: update it
        const reaction = await prisma.socialReaction.update({
          where: { id: existing.id },
          data: { type: input.type },
        });
        return { action: 'updated', reaction };
      }
    }

    // No existing reaction: create one
    const reaction = await prisma.socialReaction.create({
      data: { postId, userId, type: input.type },
    });
    return { action: 'added', reaction };
  }

  // ==================================
  // TRENDING
  // ==================================

  async getTrending() {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const posts = await prisma.socialPost.findMany({
      where: {
        createdAt: { gte: sevenDaysAgo },
      },
      include: {
        ...postInclude,
        _count: { select: { comments: true, reactions: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    // Sort by engagement (comments + reactions) descending
    const sorted = posts.sort((a, b) => {
      const engagementA = a._count.comments + a._count.reactions;
      const engagementB = b._count.comments + b._count.reactions;
      return engagementB - engagementA;
    });

    return sorted.slice(0, 20);
  }

  // ==================================
  // PRIVATE HELPERS
  // ==================================

  private async requireCommunityMembership(userId: string, communityId: string) {
    const membership = await prisma.communityMember.findUnique({
      where: { communityId_userId: { communityId, userId } },
    });
    if (!membership) {
      throw new AppError(403, 'Not a member of this community', 'NOT_MEMBER');
    }
    return membership;
  }

  private async requireCommunityRole(userId: string, communityId: string, roles: string[]) {
    const membership = await prisma.communityMember.findUnique({
      where: { communityId_userId: { communityId, userId } },
    });
    if (!membership) {
      throw new AppError(403, 'Not a member of this community', 'NOT_MEMBER');
    }
    if (!roles.includes(membership.role)) {
      throw new AppError(403, `Requires one of: ${roles.join(', ')}`, 'INSUFFICIENT_ROLE');
    }
    return membership;
  }
}

export const socialService = new SocialService();
