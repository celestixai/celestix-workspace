import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { AppError } from '../../middleware/error-handler';
import { v4 as uuidv4 } from 'uuid';
import type { CreateNoteInput, UpdateNoteInput } from './notes.schema';

export class NotesService {
  async createNote(userId: string, input: CreateNoteInput) {
    return prisma.note.create({
      data: {
        userId,
        title: input.title,
        contentJson: input.contentJson,
        contentText: input.contentText,
        folderId: input.folderId,
        parentNoteId: input.parentNoteId,
        templateId: input.templateId,
      },
    });
  }

  async getNotes(userId: string, query: {
    folderId?: string | null;
    search?: string;
    tag?: string;
    starred?: boolean;
    pinned?: boolean;
    sortBy?: string;
    sortOrder?: string;
    page?: number;
    limit?: number;
  }) {
    const where: Record<string, unknown> = { userId, deletedAt: null };

    if (query.folderId !== undefined) {
      where.folderId = query.folderId || null;
    }
    if (query.starred) where.isStarred = true;
    if (query.pinned) where.isPinned = true;
    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { contentText: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    if (query.tag) {
      where.tags = { some: { tag: { name: query.tag } } };
    }

    const page = query.page || 1;
    const limit = query.limit || 50;

    const [notes, total] = await Promise.all([
      prisma.note.findMany({
        where,
        orderBy: [
          { isPinned: 'desc' },
          { [query.sortBy || 'updatedAt']: query.sortOrder || 'desc' },
        ],
        skip: (page - 1) * limit,
        take: limit,
        include: {
          tags: { include: { tag: true } },
          children: { select: { id: true, title: true }, take: 10 },
          shares: { select: { id: true, userId: true, permission: true } },
        },
      }),
      prisma.note.count({ where }),
    ]);

    return {
      notes,
      pagination: { total, page, limit, hasMore: page * limit < total },
    };
  }

  async getNote(userId: string, noteId: string) {
    const note = await prisma.note.findFirst({
      where: {
        id: noteId,
        OR: [
          { userId },
          { shares: { some: { userId } } },
        ],
        deletedAt: null,
      },
      include: {
        tags: { include: { tag: true } },
        children: { select: { id: true, title: true }, orderBy: { createdAt: 'asc' } },
        parentNote: { select: { id: true, title: true } },
        versions: { orderBy: { createdAt: 'desc' }, take: 20 },
        shares: { select: { id: true, userId: true, permission: true, shareToken: true } },
      },
    });

    if (!note) throw new AppError(404, 'Note not found', 'NOT_FOUND');
    return note;
  }

  async updateNote(userId: string, noteId: string, input: UpdateNoteInput) {
    const note = await prisma.note.findFirst({
      where: {
        id: noteId,
        OR: [
          { userId },
          { shares: { some: { userId, permission: 'EDIT' } } },
        ],
      },
    });

    if (!note) throw new AppError(404, 'Note not found or no edit permission', 'NOT_FOUND');

    // Save version before updating content
    if (input.contentJson && note.contentJson) {
      await prisma.noteVersion.create({
        data: { noteId, contentJson: note.contentJson },
      });
    }

    return prisma.note.update({
      where: { id: noteId },
      data: {
        ...input,
        contentJson: input.contentJson ?? undefined,
      },
    });
  }

  async deleteNote(userId: string, noteId: string) {
    const note = await prisma.note.findFirst({ where: { id: noteId, userId } });
    if (!note) throw new AppError(404, 'Note not found', 'NOT_FOUND');

    return prisma.note.update({
      where: { id: noteId },
      data: { deletedAt: new Date() },
    });
  }

  async restoreNote(userId: string, noteId: string) {
    const note = await prisma.note.findFirst({ where: { id: noteId, userId, deletedAt: { not: null } } });
    if (!note) throw new AppError(404, 'Note not found', 'NOT_FOUND');

    return prisma.note.update({
      where: { id: noteId },
      data: { deletedAt: null },
    });
  }

  async getVersion(userId: string, noteId: string, versionId: string) {
    const note = await prisma.note.findFirst({ where: { id: noteId, userId } });
    if (!note) throw new AppError(404, 'Note not found', 'NOT_FOUND');

    return prisma.noteVersion.findUnique({ where: { id: versionId } });
  }

  async restoreVersion(userId: string, noteId: string, versionId: string) {
    const note = await prisma.note.findFirst({ where: { id: noteId, userId } });
    if (!note) throw new AppError(404, 'Note not found', 'NOT_FOUND');

    const version = await prisma.noteVersion.findUnique({ where: { id: versionId } });
    if (!version) throw new AppError(404, 'Version not found', 'NOT_FOUND');

    // Save current as version
    if (note.contentJson) {
      await prisma.noteVersion.create({
        data: { noteId, contentJson: note.contentJson },
      });
    }

    return prisma.note.update({
      where: { id: noteId },
      data: { contentJson: version.contentJson ?? Prisma.JsonNull },
    });
  }

  // Folders
  async createFolder(userId: string, input: { name: string; parentFolderId?: string | null; icon?: string }) {
    return prisma.noteFolder.create({
      data: {
        userId,
        name: input.name,
        parentFolderId: input.parentFolderId,
        icon: input.icon,
      },
    });
  }

  async getFolders(userId: string) {
    return prisma.noteFolder.findMany({
      where: { userId },
      orderBy: { position: 'asc' },
      include: {
        children: { orderBy: { position: 'asc' } },
        _count: { select: { notes: true } },
      },
    });
  }

  async updateFolder(userId: string, folderId: string, input: { name?: string; icon?: string; position?: number }) {
    const folder = await prisma.noteFolder.findFirst({ where: { id: folderId, userId } });
    if (!folder) throw new AppError(404, 'Folder not found', 'NOT_FOUND');

    return prisma.noteFolder.update({ where: { id: folderId }, data: input });
  }

  async deleteFolder(userId: string, folderId: string) {
    const folder = await prisma.noteFolder.findFirst({ where: { id: folderId, userId } });
    if (!folder) throw new AppError(404, 'Folder not found', 'NOT_FOUND');

    // Move notes to root
    await prisma.note.updateMany({ where: { folderId }, data: { folderId: null } });
    // Move child folders to parent
    await prisma.noteFolder.updateMany({
      where: { parentFolderId: folderId },
      data: { parentFolderId: folder.parentFolderId },
    });

    await prisma.noteFolder.delete({ where: { id: folderId } });
  }

  // Tags
  async createTag(userId: string, input: { name: string; color?: string }) {
    return prisma.noteTag.create({
      data: { userId, name: input.name, color: input.color || '#4F8EF7' },
    });
  }

  async getTags(userId: string) {
    return prisma.noteTag.findMany({
      where: { userId },
      include: { _count: { select: { notes: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async deleteTag(userId: string, tagId: string) {
    const tag = await prisma.noteTag.findFirst({ where: { id: tagId, userId } });
    if (!tag) throw new AppError(404, 'Tag not found', 'NOT_FOUND');
    await prisma.noteTag.delete({ where: { id: tagId } });
  }

  async addTag(userId: string, noteId: string, tagId: string) {
    const note = await prisma.note.findFirst({ where: { id: noteId, userId } });
    if (!note) throw new AppError(404, 'Note not found', 'NOT_FOUND');

    return prisma.noteTagLink.upsert({
      where: { noteId_tagId: { noteId, tagId } },
      create: { noteId, tagId },
      update: {},
    });
  }

  async removeTag(noteId: string, tagId: string) {
    await prisma.noteTagLink.delete({
      where: { noteId_tagId: { noteId, tagId } },
    });
  }

  // Sharing
  async shareNote(userId: string, noteId: string, input: { userId?: string; permission: 'VIEW' | 'EDIT'; generateLink?: boolean }) {
    const note = await prisma.note.findFirst({ where: { id: noteId, userId } });
    if (!note) throw new AppError(404, 'Note not found', 'NOT_FOUND');

    const data: Record<string, unknown> = {
      noteId,
      permission: input.permission,
    };

    if (input.userId) data.userId = input.userId;
    if (input.generateLink) data.shareToken = uuidv4();

    return prisma.noteShare.create({ data: data as never });
  }

  async getSharedNote(token: string) {
    const share = await prisma.noteShare.findUnique({
      where: { shareToken: token },
      include: { note: true },
    });
    if (!share) throw new AppError(404, 'Note not found', 'NOT_FOUND');
    return share.note;
  }

  // Templates
  async getTemplates() {
    return [
      { id: 'blank', name: 'Blank', contentJson: { type: 'doc', content: [{ type: 'paragraph' }] } },
      { id: 'meeting', name: 'Meeting Notes', contentJson: {
        type: 'doc',
        content: [
          { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Meeting Notes' }] },
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Date' }] },
          { type: 'paragraph', content: [{ type: 'text', text: '' }] },
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Attendees' }] },
          { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph' }] }] },
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Agenda' }] },
          { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph' }] }] },
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Action Items' }] },
          { type: 'taskList', content: [{ type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph' }] }] },
        ],
      }},
      { id: 'project-brief', name: 'Project Brief', contentJson: {
        type: 'doc',
        content: [
          { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Project Brief' }] },
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Overview' }] },
          { type: 'paragraph' },
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Goals' }] },
          { type: 'orderedList', content: [{ type: 'listItem', content: [{ type: 'paragraph' }] }] },
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Timeline' }] },
          { type: 'paragraph' },
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Resources' }] },
          { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph' }] }] },
        ],
      }},
      { id: 'weekly', name: 'Weekly Planning', contentJson: {
        type: 'doc',
        content: [
          { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Weekly Plan' }] },
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Priorities' }] },
          { type: 'taskList', content: [{ type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph' }] }] },
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Notes' }] },
          { type: 'paragraph' },
        ],
      }},
    ];
  }
}

export const notesService = new NotesService();
