import { prisma } from '../../../config/database';
import { AppError } from '../../../middleware/error-handler';
import type {
  CreateChecklistInput,
  UpdateChecklistInput,
  CreateItemInput,
  UpdateItemInput,
  ReorderItemsInput,
} from './checklists.validation';

const itemInclude = {
  assignee: {
    select: { id: true, displayName: true, avatarUrl: true, email: true },
  },
} as const;

class ChecklistsService {
  // ==================================
  // CHECKLIST CRUD
  // ==================================

  async getChecklists(taskId: string) {
    const checklists = await prisma.checklist.findMany({
      where: { taskId },
      orderBy: { position: 'asc' },
      include: {
        items: {
          orderBy: { position: 'asc' },
          include: itemInclude,
        },
      },
    });

    return checklists.map((cl) => {
      const total = cl.items.length;
      const completed = cl.items.filter((i) => i.isCompleted).length;
      return {
        ...cl,
        completionProgress: {
          total,
          completed,
          percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
        },
      };
    });
  }

  async createChecklist(taskId: string, input: CreateChecklistInput) {
    // Verify task exists
    const task = await prisma.task.findFirst({ where: { id: taskId, deletedAt: null } });
    if (!task) throw new AppError(404, 'Task not found', 'NOT_FOUND');

    // Auto-position: next available
    const maxPos = await prisma.checklist.aggregate({
      where: { taskId },
      _max: { position: true },
    });
    const position = (maxPos._max.position ?? -1) + 1;

    return prisma.checklist.create({
      data: { taskId, name: input.name, position },
      include: {
        items: {
          orderBy: { position: 'asc' },
          include: itemInclude,
        },
      },
    });
  }

  async updateChecklist(checklistId: string, input: UpdateChecklistInput) {
    const checklist = await prisma.checklist.findUnique({ where: { id: checklistId } });
    if (!checklist) throw new AppError(404, 'Checklist not found', 'NOT_FOUND');

    return prisma.checklist.update({
      where: { id: checklistId },
      data: { ...input },
      include: {
        items: {
          orderBy: { position: 'asc' },
          include: itemInclude,
        },
      },
    });
  }

  async deleteChecklist(checklistId: string) {
    const checklist = await prisma.checklist.findUnique({ where: { id: checklistId } });
    if (!checklist) throw new AppError(404, 'Checklist not found', 'NOT_FOUND');

    // Items cascade-delete via schema onDelete: Cascade
    await prisma.checklist.delete({ where: { id: checklistId } });
  }

  async updateChecklistPosition(checklistId: string, position: number) {
    const checklist = await prisma.checklist.findUnique({ where: { id: checklistId } });
    if (!checklist) throw new AppError(404, 'Checklist not found', 'NOT_FOUND');

    return prisma.checklist.update({
      where: { id: checklistId },
      data: { position },
    });
  }

  // ==================================
  // CHECKLIST ITEMS
  // ==================================

  async addItem(checklistId: string, input: CreateItemInput) {
    const checklist = await prisma.checklist.findUnique({ where: { id: checklistId } });
    if (!checklist) throw new AppError(404, 'Checklist not found', 'NOT_FOUND');

    const maxPos = await prisma.checklistItem.aggregate({
      where: { checklistId },
      _max: { position: true },
    });
    const position = (maxPos._max.position ?? -1) + 1;

    return prisma.checklistItem.create({
      data: {
        checklistId,
        name: input.name,
        assigneeId: input.assigneeId ?? null,
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        position,
      },
      include: itemInclude,
    });
  }

  async updateItem(itemId: string, input: UpdateItemInput) {
    const item = await prisma.checklistItem.findUnique({ where: { id: itemId } });
    if (!item) throw new AppError(404, 'Checklist item not found', 'NOT_FOUND');

    const data: Record<string, unknown> = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.isCompleted !== undefined) data.isCompleted = input.isCompleted;
    if (input.assigneeId !== undefined) data.assigneeId = input.assigneeId;
    if (input.dueDate !== undefined) {
      data.dueDate = input.dueDate ? new Date(input.dueDate) : null;
    }

    return prisma.checklistItem.update({
      where: { id: itemId },
      data,
      include: itemInclude,
    });
  }

  async deleteItem(itemId: string) {
    const item = await prisma.checklistItem.findUnique({ where: { id: itemId } });
    if (!item) throw new AppError(404, 'Checklist item not found', 'NOT_FOUND');

    await prisma.checklistItem.delete({ where: { id: itemId } });
  }

  async reorderItems(checklistId: string, input: ReorderItemsInput) {
    const checklist = await prisma.checklist.findUnique({ where: { id: checklistId } });
    if (!checklist) throw new AppError(404, 'Checklist not found', 'NOT_FOUND');

    await prisma.$transaction(
      input.items.map((item) =>
        prisma.checklistItem.update({
          where: { id: item.id },
          data: { position: item.position },
        })
      )
    );

    return prisma.checklistItem.findMany({
      where: { checklistId },
      orderBy: { position: 'asc' },
      include: itemInclude,
    });
  }

  // ==================================
  // BULK OPERATIONS
  // ==================================

  async bulkCompleteItems(checklistId: string) {
    const checklist = await prisma.checklist.findUnique({ where: { id: checklistId } });
    if (!checklist) throw new AppError(404, 'Checklist not found', 'NOT_FOUND');

    await prisma.checklistItem.updateMany({
      where: { checklistId },
      data: { isCompleted: true },
    });

    return prisma.checklistItem.findMany({
      where: { checklistId },
      orderBy: { position: 'asc' },
      include: itemInclude,
    });
  }

  async bulkIncompleteItems(checklistId: string) {
    const checklist = await prisma.checklist.findUnique({ where: { id: checklistId } });
    if (!checklist) throw new AppError(404, 'Checklist not found', 'NOT_FOUND');

    await prisma.checklistItem.updateMany({
      where: { checklistId },
      data: { isCompleted: false },
    });

    return prisma.checklistItem.findMany({
      where: { checklistId },
      orderBy: { position: 'asc' },
      include: itemInclude,
    });
  }

  // ==================================
  // HELPER: TASK DETAIL PROGRESS
  // ==================================

  async getChecklistProgress(taskId: string) {
    const items = await prisma.checklistItem.findMany({
      where: { checklist: { taskId } },
      select: { isCompleted: true },
    });

    const total = items.length;
    const completed = items.filter((i) => i.isCompleted).length;

    return {
      total,
      completed,
      percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
    };
  }
}

export const checklistsService = new ChecklistsService();
