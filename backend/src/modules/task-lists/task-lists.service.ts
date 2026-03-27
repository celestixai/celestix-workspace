import { TaskPriority } from '@prisma/client';
import { prisma } from '../../config/database';
import { AppError } from '../../middleware/error-handler';
import { spacesService } from '../spaces/spaces.service';
import type {
  CreateListInput,
  UpdateListInput,
  CreateListStatusInput,
  UpdateListStatusInput,
  MoveListInput,
} from './task-lists.validation';

// ==========================================
// Helpers
// ==========================================

async function getListWithAccess(listId: string, userId: string) {
  const list = await prisma.taskList.findUnique({
    where: { id: listId, deletedAt: null },
    select: { id: true, spaceId: true, folderId: true, createdById: true },
  });

  if (!list) {
    throw new AppError(404, 'List not found', 'NOT_FOUND');
  }

  const member = await spacesService.checkSpaceAccess(list.spaceId, userId);

  return { list, member };
}

async function requireAdminOrCreator(
  spaceId: string,
  createdById: string,
  userId: string,
) {
  const member = await spacesService.checkSpaceAccess(spaceId, userId);
  const isAdminPlus = member && ['OWNER', 'ADMIN'].includes(member.role);
  const isCreator = createdById === userId;

  if (!isAdminPlus && !isCreator) {
    throw new AppError(403, 'You do not have permission to modify this list', 'FORBIDDEN');
  }

  return member;
}

// ==========================================
// List CRUD
// ==========================================

async function getListsBySpace(spaceId: string, userId: string) {
  await spacesService.checkSpaceAccess(spaceId, userId);

  const lists = await prisma.taskList.findMany({
    where: { spaceId, deletedAt: null },
    include: {
      tasks: {
        where: { deletedAt: null },
        select: { statusName: true },
      },
    },
    orderBy: { position: 'asc' },
  });

  return lists.map((list) => {
    // Group task count by status
    const taskCountByStatus: Record<string, number> = {};
    for (const task of list.tasks) {
      const key = task.statusName || 'unknown';
      taskCountByStatus[key] = (taskCountByStatus[key] || 0) + 1;
    }

    return {
      id: list.id,
      spaceId: list.spaceId,
      folderId: list.folderId,
      name: list.name,
      description: list.description,
      color: list.color,
      icon: list.icon,
      position: list.position,
      useCustomStatuses: list.useCustomStatuses,
      dueDate: list.dueDate,
      startDate: list.startDate,
      priority: list.priority,
      createdById: list.createdById,
      createdAt: list.createdAt,
      updatedAt: list.updatedAt,
      taskCount: list.tasks.length,
      taskCountByStatus,
    };
  });
}

async function getListsByFolder(folderId: string, userId: string) {
  const folder = await prisma.folder.findUnique({
    where: { id: folderId, deletedAt: null },
    select: { id: true, spaceId: true },
  });

  if (!folder) {
    throw new AppError(404, 'Folder not found', 'NOT_FOUND');
  }

  await spacesService.checkSpaceAccess(folder.spaceId, userId);

  const lists = await prisma.taskList.findMany({
    where: { folderId, deletedAt: null },
    include: {
      tasks: {
        where: { deletedAt: null },
        select: { statusName: true },
      },
    },
    orderBy: { position: 'asc' },
  });

  return lists.map((list) => {
    const taskCountByStatus: Record<string, number> = {};
    for (const task of list.tasks) {
      const key = task.statusName || 'unknown';
      taskCountByStatus[key] = (taskCountByStatus[key] || 0) + 1;
    }

    return {
      id: list.id,
      spaceId: list.spaceId,
      folderId: list.folderId,
      name: list.name,
      description: list.description,
      color: list.color,
      icon: list.icon,
      position: list.position,
      useCustomStatuses: list.useCustomStatuses,
      dueDate: list.dueDate,
      startDate: list.startDate,
      priority: list.priority,
      createdById: list.createdById,
      createdAt: list.createdAt,
      updatedAt: list.updatedAt,
      taskCount: list.tasks.length,
      taskCountByStatus,
    };
  });
}

async function createListInSpace(spaceId: string, userId: string, data: CreateListInput) {
  await spacesService.checkSpaceRole(spaceId, userId, ['OWNER', 'ADMIN', 'MEMBER']);

  const maxPos = await prisma.taskList.aggregate({
    where: { spaceId, folderId: null, deletedAt: null },
    _max: { position: true },
  });
  const position = (maxPos._max.position ?? -1) + 1;

  const list = await prisma.taskList.create({
    data: {
      spaceId,
      name: data.name,
      description: data.description,
      color: data.color,
      icon: data.icon,
      dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
      startDate: data.startDate ? new Date(data.startDate) : undefined,
      priority: data.priority as TaskPriority | undefined,
      position,
      createdById: userId,
    },
  });

  return list;
}

