import { prisma } from '../../config/database';
import { AppError } from '../../middleware/error-handler';
import type {
  CreateListInput,
  UpdateListInput,
  CreateItemInput,
  UpdateItemInput,
  ReorderItemsInput,
  CreateStepInput,
  UpdateStepInput,
} from './todo.schema';

const itemInclude = {
  steps: { orderBy: { position: 'asc' as const } },
  list: { select: { id: true, name: true, color: true, icon: true } },
} as const;

export class TodoService {
  // ==================================
  // LIST CRUD
  // ==================================

  async createList(userId: string, input: CreateListInput) {
    const lastList = await prisma.todoList.findFirst({
      where: { userId },
      orderBy: { position: 'desc' },
      select: { position: true },
    });

    const list = await prisma.todoList.create({
      data: {
        userId,
        name: input.name,
        color: input.color ?? '#4F8EF7',
        icon: input.icon,
        position: (lastList?.position ?? 0) + 1,
      },
      include: { _count: { select: { items: true } } },
    });

    return list;
  }

  async getLists(userId: string) {
    const lists = await prisma.todoList.findMany({
      where: { userId },
      orderBy: { position: 'asc' },
      include: {
        _count: {
          select: {
            items: { where: { isCompleted: false } },
          },
        },
      },
    });

    return lists;
  }

  async updateList(userId: string, listId: string, input: UpdateListInput) {
    const list = await prisma.todoList.findFirst({
      where: { id: listId, userId },
    });
    if (!list) {
      throw new AppError(404, 'List not found', 'NOT_FOUND');
    }

    return prisma.todoList.update({
      where: { id: listId },
      data: {
        name: input.name,
        color: input.color,
        icon: input.icon,
        position: input.position,
      },
      include: { _count: { select: { items: true } } },
    });
  }

  async deleteList(userId: string, listId: string) {
    const list = await prisma.todoList.findFirst({
      where: { id: listId, userId },
    });
    if (!list) {
      throw new AppError(404, 'List not found', 'NOT_FOUND');
    }
    if (list.isSmart) {
      throw new AppError(400, 'Cannot delete a smart list', 'CANNOT_DELETE_SMART_LIST');
    }

    // Cascade delete handled by Prisma (TodoItem onDelete: Cascade -> TodoStep onDelete: Cascade)
    await prisma.todoList.delete({ where: { id: listId } });
  }

  // ==================================
  // SMART LIST VIEWS
  // ==================================

  async getMyDay(userId: string) {
    const items = await prisma.todoItem.findMany({
      where: { userId, isMyDay: true, isCompleted: false },
      include: itemInclude,
      orderBy: { position: 'asc' },
    });

    return items;
  }

  async getImportant(userId: string) {
    const items = await prisma.todoItem.findMany({
      where: { userId, isImportant: true, isCompleted: false },
      include: itemInclude,
      orderBy: { position: 'asc' },
    });

    return items;
  }

