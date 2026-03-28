import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { AppError } from '../../middleware/error-handler';
import type {
  CreateDocumentInput,
  UpdateDocumentInput,
  CreateCommentInput,
  UpdateCommentInput,
  AddCollaboratorInput,
  CreateVersionInput,
  ExportDocumentInput,
  ImportDocumentInput,
} from './documents.schema';

const userSelect = { id: true, displayName: true, avatarUrl: true, username: true } as const;

const documentInclude = {
  user: { select: userSelect },
  collaborators: {
    include: { user: { select: userSelect } },
  },
  _count: { select: { comments: true, versions: true } },
} as const;

export class DocumentService {
  // ==================================
  // DOCUMENT CRUD
  // ==================================

  async create(userId: string, input: CreateDocumentInput) {
    const document = await prisma.document.create({
      data: {
        userId,
        title: input.title,
        contentJson: input.contentJson,
        contentHtml: input.contentHtml,
        templateId: input.templateId,
        isPublic: input.isPublic ?? false,
      },
      include: documentInclude,
    });

    return document;
  }

  async getAll(userId: string) {
    const documents = await prisma.document.findMany({
      where: {
        OR: [
          { userId },
          { collaborators: { some: { userId } } },
        ],
      },
      include: documentInclude,
      orderBy: { updatedAt: 'desc' },
    });

    return documents;
  }

  async getById(userId: string, documentId: string) {
    const document = await prisma.document.findFirst({
      where: {
        id: documentId,
        OR: [
          { userId },
          { collaborators: { some: { userId } } },
          { isPublic: true },
        ],
      },
      include: {
        ...documentInclude,
        versions: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: { id: true, version: true, comment: true, createdBy: true, createdAt: true },
        },
      },
    });

    if (!document) {
      throw new AppError(404, 'Document not found', 'NOT_FOUND');
    }