async function createListInFolder(folderId: string, userId: string, data: CreateListInput) {
  const folder = await prisma.folder.findUnique({
    where: { id: folderId, deletedAt: null },
    select: { id: true, spaceId: true },
  });

  if (!folder) {
    throw new AppError(404, 'Folder not found', 'NOT_FOUND');
  }

  await spacesService.checkSpaceRole(folder.spaceId, userId, ['OWNER', 'ADMIN', 'MEMBER']);

  const maxPos = await prisma.taskList.aggregate({
    where: { folderId, deletedAt: null },
    _max: { position: true },
  });
  const position = (maxPos._max.position ?? -1) + 1;

  const list = await prisma.taskList.create({
    data: {
      spaceId: folder.spaceId,
      folderId,
      name: data.name,
      description: data.description,
      color: data.color,
      icon: data.icon,
      dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
      startDate: data.startDate ? new Date(data.startDate) : undefined,
      priority: data.priority as TaskPriority | undefined,
      position,
      createdById: userId,
    },
  });

  return list;
}

async function getListById(listId: string, userId: string) {
  const list = await prisma.taskList.findUnique({
    where: { id: listId, deletedAt: null },
    include: {
      tasks: {
        where: { deletedAt: null },
        select: { statusName: true },
      },
      space: {
        select: {
          members: {
            include: {
              user: { select: { id: true, displayName: true, avatarUrl: true, status: true } },
            },
          },
        },
      },
    },
  });

  if (!list) {
    throw new AppError(404, 'List not found', 'NOT_FOUND');
  }

  await spacesService.checkSpaceAccess(list.spaceId, userId);

  const taskCountByStatus: Record<string, number> = {};
  for (const task of list.tasks) {
    const key = task.statusName || 'unknown';
    taskCountByStatus[key] = (taskCountByStatus[key] || 0) + 1;
  }

  return {
    id: list.id,
    spaceId: list.spaceId,
    folderId: list.folderId,
    name: list.name,
    description: list.description,
    color: list.color,
    icon: list.icon,
    position: list.position,
    useCustomStatuses: list.useCustomStatuses,
    dueDate: list.dueDate,
    startDate: list.startDate,
    priority: list.priority,
    createdById: list.createdById,
    createdAt: list.createdAt,
    updatedAt: list.updatedAt,
    taskCount: list.tasks.length,
    taskCountByStatus,
    members: list.space.members,
  };
}

async function updateList(listId: string, userId: string, data: UpdateListInput) {
  const { list } = await getListWithAccess(listId, userId);
  await requireAdminOrCreator(list.spaceId, list.createdById, userId);

  const updated = await prisma.taskList.update({
    where: { id: listId },
    data: {
      name: data.name,
      description: data.description,
      color: data.color,
      icon: data.icon,
      dueDate: data.dueDate !== undefined ? (data.dueDate ? new Date(data.dueDate) : null) : undefined,
      startDate: data.startDate !== undefined ? (data.startDate ? new Date(data.startDate) : null) : undefined,
      priority: data.priority !== undefined ? (data.priority as TaskPriority | null) : undefined,
    },
  });

  return updated;
}

async function deleteList(listId: string, userId: string) {
  const { list } = await getListWithAccess(listId, userId);
  await requireAdminOrCreator(list.spaceId, list.createdById, userId);

  const deleted = await prisma.taskList.update({
    where: { id: listId },
    data: { deletedAt: new Date() },
  });

  return deleted;
}

async function updatePosition(listId: string, position: number) {
  const list = await prisma.taskList.update({
    where: { id: listId },
    data: { position },
  });

  return list;
}

// ==========================================
// List Statuses (3-tier inheritance)
// ==========================================

