import { SpaceRole, StatusGroup } from '@prisma/client';
import { prisma } from '../../config/database';
import { AppError } from '../../middleware/error-handler';
import { taskTypesService } from '../task-types/task-types.service';
import type {
  CreateSpaceInput,
  UpdateSpaceInput,
  CreateStatusInput,
  UpdateStatusInput,
  ReorderStatusesInput,
} from './spaces.validation';

// ==========================================
// Helpers
// ==========================================

const userSelect = { id: true, displayName: true, avatarUrl: true, status: true } as const;

const DEFAULT_STATUSES: { name: string; color: string; statusGroup: StatusGroup; position: number }[] = [
  { name: 'To Do', color: '#6B7280', statusGroup: 'NOT_STARTED', position: 0 },
  { name: 'In Progress', color: '#3B82F6', statusGroup: 'ACTIVE', position: 1 },
  { name: 'In Review', color: '#F59E0B', statusGroup: 'ACTIVE', position: 2 },
  { name: 'Complete', color: '#10B981', statusGroup: 'DONE', position: 3 },
  { name: 'Closed', color: '#EF4444', statusGroup: 'CLOSED', position: 4 },
];

async function checkSpaceAccess(spaceId: string, userId: string) {
  const space = await prisma.space.findUnique({
    where: { id: spaceId, deletedAt: null },
    select: { id: true, isPrivate: true },
  });

  if (!space) {
    throw new AppError(404, 'Space not found', 'NOT_FOUND');
  }

  const member = await prisma.spaceMember.findUnique({
    where: { spaceId_userId: { spaceId, userId } },
  });

  if (space.isPrivate && !member) {
    throw new AppError(403, 'You do not have access to this space', 'FORBIDDEN');
  }

  return member;
}

async function checkSpaceRole(spaceId: string, userId: string, requiredRoles: SpaceRole[]) {
  const member = await checkSpaceAccess(spaceId, userId);

  if (!member || !requiredRoles.includes(member.role)) {
    throw new AppError(403, `Requires one of: ${requiredRoles.join(', ')}`, 'FORBIDDEN');
  }

  return member;
}

// ==========================================
// Space CRUD
// ==========================================

async function getSpaces(workspaceId: string, userId: string) {
  // Get spaces the user has access to: either public or member of private
  const spaces = await prisma.space.findMany({
    where: {
      workspaceId,
      deletedAt: null,
      OR: [
        { isPrivate: false },
        { members: { some: { userId } } },
      ],
    },
    include: {
      members: { select: { id: true } },
      folders: { where: { deletedAt: null }, select: { id: true } },
      lists: {
        where: { deletedAt: null },
        select: {
          id: true,
          _count: { select: { tasks: { where: { deletedAt: null } } } },
        },
      },
    },
    orderBy: { position: 'asc' },
  });

  return spaces.map((space) => ({
    id: space.id,
    workspaceId: space.workspaceId,
    name: space.name,
    description: space.description,
    color: space.color,
    icon: space.icon,
    isPrivate: space.isPrivate,
    position: space.position,
    taskIdPrefix: space.taskIdPrefix,
    taskIdCounter: space.taskIdCounter,
    createdAt: space.createdAt,
    updatedAt: space.updatedAt,
    memberCount: space.members.length,
    folderCount: space.folders.length,
    taskCount: space.lists.reduce((sum, list) => sum + list._count.tasks, 0),
  }));
}

async function createSpace(workspaceId: string, userId: string, data: CreateSpaceInput) {
  // Get max position for new space
  const maxPos = await prisma.space.aggregate({
    where: { workspaceId, deletedAt: null },
    _max: { position: true },
  });
  const position = (maxPos._max.position ?? -1) + 1;

  const space = await prisma.space.create({
    data: {
      workspaceId,
      name: data.name,
      description: data.description,
      color: data.color,
      icon: data.icon,
      isPrivate: data.isPrivate ?? false,
      position,
      createdById: userId,
      members: {
        create: { userId, role: 'OWNER' },
      },
      statuses: {
        createMany: {
          data: DEFAULT_STATUSES.map((s) => ({ ...s, isDefault: true })),
        },
      },
    },
    include: {
      members: { include: { user: { select: userSelect } } },
      statuses: { orderBy: { position: 'asc' } },
    },
  });

  // Create default task types for the new space
  await taskTypesService.createDefaultTaskTypes(space.id);

  return space;
}

