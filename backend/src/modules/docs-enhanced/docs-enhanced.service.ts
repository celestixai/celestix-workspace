import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { AppError } from '../../middleware/error-handler';
import type {
  DocsHubQuery,
  CreateSubPageInput,
  PublishDocInput,
  CreateDocCommentInput,
  UpdateDocCommentInput,
  CreateDocTemplateInput,
  CreateFromTemplateInput,
  SaveAsTemplateInput,
} from './docs-enhanced.validation';

const userSelect = { id: true, displayName: true, avatarUrl: true, username: true } as const;

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 200);
}

export class DocsEnhancedService {
  // ==================================
  // DOCS HUB
  // ==================================

  async getDocsHub(userId: string, query: DocsHubQuery) {
    const { workspaceId, filter, search } = query;

    const where: Prisma.DocumentWhereInput = {
      parentDocId: null, // only top-level docs
    };

    // Base access: own docs or shared
    const accessConditions: Prisma.DocumentWhereInput[] = [
      { userId },
      { collaborators: { some: { userId } } },
      { isPublic: true },
    ];

    switch (filter) {
      case 'wikis':
        where.isWiki = true;
        where.OR = accessConditions;
        break;
      case 'myDocs':
        where.userId = userId;
        break;
      case 'shared':
        where.collaborators = { some: { userId } };
        where.NOT = { userId };
        break;
      case 'recent':
        where.OR = accessConditions;
        break;
      case 'favorites':
        // For now treat favorites same as all (future: separate favorites table)
        where.OR = accessConditions;
        break;
      default: // 'all'
        where.OR = accessConditions;
        break;
    }

    if (search) {
      where.title = { contains: search, mode: 'insensitive' };
    }

    const documents = await prisma.document.findMany({
      where,
      include: {
        user: { select: userSelect },
        _count: {
          select: {
            comments: true,
            versions: true,
            subPages: true,
            enhancedComments: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });

    return documents;
  }

  // ==================================
  // WIKI TOGGLE
  // ==================================

  async toggleWiki(docId: string, userId: string) {
    const doc = await prisma.document.findFirst({
      where: { id: docId, userId },
    });
    if (!doc) {
      throw new AppError(404, 'Document not found or not owner', 'NOT_FOUND');
    }

    const updated = await prisma.document.update({
      where: { id: docId },
      data: { isWiki: !doc.isWiki },
      include: { user: { select: userSelect } },
    });

    return updated;
  }

  // ==================================
  // SUB-PAGES
  // ==================================

  async createSubPage(parentDocId: string, userId: string, input: CreateSubPageInput) {
    const parentDoc = await prisma.document.findFirst({
      where: {
        id: parentDocId,
        OR: [
          { userId },
          { collaborators: { some: { userId, permission: 'edit' } } },
        ],
      },
    });
    if (!parentDoc) {
      throw new AppError(404, 'Parent document not found or no edit access', 'NOT_FOUND');
    }

    const subPage = await prisma.document.create({
      data: {
        userId,
        title: input.title,
        contentJson: input.contentJson,
        contentHtml: input.contentHtml,
        icon: input.icon,
        parentDocId,
        depth: parentDoc.depth + 1,
        spaceId: parentDoc.spaceId,
      },
      include: {
        user: { select: userSelect },
        _count: { select: { subPages: true, enhancedComments: true } },
      },
    });

    return subPage;
  }

  async getSubPages(docId: string) {
    const subPages = await prisma.document.findMany({
      where: { parentDocId: docId },
      include: {
        user: { select: userSelect },
        subPages: {
          include: {
            user: { select: userSelect },
            subPages: {
              include: { user: { select: userSelect } },
              orderBy: { createdAt: 'asc' },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return subPages;
  }

  // ==================================
  // PUBLISHING
  // ==================================

  async publishDoc(docId: string, userId: string, input: PublishDocInput) {
    const doc = await prisma.document.findFirst({
      where: { id: docId, userId },
    });
    if (!doc) {
      throw new AppError(404, 'Document not found or not owner', 'NOT_FOUND');
    }

    let slug = input.customSlug ? slugify(input.customSlug) : slugify(doc.title);

    // Ensure slug uniqueness
    const existing = await prisma.document.findUnique({ where: { slug } });
    if (existing && existing.id !== docId) {
      slug = `${slug}-${Date.now().toString(36)}`;
    }

    const publishedUrl = `/docs/public/${slug}`;

    const updated = await prisma.document.update({
      where: { id: docId },
      data: { isPublished: true, slug, publishedUrl },
      include: { user: { select: userSelect } },
    });

    return updated;
  }

  async unpublishDoc(docId: string, userId: string) {
    const doc = await prisma.document.findFirst({
      where: { id: docId, userId },
    });
    if (!doc) {
      throw new AppError(404, 'Document not found or not owner', 'NOT_FOUND');
    }

    const updated = await prisma.document.update({
      where: { id: docId },
      data: { isPublished: false, slug: null, publishedUrl: null },
      include: { user: { select: userSelect } },
    });

    return updated;
  }

  async getPublishedDoc(slug: string) {
    const doc = await prisma.document.findFirst({
      where: { slug, isPublished: true },
      include: {
        user: { select: userSelect },
        subPages: {
          where: { isPublished: true },
          select: { id: true, title: true, slug: true, icon: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!doc) {
      throw new AppError(404, 'Published document not found', 'NOT_FOUND');
    }

    return doc;
  }

  // ==================================
  // DOC-TASK LINKING
  // ==================================

  async linkDocToTask(docId: string, taskId: string, userId: string) {
    const doc = await prisma.document.findFirst({
      where: {
        id: docId,
        OR: [{ userId }, { collaborators: { some: { userId } } }],
      },
    });
    if (!doc) {
      throw new AppError(404, 'Document not found', 'NOT_FOUND');
    }

    // Store linked tasks in contentJson metadata
    const metadata = (doc.contentJson as any) || {};
    const linkedTasks: string[] = metadata._linkedTasks || [];
    if (!linkedTasks.includes(taskId)) {
      linkedTasks.push(taskId);
    }

    const updated = await prisma.document.update({
      where: { id: docId },
      data: {
        contentJson: { ...metadata, _linkedTasks: linkedTasks } as any,
      },
    });

    return updated;
  }

  async getDocsForTask(taskId: string, userId: string) {
    // Find documents that have this taskId in their linked tasks metadata
    const allDocs = await prisma.document.findMany({
      where: {
        OR: [{ userId }, { collaborators: { some: { userId } } }, { isPublic: true }],
      },
      include: { user: { select: userSelect } },
    });

    const linkedDocs = allDocs.filter((doc) => {
      const metadata = (doc.contentJson as any) || {};
      const linkedTasks: string[] = metadata._linkedTasks || [];
      return linkedTasks.includes(taskId);
    });

    return linkedDocs;
  }

  // ==================================
  // ENHANCED COMMENTS
  // ==================================

  async getDocComments(docId: string, userId: string) {
    // Verify access
    const doc = await prisma.document.findFirst({
      where: {
        id: docId,
        OR: [{ userId }, { collaborators: { some: { userId } } }, { isPublic: true }],
      },
    });
    if (!doc) {
      throw new AppError(404, 'Document not found', 'NOT_FOUND');
    }

    const comments = await prisma.docCommentEnhanced.findMany({
      where: { documentId: docId, parentCommentId: null },
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

  async createDocComment(docId: string, userId: string, input: CreateDocCommentInput) {
    const doc = await prisma.document.findFirst({
      where: {
        id: docId,
        OR: [{ userId }, { collaborators: { some: { userId } } }],
      },
    });
    if (!doc) {
      throw new AppError(404, 'Document not found', 'NOT_FOUND');
    }

    const comment = await prisma.docCommentEnhanced.create({
      data: {
        documentId: docId,
        userId,
        content: input.content,
        highlightedText: input.highlightedText,
        positionJson: input.positionJson,
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

    return comment;
  }

  async updateDocComment(commentId: string, userId: string, input: UpdateDocCommentInput) {
    const comment = await prisma.docCommentEnhanced.findUnique({
      where: { id: commentId },
    });
    if (!comment) {
      throw new AppError(404, 'Comment not found', 'NOT_FOUND');
    }

    // Only author can update content
    if (input.content && comment.userId !== userId) {
      throw new AppError(403, 'Only comment author can edit', 'FORBIDDEN');
    }

    const updated = await prisma.docCommentEnhanced.update({
      where: { id: commentId },
      data: {
        content: input.content,
        isResolved: input.isResolved,
      },
      include: { user: { select: userSelect } },
    });

    return updated;
  }

  async deleteDocComment(commentId: string, userId: string) {
    const comment = await prisma.docCommentEnhanced.findUnique({
      where: { id: commentId },
      include: { document: { select: { userId: true } } },
    });
    if (!comment) {
      throw new AppError(404, 'Comment not found', 'NOT_FOUND');
    }
    if (comment.userId !== userId && comment.document.userId !== userId) {
      throw new AppError(403, 'Cannot delete this comment', 'FORBIDDEN');
    }

    await prisma.docCommentEnhanced.delete({ where: { id: commentId } });
  }

  async resolveDocComment(commentId: string, userId: string) {
    const comment = await prisma.docCommentEnhanced.findUnique({
      where: { id: commentId },
    });
    if (!comment) {
      throw new AppError(404, 'Comment not found', 'NOT_FOUND');
    }

    const updated = await prisma.docCommentEnhanced.update({
      where: { id: commentId },
      data: { isResolved: !comment.isResolved },
      include: { user: { select: userSelect } },
    });

    return updated;
  }

  // ==================================
  // TEMPLATES
  // ==================================

  async getDocTemplates(workspaceId: string) {
    const templates = await prisma.docTemplate.findMany({
      where: { workspaceId },
      include: { createdBy: { select: userSelect } },
      orderBy: { createdAt: 'desc' },
    });

    return templates;
  }

  async createDocTemplate(userId: string, input: CreateDocTemplateInput) {
    const template = await prisma.docTemplate.create({
      data: {
        workspaceId: input.workspaceId,
        name: input.name,
        description: input.description,
        content: input.content,
        contentJson: input.contentJson,
        category: input.category,
        createdById: userId,
      },
      include: { createdBy: { select: userSelect } },
    });

    return template;
  }

  async createDocFromTemplate(templateId: string, userId: string, parentDocId?: string) {
    const template = await prisma.docTemplate.findUnique({
      where: { id: templateId },
    });
    if (!template) {
      throw new AppError(404, 'Template not found', 'NOT_FOUND');
    }

    let depth = 0;
    let spaceId: string | null = null;
    if (parentDocId) {
      const parent = await prisma.document.findUnique({ where: { id: parentDocId } });
      if (parent) {
        depth = parent.depth + 1;
        spaceId = parent.spaceId;
      }
    }

    const doc = await prisma.document.create({
      data: {
        userId,
        title: template.name,
        contentHtml: template.content,
        contentJson: template.contentJson ?? undefined,
        parentDocId,
        depth,
        spaceId,
      },
      include: {
        user: { select: userSelect },
        _count: { select: { subPages: true, enhancedComments: true } },
      },
    });

    return doc;
  }

  async saveDocAsTemplate(docId: string, userId: string, name: string, workspaceId: string, description?: string, category?: string) {
    const doc = await prisma.document.findFirst({
      where: {
        id: docId,
        OR: [{ userId }, { collaborators: { some: { userId } } }],
      },
    });
    if (!doc) {
      throw new AppError(404, 'Document not found', 'NOT_FOUND');
    }

    const template = await prisma.docTemplate.create({
      data: {
        workspaceId,
        name,
        description,
        content: doc.contentHtml || '',
        contentJson: doc.contentJson ?? undefined,
        category,
        createdById: userId,
      },
      include: { createdBy: { select: userSelect } },
    });

    return template;
  }
}

export const docsEnhancedService = new DocsEnhancedService();
