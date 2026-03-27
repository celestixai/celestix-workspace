import { prisma } from '../../config/database';
import { AppError } from '../../middleware/error-handler';
import type { CreateTagInput, UpdateTagInput } from './tags.validation';

class TagsService {
  async getTags(workspaceId: string) {
    return prisma.workspaceTag.findMany({
      where: { workspaceId },
      orderBy: { name: 'asc' },
      include: {
        createdBy: { select: { id: true, displayName: true, avatarUrl: true } },
        _count: { select: { tasks: true } },
      },
    });
  }

  async createTag(workspaceId: string, userId: string, data: CreateTagInput) {
    // Check for duplicate name
    const existing = await prisma.workspaceTag.findUnique({
      where: { workspaceId_name: { workspaceId, name: data.name } },
    });
    if (existing) {
      throw new AppError(409, 'A tag with this name already exists in this workspace', 'DUPLICATE');
    }

    return prisma.workspaceTag.create({
      data: {
        workspaceId,
        createdById: userId,
        name: data.name,
        color: data.color ?? '#4F8EF7',
        description: data.description,
      },
      include: {
        createdBy: { select: { id: true, displayName: true, avatarUrl: true } },
        _count: { select: { tasks: true } },
      },
    });
  }

  async updateTag(tagId: string, data: UpdateTagInput) {
    const tag = await prisma.workspaceTag.findUnique({ where: { id: tagId } });
    if (!tag) {
      throw new AppError(404, 'Tag not found', 'NOT_FOUND');
    }

    // If renaming, check uniqueness
    if (data.name && data.name !== tag.name) {
      const existing = await prisma.workspaceTag.findUnique({
        where: { workspaceId_name: { workspaceId: tag.workspaceId, name: data.name } },
      });
      if (existing) {
        throw new AppError(409, 'A tag with this name already exists in this workspace', 'DUPLICATE');
      }
    }

    return prisma.workspaceTag.update({
      where: { id: tagId },
      data: {
        name: data.name,
        color: data.color,
        description: data.description,
      },
      include: {
        createdBy: { select: { id: true, displayName: true, avatarUrl: true } },
        _count: { select: { tasks: true } },
      },
    });
  }

  async deleteTag(tagId: string) {
    const tag = await prisma.workspaceTag.findUnique({ where: { id: tagId } });
    if (!tag) {
      throw new AppError(404, 'Tag not found', 'NOT_FOUND');
    }

    // Cascade delete will remove all task_tags_new entries
    await prisma.workspaceTag.delete({ where: { id: tagId } });
  }

  async addTagsToTask(taskId: string, tagIds: string[]) {
    // Verify task exists
    const task = await prisma.task.findFirst({ where: { id: taskId, deletedAt: null } });
    if (!task) {
      throw new AppError(404, 'Task not found', 'NOT_FOUND');
    }

    // Get existing tags on this task
    const existing = await prisma.taskTag.findMany({
      where: { taskId, tagId: { in: tagIds } },
      select: { tagId: true },
    });
    const existingIds = new Set(existing.map((t) => t.tagId));
    const newIds = tagIds.filter((id) => !existingIds.has(id));

    if (newIds.length > 0) {
      await prisma.taskTag.createMany({
        data: newIds.map((tagId) => ({ taskId, tagId })),
      });
    }

    return this.getTaskTags(taskId);
  }

  async removeTagFromTask(taskId: string, tagId: string) {
    const taskTag = await prisma.taskTag.findUnique({
      where: { taskId_tagId: { taskId, tagId } },
    });
    if (!taskTag) {
      throw new AppError(404, 'Tag is not assigned to this task', 'NOT_FOUND');
    }

    await prisma.taskTag.delete({ where: { id: taskTag.id } });
    return this.getTaskTags(taskId);
  }

  async getTaskTags(taskId: string) {
    const taskTags = await prisma.taskTag.findMany({
      where: { taskId },
      include: { tag: { select: { id: true, name: true, color: true, description: true } } },
      orderBy: { tag: { name: 'asc' } },
    });
    return taskTags.map((tt) => tt.tag);
  }
}

export const tagsService = new TagsService();