async function getEffectiveStatuses(listId: string) {
  const list = await prisma.taskList.findUnique({
    where: { id: listId, deletedAt: null },
    select: {
      id: true,
      spaceId: true,
      folderId: true,
      useCustomStatuses: true,
      statuses: { orderBy: { position: 'asc' } },
    },
  });

  if (!list) {
    throw new AppError(404, 'List not found', 'NOT_FOUND');
  }

  // Tier 1: List's own custom statuses
  if (list.useCustomStatuses && list.statuses.length > 0) {
    return {
      source: 'list' as const,
      listId: list.id,
      statuses: list.statuses,
    };
  }

  // Tier 2: Folder's custom statuses (if list is in a folder)
  if (list.folderId) {
    const folder = await prisma.folder.findUnique({
      where: { id: list.folderId, deletedAt: null },
      select: {
        id: true,
        useCustomStatuses: true,
        statuses: { orderBy: { position: 'asc' } },
      },
    });

    if (folder && folder.useCustomStatuses && folder.statuses.length > 0) {
      return {
        source: 'folder' as const,
        folderId: folder.id,
        statuses: folder.statuses,
      };
    }
  }

  // Tier 3: Space statuses (default fallback)
  const spaceStatuses = await prisma.spaceStatus.findMany({
    where: { spaceId: list.spaceId },
    orderBy: { position: 'asc' },
  });

  return {
    source: 'space' as const,
    spaceId: list.spaceId,
    statuses: spaceStatuses,
  };
}

async function createListStatus(listId: string, data: CreateListStatusInput) {
  const list = await prisma.taskList.findUnique({
    where: { id: listId, deletedAt: null },
    select: { id: true, useCustomStatuses: true },
  });

  if (!list) {
    throw new AppError(404, 'List not found', 'NOT_FOUND');
  }

  // Get max position if not provided
  let position = data.position;
  if (position === undefined) {
    const maxPos = await prisma.listStatus.aggregate({
      where: { listId },
      _max: { position: true },
    });
    position = (maxPos._max.position ?? -1) + 1;
  }

  // Auto-enable custom statuses on the list
  if (!list.useCustomStatuses) {
    await prisma.taskList.update({
      where: { id: listId },
      data: { useCustomStatuses: true },
    });
  }

  const status = await prisma.listStatus.create({
    data: {
      listId,
      name: data.name,
      color: data.color,
      statusGroup: data.statusGroup,
      position,
    },
  });

  return status;
}

async function updateListStatus(statusId: string, data: UpdateListStatusInput) {
  const status = await prisma.listStatus.update({
    where: { id: statusId },
    data: {
      name: data.name,
      color: data.color,
      statusGroup: data.statusGroup,
      position: data.position,
    },
  });

  return status;
}

async function deleteListStatus(statusId: string) {
  const status = await prisma.listStatus.findUnique({
    where: { id: statusId },
    include: {
      list: { select: { id: true } },
    },
  });

  if (!status) {
    throw new AppError(404, 'List status not found', 'NOT_FOUND');
  }

  // Check if any tasks in this list use this status name
  const taskCount = await prisma.task.count({
    where: {
      listId: status.list.id,
      statusName: status.name,
      deletedAt: null,
    },
  });

  if (taskCount > 0) {
    throw new AppError(400, `Cannot delete status: ${taskCount} task(s) are using it`, 'STATUS_IN_USE');
  }

  await prisma.listStatus.delete({
    where: { id: statusId },
  });

  return { deleted: true };
}

// ==========================================
// List Info
// ==========================================

async function getListInfo(listId: string) {
  const list = await prisma.taskList.findUnique({
    where: { id: listId, deletedAt: null },
    include: {
      tasks: {
        where: { deletedAt: null },
        select: {
          statusName: true,
          dueDate: true,
        },
      },
    },
  });

  if (!list) {
    throw new AppError(404, 'List not found', 'NOT_FOUND');
  }

  const now = new Date();
  const totalTasks = list.tasks.length;
  const completedTasks = list.tasks.filter(
    (t) => t.statusName === 'Complete' || t.statusName === 'Closed'
  ).length;
  const overdueTasks = list.tasks.filter(
    (t) =>
      t.dueDate &&
      t.dueDate < now &&
      t.statusName !== 'Complete' &&
      t.statusName !== 'Closed'
  ).length;

  return {
    id: list.id,
    name: list.name,
    description: list.description,
    color: list.color,
    icon: list.icon,
    dueDate: list.dueDate,
    startDate: list.startDate,
    priority: list.priority,
    createdAt: list.createdAt,
    updatedAt: list.updatedAt,
    stats: {
      total: totalTasks,
      completed: completedTasks,
      overdue: overdueTasks,
    },
  };
}