async function getSpaceById(spaceId: string, userId: string) {
  await checkSpaceAccess(spaceId, userId);

  const space = await prisma.space.findUnique({
    where: { id: spaceId, deletedAt: null },
    include: {
      folders: {
        where: { deletedAt: null },
        orderBy: { position: 'asc' },
        include: {
          lists: {
            where: { deletedAt: null },
            orderBy: { position: 'asc' },
          },
        },
      },
      lists: {
        where: { deletedAt: null, folderId: null },
        orderBy: { position: 'asc' },
      },
      members: {
        include: { user: { select: userSelect } },
        orderBy: { createdAt: 'asc' },
      },
      statuses: {
        orderBy: { position: 'asc' },
      },
    },
  });

  if (!space) {
    throw new AppError(404, 'Space not found', 'NOT_FOUND');
  }

  // Group statuses by statusGroup
  const statusesByGroup: Record<string, typeof space.statuses> = {};
  for (const status of space.statuses) {
    if (!statusesByGroup[status.statusGroup]) {
      statusesByGroup[status.statusGroup] = [];
    }
    statusesByGroup[status.statusGroup].push(status);
  }

  return {
    ...space,
    statusesByGroup,
  };
}

async function updateSpace(spaceId: string, userId: string, data: UpdateSpaceInput) {
  await checkSpaceRole(spaceId, userId, ['OWNER', 'ADMIN']);

  const space = await prisma.space.update({
    where: { id: spaceId },
    data: {
      name: data.name,
      description: data.description,
      color: data.color,
      icon: data.icon,
      isPrivate: data.isPrivate,
    },
  });

  return space;
}

async function deleteSpace(spaceId: string, userId: string) {
  await checkSpaceRole(spaceId, userId, ['OWNER']);

  const space = await prisma.space.update({
    where: { id: spaceId },
    data: { deletedAt: new Date() },
  });

  return space;
}

async function updatePosition(spaceId: string, position: number) {
  const space = await prisma.space.update({
    where: { id: spaceId },
    data: { position },
  });

  return space;
}