  async getPlanned(userId: string) {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);
    const dayAfterTomorrow = new Date(todayStart);
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);
    const thisWeekEnd = new Date(todayStart);
    thisWeekEnd.setDate(thisWeekEnd.getDate() + (7 - todayStart.getDay()));

    const items = await prisma.todoItem.findMany({
      where: {
        userId,
        dueDate: { not: null },
        isCompleted: false,
      },
      include: itemInclude,
      orderBy: { dueDate: 'asc' },
    });

    const overdue: typeof items = [];
    const today: typeof items = [];
    const tomorrow: typeof items = [];
    const thisWeek: typeof items = [];
    const later: typeof items = [];

    for (const item of items) {
      const due = item.dueDate!;
      if (due < todayStart) {
        overdue.push(item);
      } else if (due < tomorrowStart) {
        today.push(item);
      } else if (due < dayAfterTomorrow) {
        tomorrow.push(item);
      } else if (due < thisWeekEnd) {
        thisWeek.push(item);
      } else {
        later.push(item);
      }
    }

    return { overdue, today, tomorrow, thisWeek, later };
  }

  // ==================================
  // ITEM CRUD
  // ==================================

  async createItem(userId: string, listId: string, input: CreateItemInput) {
    // Verify list belongs to user
    const list = await prisma.todoList.findFirst({
      where: { id: listId, userId },
    });
    if (!list) {
      throw new AppError(404, 'List not found', 'NOT_FOUND');
    }

    let position = input.position;
    if (position === undefined) {
      const lastItem = await prisma.todoItem.findFirst({
        where: { listId, isCompleted: false },
        orderBy: { position: 'desc' },
        select: { position: true },
      });
      position = (lastItem?.position ?? 0) + 65536;
    }

    const item = await prisma.todoItem.create({
      data: {
        listId,
        userId,
        title: input.title,
        notes: input.notes,
        dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
        reminderAt: input.reminderAt ? new Date(input.reminderAt) : undefined,
        repeatRule: input.repeatRule,
        isImportant: input.isImportant ?? false,
        isMyDay: input.isMyDay ?? false,
        position,
      },
      include: itemInclude,
    });

    return item;
  }

  async updateItem(userId: string, itemId: string, input: UpdateItemInput) {
    const item = await prisma.todoItem.findFirst({
      where: { id: itemId, userId },
    });
    if (!item) {
      throw new AppError(404, 'Item not found', 'NOT_FOUND');
    }

    // If moving to a different list, verify the target list
    if (input.listId && input.listId !== item.listId) {
      const targetList = await prisma.todoList.findFirst({
        where: { id: input.listId, userId },
      });
      if (!targetList) {
        throw new AppError(404, 'Target list not found', 'NOT_FOUND');
      }
    }

    return prisma.todoItem.update({
      where: { id: itemId },
      data: {
        title: input.title,
        notes: input.notes === null ? null : input.notes,
        dueDate: input.dueDate === null ? null : input.dueDate ? new Date(input.dueDate) : undefined,
        reminderAt: input.reminderAt === null ? null : input.reminderAt ? new Date(input.reminderAt) : undefined,
        repeatRule: input.repeatRule === null ? null : input.repeatRule,
        isImportant: input.isImportant,
        isMyDay: input.isMyDay,
        position: input.position,
        listId: input.listId,
      },
      include: itemInclude,
    });
  }

  async deleteItem(userId: string, itemId: string) {
    const item = await prisma.todoItem.findFirst({
      where: { id: itemId, userId },
    });
    if (!item) {
      throw new AppError(404, 'Item not found', 'NOT_FOUND');
    }

    // Cascade delete steps handled by Prisma
    await prisma.todoItem.delete({ where: { id: itemId } });
  }

  async toggleComplete(userId: string, itemId: string) {
    const item = await prisma.todoItem.findFirst({
      where: { id: itemId, userId },
    });
    if (!item) {
      throw new AppError(404, 'Item not found', 'NOT_FOUND');
    }

    const isCompleted = !item.isCompleted;

    return prisma.todoItem.update({
      where: { id: itemId },
      data: {
        isCompleted,
        completedAt: isCompleted ? new Date() : null,
      },
      include: itemInclude,
    });
  }

  async toggleImportant(userId: string, itemId: string) {
    const item = await prisma.todoItem.findFirst({
      where: { id: itemId, userId },
    });
    if (!item) {
      throw new AppError(404, 'Item not found', 'NOT_FOUND');
    }

    return prisma.todoItem.update({
      where: { id: itemId },
      data: { isImportant: !item.isImportant },
      include: itemInclude,
    });
  }

  async toggleMyDay(userId: string, itemId: string) {
    const item = await prisma.todoItem.findFirst({
      where: { id: itemId, userId },
    });
    if (!item) {
      throw new AppError(404, 'Item not found', 'NOT_FOUND');
    }

    return prisma.todoItem.update({
      where: { id: itemId },
      data: { isMyDay: !item.isMyDay },
      include: itemInclude,
    });
  }

  async reorderItems(userId: string, input: ReorderItemsInput) {
    // Verify all items belong to user
    const items = await prisma.todoItem.findMany({
      where: { id: { in: input.items.map((i) => i.id) }, userId },
      select: { id: true },
    });

    if (items.length !== input.items.length) {
      throw new AppError(400, 'One or more items not found', 'INVALID_ITEMS');
    }

    await prisma.$transaction(
      input.items.map((item) =>
        prisma.todoItem.update({
          where: { id: item.id },
          data: { position: item.position },
        })
      )
    );
  }

  // ==================================
  // STEP CRUD
  // ==================================

  async createStep(userId: string, itemId: string, input: CreateStepInput) {
    const item = await prisma.todoItem.findFirst({
      where: { id: itemId, userId },
    });
    if (!item) {
      throw new AppError(404, 'Item not found', 'NOT_FOUND');
    }

    let position = input.position;
    if (position === undefined) {
      const lastStep = await prisma.todoStep.findFirst({
        where: { todoItemId: itemId },
        orderBy: { position: 'desc' },
        select: { position: true },
      });
      position = (lastStep?.position ?? 0) + 1;
    }

    const step = await prisma.todoStep.create({
      data: {
        todoItemId: itemId,
        title: input.title,
        position,
      },
    });

    return step;
  }

  async updateStep(userId: string, stepId: string, input: UpdateStepInput) {
    const step = await this.getStepOrThrow(userId, stepId);

    return prisma.todoStep.update({
      where: { id: step.id },
      data: {
        title: input.title,
        position: input.position,
      },
    });
  }

  async deleteStep(userId: string, stepId: string) {
    const step = await this.getStepOrThrow(userId, stepId);
    await prisma.todoStep.delete({ where: { id: step.id } });
  }

  async toggleStepComplete(userId: string, stepId: string) {
    const step = await this.getStepOrThrow(userId, stepId);

    return prisma.todoStep.update({
      where: { id: step.id },
      data: { isCompleted: !step.isCompleted },
    });
  }

  // ==================================
  // PRIVATE HELPERS
  // ==================================

  private async getStepOrThrow(userId: string, stepId: string) {
    const step = await prisma.todoStep.findUnique({
      where: { id: stepId },
      include: { todoItem: { select: { userId: true } } },
    });

    if (!step || step.todoItem.userId !== userId) {
      throw new AppError(404, 'Step not found', 'NOT_FOUND');
    }

    return step;
  }
}

export const todoService = new TodoService();
