import { prisma } from '../../config/database';
import { AppError } from '../../middleware/error-handler';
import type {
  CreateListInput,
  UpdateListInput,
  CreateColumnInput,
  UpdateColumnInput,
  CreateItemInput,
  UpdateItemInput,
  CreateViewInput,
  UpdateViewInput,
} from './lists.schema';

const userSelect = { id: true, displayName: true, avatarUrl: true, email: true } as const;

export class ListsService {
  // ==================================
  // LIST CRUD
  // ==================================

  async create(userId: string, input: CreateListInput) {
    const list = await prisma.cxList.create({
      data: {
        name: input.name,
        description: input.description,
        icon: input.icon,
        color: input.color ?? '#4F8EF7',
        templateId: input.templateId,
        createdById: userId,
        views: {
          create: [
            {
              name: 'All Items',
              type: 'LIST',
              createdById: userId,
            },
          ],
        },
      },
      include: {
        columns: { orderBy: { position: 'asc' } },
        views: true,
        createdBy: { select: userSelect },
        _count: { select: { items: true } },
      },
    });

    return list;
  }

  async getAll(userId: string) {
    const lists = await prisma.cxList.findMany({
      where: {
        createdById: userId,
        deletedAt: null,
      },
      include: {
        createdBy: { select: userSelect },
        _count: { select: { items: { where: { deletedAt: null } } } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return lists;
  }

  async getById(listId: string, userId: string) {
    const list = await prisma.cxList.findFirst({
      where: {
        id: listId,
        createdById: userId,
        deletedAt: null,
      },
      include: {
        columns: { orderBy: { position: 'asc' } },
        views: { orderBy: { createdAt: 'asc' } },
        createdBy: { select: userSelect },
        _count: { select: { items: { where: { deletedAt: null } } } },
      },
    });

    if (!list) {
      throw new AppError(404, 'List not found', 'NOT_FOUND');
    }

    return list;
  }

  async update(listId: string, userId: string, input: UpdateListInput) {
    await this.requireListOwnership(listId, userId);

    const list = await prisma.cxList.update({
      where: { id: listId },
      data: {
        name: input.name,
        description: input.description,
        icon: input.icon,
        color: input.color,
        templateId: input.templateId,
      },
      include: {
        columns: { orderBy: { position: 'asc' } },
        views: true,
        createdBy: { select: userSelect },
        _count: { select: { items: { where: { deletedAt: null } } } },
      },
    });

    return list;
  }

  async delete(listId: string, userId: string) {
    await this.requireListOwnership(listId, userId);

    await prisma.cxList.update({
      where: { id: listId },
      data: { deletedAt: new Date() },
    });
  }

  // ==================================
  // COLUMNS
  // ==================================

  async addColumn(listId: string, userId: string, input: CreateColumnInput) {
    await this.requireListOwnership(listId, userId);

    // If no explicit position, place at end
    let position = input.position;
    if (position === 0 || position === undefined) {
      const lastColumn = await prisma.listColumn.findFirst({
        where: { listId },
        orderBy: { position: 'desc' },
        select: { position: true },
      });
      position = (lastColumn?.position ?? 0) + 1;
    }

    const column = await prisma.listColumn.create({
      data: {
        listId,
        name: input.name,
        type: input.type,
        settings: input.settings ?? {},
        position,
        isRequired: input.isRequired ?? false,
      },
    });

    return column;
  }

  async updateColumn(columnId: string, userId: string, input: UpdateColumnInput) {
    const column = await prisma.listColumn.findUnique({
      where: { id: columnId },
      include: { list: { select: { createdById: true } } },
    });
    if (!column) {
      throw new AppError(404, 'Column not found', 'NOT_FOUND');
    }
    if (column.list.createdById !== userId) {
      throw new AppError(403, 'Not authorized to modify this list', 'FORBIDDEN');
    }

    const updated = await prisma.listColumn.update({
      where: { id: columnId },
      data: {
        name: input.name,
        type: input.type,
        settings: input.settings,
        position: input.position,
        isRequired: input.isRequired,
      },
    });

    return updated;
  }

  async deleteColumn(columnId: string, userId: string) {
    const column = await prisma.listColumn.findUnique({
      where: { id: columnId },
      include: { list: { select: { createdById: true } } },
    });
    if (!column) {
      throw new AppError(404, 'Column not found', 'NOT_FOUND');
    }
    if (column.list.createdById !== userId) {
      throw new AppError(403, 'Not authorized to modify this list', 'FORBIDDEN');
    }

    await prisma.listColumn.delete({ where: { id: columnId } });
  }

  // ==================================
  // ITEMS
  // ==================================

  async getItems(
    listId: string,
    userId: string,
    filters?: Record<string, unknown>,
    sort?: Record<string, unknown>,
    groupBy?: string
  ) {
    await this.requireListOwnership(listId, userId);

    const where: Record<string, unknown> = {
      listId,
      deletedAt: null,
    };

    // Apply JSON-based filters on item values if provided
    // Filters are structured as { columnId: value } pairs
    if (filters && Object.keys(filters).length > 0) {
      const jsonFilters = Object.entries(filters).map(([columnId, value]) => ({
        values: { path: [columnId], equals: value },
      }));
      where.AND = jsonFilters;
    }

    // Build orderBy
    let orderBy: Record<string, string> = { createdAt: 'desc' };
    if (sort && typeof sort === 'object') {
      const sortField = (sort as Record<string, string>).field;
      const sortDirection = (sort as Record<string, string>).direction ?? 'asc';
      if (sortField === 'createdAt' || sortField === 'updatedAt') {
        orderBy = { [sortField]: sortDirection };
      }
      // For JSON column sorting, we fall back to createdAt since
      // Prisma doesn't natively support orderBy on JSON path values
    }

    const items = await prisma.listItem.findMany({
      where,
      include: {
        createdBy: { select: userSelect },
      },
      orderBy,
    });

    // Client-side grouping if groupBy is specified
    if (groupBy) {
      const grouped: Record<string, typeof items> = {};
      for (const item of items) {
        const values = item.values as Record<string, unknown>;
        const groupValue = String(values[groupBy] ?? 'Ungrouped');
        if (!grouped[groupValue]) {
          grouped[groupValue] = [];
        }
        grouped[groupValue].push(item);
      }
      return { items, grouped };
    }

    return { items };
  }

  async createItem(listId: string, userId: string, input: CreateItemInput) {
    await this.requireListOwnership(listId, userId);

    const item = await prisma.listItem.create({
      data: {
        listId,
        values: input.values ?? {},
        createdById: userId,
      },
      include: {
        createdBy: { select: userSelect },
      },
    });

    return item;
  }

  async updateItem(itemId: string, userId: string, input: UpdateItemInput) {
    const item = await prisma.listItem.findFirst({
      where: { id: itemId, deletedAt: null },
      include: { list: { select: { createdById: true } } },
    });
    if (!item) {
      throw new AppError(404, 'Item not found', 'NOT_FOUND');
    }
    if (item.list.createdById !== userId) {
      throw new AppError(403, 'Not authorized to modify this list', 'FORBIDDEN');
    }

    // Track changes in ListItemHistory
    const oldValues = (item.values ?? {}) as Record<string, unknown>;
    const newValues = input.values;
    const changes: Array<{ columnId: string; oldValue: unknown; newValue: unknown }> = [];

    for (const [key, newVal] of Object.entries(newValues)) {
      const oldVal = oldValues[key];
      if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
        changes.push({ columnId: key, oldValue: oldVal ?? null, newValue: newVal });
      }
    }

    // Merge old values with new values so we don't lose columns not included in the update
    const mergedValues = { ...oldValues, ...newValues };

    const updated = await prisma.listItem.update({
      where: { id: itemId },
      data: {
        values: mergedValues,
      },
      include: {
        createdBy: { select: userSelect },
      },
    });

    // Record history entries for each changed field
    if (changes.length > 0) {
      await prisma.listItemHistory.createMany({
        data: changes.map((c) => ({
          itemId,
          userId,
          columnId: c.columnId,
          oldValue: c.oldValue != null ? JSON.stringify(c.oldValue) : null,
          newValue: c.newValue != null ? JSON.stringify(c.newValue) : null,
        })),
      });
    }

    return updated;
  }

  async deleteItem(itemId: string, userId: string) {
    const item = await prisma.listItem.findFirst({
      where: { id: itemId, deletedAt: null },
      include: { list: { select: { createdById: true } } },
    });
    if (!item) {
      throw new AppError(404, 'Item not found', 'NOT_FOUND');
    }
    if (item.list.createdById !== userId) {
      throw new AppError(403, 'Not authorized to modify this list', 'FORBIDDEN');
    }

    await prisma.listItem.update({
      where: { id: itemId },
      data: { deletedAt: new Date() },
    });
  }

  // ==================================
  // VIEWS
  // ==================================

  async createView(listId: string, userId: string, input: CreateViewInput) {
    await this.requireListOwnership(listId, userId);

    const view = await prisma.listView.create({
      data: {
        listId,
        name: input.name,
        type: input.type ?? 'LIST',
        filters: input.filters ?? {},
        sort: input.sort ?? {},
        groupBy: input.groupBy,
        columnOrder: input.columnOrder ?? [],
        createdById: userId,
      },
    });

    return view;
  }

  async updateView(viewId: string, userId: string, input: UpdateViewInput) {
    const view = await prisma.listView.findUnique({
      where: { id: viewId },
      include: { list: { select: { createdById: true } } },
    });
    if (!view) {
      throw new AppError(404, 'View not found', 'NOT_FOUND');
    }
    if (view.list.createdById !== userId) {
      throw new AppError(403, 'Not authorized to modify this list', 'FORBIDDEN');
    }

    const updated = await prisma.listView.update({
      where: { id: viewId },
      data: {
        name: input.name,
        type: input.type,
        filters: input.filters,
        sort: input.sort,
        groupBy: input.groupBy,
        columnOrder: input.columnOrder,
      },
    });

    return updated;
  }

  async deleteView(viewId: string, userId: string) {
    const view = await prisma.listView.findUnique({
      where: { id: viewId },
      include: { list: { select: { createdById: true } } },
    });
    if (!view) {
      throw new AppError(404, 'View not found', 'NOT_FOUND');
    }
    if (view.list.createdById !== userId) {
      throw new AppError(403, 'Not authorized to modify this list', 'FORBIDDEN');
    }

    await prisma.listView.delete({ where: { id: viewId } });
  }

  // ==================================
  // COMMENTS
  // ==================================

  async addComment(itemId: string, userId: string, body: string) {
    const item = await prisma.listItem.findFirst({
      where: { id: itemId, deletedAt: null },
      include: { list: { select: { createdById: true } } },
    });
    if (!item) {
      throw new AppError(404, 'Item not found', 'NOT_FOUND');
    }
    if (item.list.createdById !== userId) {
      throw new AppError(403, 'Not authorized to comment on this list', 'FORBIDDEN');
    }

    const comment = await prisma.listItemComment.create({
      data: {
        itemId,
        userId,
        body,
      },
      include: {
        user: { select: userSelect },
      },
    });

    return comment;
  }

  async getComments(itemId: string, userId: string) {
    const item = await prisma.listItem.findFirst({
      where: { id: itemId, deletedAt: null },
      include: { list: { select: { createdById: true } } },
    });
    if (!item) {
      throw new AppError(404, 'Item not found', 'NOT_FOUND');
    }
    if (item.list.createdById !== userId) {
      throw new AppError(403, 'Not authorized to view this list', 'FORBIDDEN');
    }

    const comments = await prisma.listItemComment.findMany({
      where: { itemId },
      include: { user: { select: userSelect } },
      orderBy: { createdAt: 'asc' },
    });

    return comments;
  }

  // ==================================
  // PRIVATE HELPERS
  // ==================================

  private async requireListOwnership(listId: string, userId: string) {
    const list = await prisma.cxList.findFirst({
      where: {
        id: listId,
        createdById: userId,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!list) {
      throw new AppError(404, 'List not found', 'NOT_FOUND');
    }
    return list;
  }
}

export const listsService = new ListsService();