async function duplicateSpace(spaceId: string, userId: string, includeTasks: boolean) {
  const source = await prisma.space.findUnique({
    where: { id: spaceId, deletedAt: null },
    include: {
      statuses: true,
      members: true,
      folders: {
        where: { deletedAt: null },
        include: {
          lists: {
            where: { deletedAt: null },
            include: includeTasks ? { tasks: { where: { deletedAt: null } } } : {},
          },
        },
      },
      lists: {
        where: { deletedAt: null, folderId: null },
        include: includeTasks ? { tasks: { where: { deletedAt: null } } } : {},
      },
    },
  });

  if (!source) {
    throw new AppError(404, 'Space not found', 'NOT_FOUND');
  }

  // Get max position
  const maxPos = await prisma.space.aggregate({
    where: { workspaceId: source.workspaceId, deletedAt: null },
    _max: { position: true },
  });
  const position = (maxPos._max.position ?? -1) + 1;

  // Create duplicated space
  const newSpace = await prisma.space.create({
    data: {
      workspaceId: source.workspaceId,
      name: `${source.name} (Copy)`,
      description: source.description,
      color: source.color,
      icon: source.icon,
      isPrivate: source.isPrivate,
      position,
      createdById: userId,
      statuses: {
        createMany: {
          data: source.statuses.map((s) => ({
            name: s.name,
            color: s.color,
            statusGroup: s.statusGroup,
            position: s.position,
            isDefault: s.isDefault,
          })),
        },
      },
      members: {
        createMany: {
          data: source.members.map((m) => ({
            userId: m.userId,
            role: m.role,
          })),
        },
      },
    },
  });

  // Duplicate folders and their lists
  for (const folder of source.folders) {
    const newFolder = await prisma.folder.create({
      data: {
        spaceId: newSpace.id,
        name: folder.name,
        description: folder.description,
        color: folder.color,
        icon: folder.icon,
        position: folder.position,
        createdById: userId,
      },
    });

    for (const list of folder.lists) {
      const newList = await prisma.taskList.create({
        data: {
          spaceId: newSpace.id,
          folderId: newFolder.id,
          name: list.name,
          description: list.description,
          color: list.color,
          icon: list.icon,
          position: list.position,
          createdById: userId,
        },
      });

      if (includeTasks && 'tasks' in list) {
        const tasks = list.tasks as any[];
        for (const task of tasks) {
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
    }
  }

  // Duplicate direct lists (no folder)
  for (const list of source.lists) {
    const newList = await prisma.taskList.create({
      data: {
        spaceId: newSpace.id,
        name: list.name,
        description: list.description,
        color: list.color,
        icon: list.icon,
        position: list.position,
        createdById: userId,
      },
    });

    if (includeTasks && 'tasks' in list) {
      const tasks = list.tasks as any[];
      for (const task of tasks) {
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
  }

  return newSpace;
}

// ==========================================
// Members
// ==========================================

async function getMembers(spaceId: string) {
  const members = await prisma.spaceMember.findMany({
    where: { spaceId },
    include: { user: { select: userSelect } },
    orderBy: { createdAt: 'asc' },
  });

  return members;
}

async function addMembers(spaceId: string, userIds: string[], role?: string) {
  const memberRole = (role as SpaceRole) || 'MEMBER';

  // Filter out users that are already members
  const existing = await prisma.spaceMember.findMany({
    where: { spaceId, userId: { in: userIds } },
    select: { userId: true },
  });
  const existingIds = new Set(existing.map((m) => m.userId));
  const newUserIds = userIds.filter((id) => !existingIds.has(id));

  if (newUserIds.length === 0) {
    return [];
  }

  await prisma.spaceMember.createMany({
    data: newUserIds.map((userId) => ({
      spaceId,
      userId,
      role: memberRole,
    })),
  });

  const members = await prisma.spaceMember.findMany({
    where: { spaceId, userId: { in: newUserIds } },
    include: { user: { select: userSelect } },
  });

  return members;
}

async function updateMemberRole(spaceId: string, userId: string, role: SpaceRole) {
  const targetMember = await prisma.spaceMember.findUnique({
    where: { spaceId_userId: { spaceId, userId } },
  });

  if (!targetMember) {
    throw new AppError(404, 'Member not found', 'NOT_FOUND');
  }

  // Cannot change an OWNER's role unless the caller is also an OWNER
  // (caller role check is done at route level via checkSpaceRole)

  const member = await prisma.spaceMember.update({
    where: { spaceId_userId: { spaceId, userId } },
    data: { role },
    include: { user: { select: userSelect } },
  });

  return member;
}

async function removeMember(spaceId: string, userId: string) {
  const targetMember = await prisma.spaceMember.findUnique({
    where: { spaceId_userId: { spaceId, userId } },
  });

  if (!targetMember) {
    throw new AppError(404, 'Member not found', 'NOT_FOUND');
  }

  // Cannot remove the last OWNER
  if (targetMember.role === 'OWNER') {
    const ownerCount = await prisma.spaceMember.count({
      where: { spaceId, role: 'OWNER' },
    });
    if (ownerCount <= 1) {
      throw new AppError(400, 'Cannot remove the last owner of a space', 'LAST_OWNER');
    }
  }

  await prisma.spaceMember.delete({
    where: { spaceId_userId: { spaceId, userId } },
  });

  return { removed: true };
}

// ==========================================
// Statuses
// ==========================================

async function getStatuses(spaceId: string) {
  const statuses = await prisma.spaceStatus.findMany({
    where: { spaceId },
    orderBy: { position: 'asc' },
  });

  // Group by statusGroup
  const grouped: Record<string, typeof statuses> = {};
  for (const status of statuses) {
    if (!grouped[status.statusGroup]) {
      grouped[status.statusGroup] = [];
    }
    grouped[status.statusGroup].push(status);
  }

  return { statuses, grouped };
}

async function createStatus(spaceId: string, data: CreateStatusInput) {
  // Get max position if not provided
  let position = data.position;
  if (position === undefined) {
    const maxPos = await prisma.spaceStatus.aggregate({
      where: { spaceId },
      _max: { position: true },
    });
    position = (maxPos._max.position ?? -1) + 1;
  }

  const status = await prisma.spaceStatus.create({
    data: {
      spaceId,
      name: data.name,
      color: data.color,
      statusGroup: data.statusGroup,
      position,
    },
  });

  return status;
}

async function updateStatus(statusId: string, data: UpdateStatusInput) {
  const status = await prisma.spaceStatus.update({
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

async function deleteStatus(statusId: string) {
  const status = await prisma.spaceStatus.findUnique({
    where: { id: statusId },
    include: { space: { include: { lists: { where: { deletedAt: null }, select: { id: true } } } } },
  });

  if (!status) {
    throw new AppError(404, 'Status not found', 'NOT_FOUND');
  }

  // Check if any tasks in this space's lists use this status name
  const listIds = status.space.lists.map((l) => l.id);
  if (listIds.length > 0) {
    const taskCount = await prisma.task.count({
      where: {
        listId: { in: listIds },
        statusName: status.name,
        deletedAt: null,
      },
    });

    if (taskCount > 0) {
      throw new AppError(400, `Cannot delete status: ${taskCount} task(s) are using it`, 'STATUS_IN_USE');
    }
  }

  await prisma.spaceStatus.delete({
    where: { id: statusId },
  });

  return { deleted: true };
}

async function reorderStatuses(spaceId: string, statuses: ReorderStatusesInput['statuses']) {
  await prisma.$transaction(
    statuses.map((s) =>
      prisma.spaceStatus.update({
        where: { id: s.id },
        data: { position: s.position },
      })
    )
  );

  const updated = await prisma.spaceStatus.findMany({
    where: { spaceId },
    orderBy: { position: 'asc' },
  });

  return updated;
}

// ==========================================
// Task ID Prefix
// ==========================================

async function setTaskIdPrefix(spaceId: string, userId: string, prefix: string) {
  await checkSpaceRole(spaceId, userId, ['OWNER', 'ADMIN']);

  // Validate prefix is unique across the workspace
  const space = await prisma.space.findUnique({
    where: { id: spaceId },
    select: { workspaceId: true },
  });

  if (!space) {
    throw new AppError(404, 'Space not found', 'NOT_FOUND');
  }

  const existing = await prisma.space.findFirst({
    where: {
      workspaceId: space.workspaceId,
      taskIdPrefix: prefix,
      id: { not: spaceId },
      deletedAt: null,
    },
  });

  if (existing) {
    throw new AppError(409, `Prefix "${prefix}" is already used by another space`, 'PREFIX_TAKEN');
  }

  const updated = await prisma.space.update({
    where: { id: spaceId },
    data: { taskIdPrefix: prefix },
  });

  return updated;
}

// ==========================================
// Export
// ==========================================

export const spacesService = {
  // Helpers
  checkSpaceAccess,
  checkSpaceRole,
  // Space CRUD
  getSpaces,
  createSpace,
  getSpaceById,
  updateSpace,
  deleteSpace,
  updatePosition,
  duplicateSpace,
  // Members
  getMembers,
  addMembers,
  updateMemberRole,
  removeMember,
  // Statuses
  getStatuses,
  createStatus,
  updateStatus,
  deleteStatus,
  reorderStatuses,
  // Task ID Prefix
  setTaskIdPrefix,
};
