import { prisma } from '../../config/database';
import { AppError } from '../../middleware/error-handler';
import type {
  CreateSiteInput,
  UpdateSiteInput,
  CreatePageInput,
  UpdatePageInput,
  CreateNewsPostInput,
  UpdateNewsPostInput,
  CreateNewsCommentInput,
} from './sites.schema';

const userSelect = { id: true, displayName: true, avatarUrl: true, email: true } as const;

export class SitesService {
  // ==================================
  // SITE CRUD
  // ==================================

  async createSite(userId: string, input: CreateSiteInput) {
    const site = await prisma.site.create({
      data: {
        name: input.name,
        type: (input.type as 'TEAM' | 'COMMUNICATION') ?? 'TEAM',
        description: input.description,
        logoPath: input.logoPath,
        theme: input.theme ?? { primaryColor: '#4F8EF7', font: 'Inter' },
        navigation: input.navigation ?? [],
        createdBy: userId,
      },
      include: {
        creator: { select: userSelect },
        _count: { select: { pages: true, newsPosts: true } },
      },
    });

    return site;
  }

  async getSites(userId: string) {
    const sites = await prisma.site.findMany({
      where: { createdBy: userId },
      include: {
        creator: { select: userSelect },
        _count: { select: { pages: true, newsPosts: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return sites;
  }

  async getSiteById(userId: string, siteId: string) {
    const site = await prisma.site.findFirst({
      where: { id: siteId, createdBy: userId },
      include: {
        creator: { select: userSelect },
        pages: {
          select: { id: true, title: true, slug: true, isPublished: true, isHomepage: true, updatedAt: true },
          orderBy: { createdAt: 'asc' },
        },
        _count: { select: { pages: true, newsPosts: true } },
      },
    });

    if (!site) {
      throw new AppError(404, 'Site not found', 'NOT_FOUND');
    }

    return site;
  }

  async updateSite(userId: string, siteId: string, input: UpdateSiteInput) {
    const existing = await prisma.site.findFirst({
      where: { id: siteId, createdBy: userId },
    });
    if (!existing) {
      throw new AppError(404, 'Site not found', 'NOT_FOUND');
    }

    const site = await prisma.site.update({
      where: { id: siteId },
      data: {
        name: input.name,
        description: input.description,
        logoPath: input.logoPath,
        theme: input.theme,
        navigation: input.navigation,
      },
      include: {
        creator: { select: userSelect },
        _count: { select: { pages: true, newsPosts: true } },
      },
    });

    return site;
  }

  async deleteSite(userId: string, siteId: string) {
    const existing = await prisma.site.findFirst({
      where: { id: siteId, createdBy: userId },
    });
    if (!existing) {
      throw new AppError(404, 'Site not found', 'NOT_FOUND');
    }

    await prisma.site.delete({ where: { id: siteId } });
  }

  // ==================================
  // PAGE CRUD
  // ==================================

  async createPage(userId: string, siteId: string, input: CreatePageInput) {
    await this.requireSiteOwnership(userId, siteId);

    // If this is set as homepage, unset any existing homepage
    if (input.isHomepage) {
      await prisma.sitePage.updateMany({
        where: { siteId, isHomepage: true },
        data: { isHomepage: false },
      });
    }

    const page = await prisma.sitePage.create({
      data: {
        siteId,
        title: input.title,
        slug: input.slug,
        sections: input.sections ?? [],
        isHomepage: input.isHomepage ?? false,
        createdBy: userId,
      },
      include: {
        creator: { select: userSelect },
      },
    });

    return page;
  }

  async getPages(userId: string, siteId: string) {
    await this.requireSiteOwnership(userId, siteId);

    const pages = await prisma.sitePage.findMany({
      where: { siteId },
      include: {
        creator: { select: userSelect },
      },
      orderBy: { createdAt: 'asc' },
    });

    return pages;
  }

  async getPageById(userId: string, siteId: string, pageId: string) {
    await this.requireSiteOwnership(userId, siteId);

    const page = await prisma.sitePage.findFirst({
      where: { id: pageId, siteId },
      include: {
        creator: { select: userSelect },
      },
    });

    if (!page) {
      throw new AppError(404, 'Page not found', 'NOT_FOUND');
    }

    return page;
  }

  async updatePage(userId: string, siteId: string, pageId: string, input: UpdatePageInput) {
    await this.requireSiteOwnership(userId, siteId);

    const existing = await prisma.sitePage.findFirst({
      where: { id: pageId, siteId },
    });
    if (!existing) {
      throw new AppError(404, 'Page not found', 'NOT_FOUND');
    }

    // If this is being set as homepage, unset any existing homepage
    if (input.isHomepage) {
      await prisma.sitePage.updateMany({
        where: { siteId, isHomepage: true, id: { not: pageId } },
        data: { isHomepage: false },
      });
    }

    const page = await prisma.sitePage.update({
      where: { id: pageId },
      data: {
        title: input.title,
        slug: input.slug,
        sections: input.sections,
        isPublished: input.isPublished,
        isHomepage: input.isHomepage,
      },
      include: {
        creator: { select: userSelect },
      },
    });

    return page;
  }

  async deletePage(userId: string, siteId: string, pageId: string) {
    await this.requireSiteOwnership(userId, siteId);

    const existing = await prisma.sitePage.findFirst({
      where: { id: pageId, siteId },
    });
    if (!existing) {
      throw new AppError(404, 'Page not found', 'NOT_FOUND');
    }

    await prisma.sitePage.delete({ where: { id: pageId } });
  }

  async getHomepage(userId: string, siteId: string) {
    await this.requireSiteOwnership(userId, siteId);

    const page = await prisma.sitePage.findFirst({
      where: { siteId, isHomepage: true },
      include: {
        creator: { select: userSelect },
      },
    });

    if (!page) {
      throw new AppError(404, 'No homepage set for this site', 'NOT_FOUND');
    }

    return page;
  }

  async publishPage(userId: string, siteId: string, pageId: string) {
    await this.requireSiteOwnership(userId, siteId);

    const existing = await prisma.sitePage.findFirst({
      where: { id: pageId, siteId },
    });
    if (!existing) {
      throw new AppError(404, 'Page not found', 'NOT_FOUND');
    }

    const page = await prisma.sitePage.update({
      where: { id: pageId },
      data: { isPublished: true },
      include: {
        creator: { select: userSelect },
      },
    });

    return page;
  }

  async getPublishedPages(userId: string, siteId: string) {
    await this.requireSiteOwnership(userId, siteId);

    const pages = await prisma.sitePage.findMany({
      where: { siteId, isPublished: true },
      include: {
        creator: { select: userSelect },
      },
      orderBy: { createdAt: 'asc' },
    });

    return pages;
  }

  // ==================================
  // NEWS POST CRUD
  // ==================================

  async createNewsPost(userId: string, siteId: string, input: CreateNewsPostInput) {
    await this.requireSiteOwnership(userId, siteId);

    const post = await prisma.newsPost.create({
      data: {
        siteId,
        userId,
        title: input.title,
        bodyHtml: input.bodyHtml,
        coverImage: input.coverImage,
        isPinned: input.isPinned ?? false,
        categories: input.categories ?? [],
      },
      include: {
        author: { select: userSelect },
        _count: { select: { comments: true } },
      },
    });

    return post;
  }

  async getNewsPosts(userId: string, siteId: string) {
    await this.requireSiteOwnership(userId, siteId);

    const posts = await prisma.newsPost.findMany({
      where: { siteId },
      include: {
        author: { select: userSelect },
        _count: { select: { comments: true } },
      },
      orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
    });

    return posts;
  }

  async getNewsPostById(userId: string, siteId: string, postId: string) {
    await this.requireSiteOwnership(userId, siteId);

    const post = await prisma.newsPost.findFirst({
      where: { id: postId, siteId },
      include: {
        author: { select: userSelect },
        comments: {
          include: { user: { select: userSelect } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!post) {
      throw new AppError(404, 'News post not found', 'NOT_FOUND');
    }

    return post;
  }

  async updateNewsPost(userId: string, siteId: string, postId: string, input: UpdateNewsPostInput) {
    await this.requireSiteOwnership(userId, siteId);

    const existing = await prisma.newsPost.findFirst({
      where: { id: postId, siteId },
    });
    if (!existing) {
      throw new AppError(404, 'News post not found', 'NOT_FOUND');
    }

    const post = await prisma.newsPost.update({
      where: { id: postId },
      data: {
        title: input.title,
        bodyHtml: input.bodyHtml,
        coverImage: input.coverImage,
        isPinned: input.isPinned,
        categories: input.categories,
        publishedAt: input.publishedAt === null ? null : input.publishedAt ? new Date(input.publishedAt) : undefined,
      },
      include: {
        author: { select: userSelect },
        _count: { select: { comments: true } },
      },
    });

    return post;
  }

  async deleteNewsPost(userId: string, siteId: string, postId: string) {
    await this.requireSiteOwnership(userId, siteId);

    const existing = await prisma.newsPost.findFirst({
      where: { id: postId, siteId },
    });
    if (!existing) {
      throw new AppError(404, 'News post not found', 'NOT_FOUND');
    }

    await prisma.newsPost.delete({ where: { id: postId } });
  }

  // ==================================
  // NEWS COMMENT CRUD
  // ==================================

  async createNewsComment(userId: string, postId: string, input: CreateNewsCommentInput) {
    const post = await prisma.newsPost.findUnique({ where: { id: postId } });
    if (!post) {
      throw new AppError(404, 'News post not found', 'NOT_FOUND');
    }

    const comment = await prisma.newsComment.create({
      data: {
        postId,
        userId,
        body: input.body,
      },
      include: {
        user: { select: userSelect },
      },
    });

    return comment;
  }

  async getNewsComments(postId: string) {
    const post = await prisma.newsPost.findUnique({ where: { id: postId } });
    if (!post) {
      throw new AppError(404, 'News post not found', 'NOT_FOUND');
    }

    const comments = await prisma.newsComment.findMany({
      where: { postId },
      include: {
        user: { select: userSelect },
      },
      orderBy: { createdAt: 'asc' },
    });

    return comments;
  }

  async deleteNewsComment(userId: string, commentId: string) {
    const comment = await prisma.newsComment.findUnique({ where: { id: commentId } });
    if (!comment) {
      throw new AppError(404, 'Comment not found', 'NOT_FOUND');
    }
    if (comment.userId !== userId) {
      throw new AppError(403, 'Cannot delete others\' comments', 'FORBIDDEN');
    }

    await prisma.newsComment.delete({ where: { id: commentId } });
  }

  // ==================================
  // PRIVATE HELPERS
  // ==================================

  private async requireSiteOwnership(userId: string, siteId: string) {
    const site = await prisma.site.findFirst({
      where: { id: siteId, createdBy: userId },
    });
    if (!site) {
      throw new AppError(404, 'Site not found', 'NOT_FOUND');
    }
    return site;
  }
}

export const sitesService = new SitesService();