    return document;
  }

  async update(userId: string, documentId: string, input: UpdateDocumentInput) {
    await this.requireEditAccess(userId, documentId);

    const document = await prisma.document.update({
      where: { id: documentId },
      data: {
        title: input.title,
        contentJson: input.contentJson,
        contentHtml: input.contentHtml === null ? null : input.contentHtml,
        wordCount: input.wordCount,
        isPublic: input.isPublic,
      },
      include: documentInclude,
    });

    return document;
  }

  async delete(userId: string, documentId: string) {
    const document = await prisma.document.findFirst({
      where: { id: documentId, userId },
    });
    if (!document) {
      throw new AppError(404, 'Document not found or not owner', 'NOT_FOUND');
    }

    await prisma.document.delete({ where: { id: documentId } });
  }

  // ==================================
  // VERSIONS
  // ==================================

  async createVersion(userId: string, documentId: string, input: CreateVersionInput) {
    await this.requireEditAccess(userId, documentId);

    // Get next version number
    const lastVersion = await prisma.documentVersion.findFirst({
      where: { documentId },
      orderBy: { version: 'desc' },
      select: { version: true },
    });

    const version = await prisma.documentVersion.create({
      data: {
        documentId,
        contentJson: input.contentJson,
        version: (lastVersion?.version ?? 0) + 1,
        comment: input.comment,
        createdBy: userId,
      },
    });

    return version;
  }

  async getVersions(userId: string, documentId: string) {
    await this.requireReadAccess(userId, documentId);

    const versions = await prisma.documentVersion.findMany({
      where: { documentId },
      orderBy: { version: 'desc' },
    });

    return versions;
  }

  async restoreVersion(userId: string, documentId: string, versionId: string) {
    await this.requireEditAccess(userId, documentId);

    const version = await prisma.documentVersion.findFirst({
      where: { id: versionId, documentId },
    });
    if (!version) {
      throw new AppError(404, 'Version not found', 'NOT_FOUND');
    }

    // Save current content as a new version before restoring
    const document = await prisma.document.findUnique({
      where: { id: documentId },
    });
    if (document?.contentJson) {
      const lastVersion = await prisma.documentVersion.findFirst({
        where: { documentId },
        orderBy: { version: 'desc' },
        select: { version: true },
      });

      await prisma.documentVersion.create({
        data: {
          documentId,
          contentJson: document.contentJson,
          version: (lastVersion?.version ?? 0) + 1,
          comment: 'Auto-saved before restore',
          createdBy: userId,
        },
      });
    }

    // Restore the content from the selected version
    const updated = await prisma.document.update({
      where: { id: documentId },
      data: {
        contentJson: version.contentJson ?? Prisma.JsonNull,
      },
      include: documentInclude,
    });

    return updated;
  }

  // ==================================
  // COMMENTS
  // ==================================

  async addComment(userId: string, documentId: string, input: CreateCommentInput) {
    await this.requireReadAccess(userId, documentId);

    // Check permission level for commenting
    const doc = await prisma.document.findUnique({ where: { id: documentId } });
    if (doc && doc.userId !== userId) {
      const collab = await prisma.documentCollaborator.findUnique({
        where: { documentId_userId: { documentId, userId } },
      });
      if (collab && collab.permission === 'view') {
        throw new AppError(403, 'View-only collaborators cannot comment', 'FORBIDDEN');
      }
    }

    const comment = await prisma.documentComment.create({
      data: {
        documentId,
        userId,
        text: input.text,
        selectionFrom: input.selectionFrom,
        selectionTo: input.selectionTo,
        parentId: input.parentId,
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

  async getComments(userId: string, documentId: string) {
    await this.requireReadAccess(userId, documentId);

    const comments = await prisma.documentComment.findMany({
      where: { documentId, parentId: null },
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

  async resolveComment(userId: string, commentId: string) {
    const comment = await prisma.documentComment.findUnique({
      where: { id: commentId },
    });
    if (!comment) {
      throw new AppError(404, 'Comment not found', 'NOT_FOUND');
    }

    await this.requireEditAccess(userId, comment.documentId);

    return prisma.documentComment.update({
      where: { id: commentId },
      data: { resolved: true },
      include: { user: { select: userSelect } },
    });
  }

  async deleteComment(userId: string, commentId: string) {
    const comment = await prisma.documentComment.findUnique({
      where: { id: commentId },
      include: { document: { select: { userId: true } } },
    });
    if (!comment) {
      throw new AppError(404, 'Comment not found', 'NOT_FOUND');
    }

    // Allow deletion by comment author or document owner
    if (comment.userId !== userId && comment.document.userId !== userId) {
      throw new AppError(403, 'Cannot delete this comment', 'FORBIDDEN');
    }

    await prisma.documentComment.delete({ where: { id: commentId } });
  }

  // ==================================
  // COLLABORATORS
  // ==================================

  async addCollaborator(userId: string, documentId: string, input: AddCollaboratorInput) {
    const document = await prisma.document.findFirst({
      where: { id: documentId, userId },
    });
    if (!document) {
      throw new AppError(404, 'Document not found or not owner', 'NOT_FOUND');
    }

    if (input.userId === userId) {
      throw new AppError(400, 'Cannot add yourself as a collaborator', 'INVALID_INPUT');
    }

    const collaborator = await prisma.documentCollaborator.upsert({
      where: { documentId_userId: { documentId, userId: input.userId } },
      create: {
        documentId,
        userId: input.userId,
        permission: input.permission,
      },
      update: {
        permission: input.permission,
      },
      include: { user: { select: userSelect } },
    });

    return collaborator;
  }

  async removeCollaborator(userId: string, documentId: string, targetUserId: string) {
    const document = await prisma.document.findFirst({
      where: { id: documentId, userId },
    });
    if (!document) {
      throw new AppError(404, 'Document not found or not owner', 'NOT_FOUND');
    }

    const collaborator = await prisma.documentCollaborator.findUnique({
      where: { documentId_userId: { documentId, userId: targetUserId } },
    });
    if (!collaborator) {
      throw new AppError(404, 'Collaborator not found', 'NOT_FOUND');
    }

    await prisma.documentCollaborator.delete({ where: { id: collaborator.id } });
  }

  async getCollaborators(userId: string, documentId: string) {
    await this.requireReadAccess(userId, documentId);

    const collaborators = await prisma.documentCollaborator.findMany({
      where: { documentId },
      include: { user: { select: userSelect } },
    });

    return collaborators;
  }

  // ==================================
  // EXPORT / IMPORT
  // ==================================

  async export(userId: string, documentId: string, input: ExportDocumentInput) {
    const document = await this.getById(userId, documentId);

    // Returns metadata for the export. Actual file conversion is future work.
    return {
      format: input.format,
      title: document.title,
      content: document.contentHtml ?? '',
      contentJson: document.contentJson,
      wordCount: document.wordCount,
      exportedAt: new Date().toISOString(),
    };
  }

  async import(userId: string, input: ImportDocumentInput) {
    const document = await prisma.document.create({
      data: {
        userId,
        title: input.title,
        contentHtml: input.contentHtml,
        contentJson: input.contentJson,
      },
      include: documentInclude,
    });

    return document;
  }

  // ==================================
  // PRIVATE HELPERS
  // ==================================

  private async requireReadAccess(userId: string, documentId: string) {
    const document = await prisma.document.findFirst({
      where: {
        id: documentId,
        OR: [
          { userId },
          { collaborators: { some: { userId } } },
          { isPublic: true },
        ],
      },
      select: { id: true },
    });

    if (!document) {
      throw new AppError(404, 'Document not found', 'NOT_FOUND');
    }
  }

  private async requireEditAccess(userId: string, documentId: string) {
    // Check if owner
    const ownDoc = await prisma.document.findFirst({
      where: { id: documentId, userId },
      select: { id: true },
    });
    if (ownDoc) return;

    // Check if collaborator with edit permission
    const collab = await prisma.documentCollaborator.findUnique({
      where: { documentId_userId: { documentId, userId } },
    });
    if (collab && collab.permission === 'edit') return;

    throw new AppError(403, 'No edit access to this document', 'FORBIDDEN');
  }
}

export const documentService = new DocumentService();