async function updateListInfo(listId: string, data: UpdateListInput) {
  const list = await prisma.taskList.findUnique({
    where: { id: listId, deletedAt: null },
    select: { id: true },
  });

  if (!list) {
    throw new AppError(404, 'List not found', 'NOT_FOUND');
  }

  const updated = await prisma.taskList.update({
    where: { id: listId },
    data: {
      description: data.description,
      dueDate: data.dueDate !== undefined ? (data.dueDate ? new Date(data.dueDate) : null) : undefined,
      startDate: data.startDate !== undefined ? (data.startDate ? new Date(data.startDate) : null) : undefined,
      priority: data.priority !== undefined ? (data.priority as TaskPriority | null) : undefined,
    },
  });

  return updated;
}

// ==========================================
// Move & Duplicate
// ==========================================

async function moveList(listId: string, userId: string, data: MoveListInput) {
  const { list } = await getListWithAccess(listId, userId);

  // Require ADMIN+ in source space
  await spacesService.checkSpaceRole(list.spaceId, userId, ['OWNER', 'ADMIN']);

  const updateData: { spaceId?: string; folderId?: string | null } = {};

  // If moving to a different space
  if (data.targetSpaceId && data.targetSpaceId !== list.spaceId) {
    await spacesService.checkSpaceRole(data.targetSpaceId, userId, ['OWNER', 'ADMIN', 'MEMBER']);
    updateData.spaceId = data.targetSpaceId;
    // When moving to a new space, reset folderId unless explicitly set
    updateData.folderId = data.targetFolderId !== undefined ? data.targetFolderId : null;
  } else if (data.targetFolderId !== undefined) {
    // Moving within the same space to a different folder (or to space root if null)
    if (data.targetFolderId !== null) {
      const targetFolder = await prisma.folder.findUnique({
        where: { id: data.targetFolderId, deletedAt: null },
        select: { id: true, spaceId: true },
      });

      if (!targetFolder) {
        throw new AppError(404, 'Target folder not found', 'NOT_FOUND');
      }

      const effectiveSpaceId = data.targetSpaceId || list.spaceId;
      if (targetFolder.spaceId !== effectiveSpaceId) {
        throw new AppError(400, 'Target folder must be in the same space', 'INVALID_FOLDER');
      }
    }
    updateData.folderId = data.targetFolderId;
  }

  const updated = await prisma.taskList.update({
    where: { id: listId },
    data: updateData,
  });

  return updated;
}

async function duplicateList(listId: string, userId: string, includeTasks: boolean) {
  const source = await prisma.taskList.findUnique({
    where: { id: listId, deletedAt: null },
    include: {
      statuses: true,
      tasks: includeTasks ? { where: { deletedAt: null } } : false,
    },
  });

  if (!source) {
    throw new AppError(404, 'List not found', 'NOT_FOUND');
  }

  await spacesService.checkSpaceAccess(source.spaceId, userId);

  // Get max position
  const maxPos = await prisma.taskList.aggregate({
    where: { spaceId: source.spaceId, folderId: source.folderId, deletedAt: null },
    _max: { position: true },
  });
  const position = (maxPos._max.position ?? -1) + 1;

  const newList = await prisma.taskList.create({
    data: {
      spaceId: source.spaceId,
      folderId: source.folderId,
      name: `${source.name} (Copy)`,
      description: source.description,
      color: source.color,
      icon: source.icon,
      dueDate: source.dueDate,
      startDate: source.startDate,
      priority: source.priority,
      position,
      useCustomStatuses: source.useCustomStatuses,
      createdById: userId,
      statuses: source.statuses.length > 0
        ? {
            createMany: {
              data: source.statuses.map((s) => ({
                name: s.name,
                color: s.color,
                statusGroup: s.statusGroup,
                position: s.position,
              })),
            },
          }
        : undefined,
    },
  });

  // Duplicate tasks if requested
  if (includeTasks && source.tasks && Array.isArray(source.tasks)) {
    for (const task of source.tasks) {
      await prisma.task.create({
        data: {
          projectId: task.projectId,
          listId: newList.id,
          title: task.title,
          descriptionHtml: task.descriptionHtml,
          status: task.status,
          priority: task.priority,
          statusName: task.statusName,
          statusColor: task.statusColor,
          position: task.position,
          createdById: userId,
        },
      });
    }
  }

  return newList;
}

// ==========================================
// Export
// ==========================================

export const taskListsService = {
  // List CRUD
  getListsBySpace,
  getListsByFolder,
  createListInSpace,
  createListInFolder,
  getListById,
  updateList,
  deleteList,
  updatePosition,
  // List Statuses (3-tier inheritance)
  getEffectiveStatuses,
  createListStatus,
  updateListStatus,
  deleteListStatus,
  // List Info
  getListInfo,
  updateListInfo,
  // Move & Duplicate
  moveList,
  duplicateList,
};
