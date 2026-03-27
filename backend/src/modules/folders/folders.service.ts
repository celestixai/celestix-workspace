import { prisma } from '../../config/database';
import { AppError } from '../../middleware/error-handler';
import { spacesService } from '../spaces/spaces.service';
import type {
  CreateFolderInput,
  UpdateFolderInput,
  CreateFolderStatusInput,
  UpdateFolderStatusInput,
  MoveFolderInput,
} from './folders.validation';

// ==========================================
// Folder CRUD
// ==========================================

async function getFolders(spaceId: string, userId: string) {
  // Check space access first
  await spacesService.checkSpaceAccess(spaceId, userId);

  const folders = await prisma.folder.findMany({
    where: {
      spaceId,
      parentFolderId: null, // Only top-level folders
      deletedAt: null,
    },
    include: {
      lists: {
        where: { deletedAt: null },
        select: {
          id: true,
          _count: { select: { tasks: { where: { deletedAt: null } } } },
        },
      },
      subfolders: {
        where: { deletedAt: null },
        select: { id: true },
      },
    },
    orderBy: { position: 'asc' },
  });

  return folders.map((folder) => ({
    id: folder.id,
    spaceId: folder.spaceId,
    parentFolderId: folder.parentFolderId,
    name: folder.name,
    description: folder.description,
    color: folder.color,
    icon: folder.icon,
    position: folder.position,
    useCustomStatuses: folder.useCustomStatuses,
    isHidden: folder.isHidden,
    createdAt: folder.createdAt,
    updatedAt: folder.updatedAt,
    listCount: folder.lists.length,
    taskCount: folder.lists.reduce((sum, list) => sum + list._count.tasks, 0),
    subfolderCount: folder.subfolders.length,
  }));
}

async function createFolder(spaceId: string, userId: string, data: CreateFolderInput) {
  // Check space membership (MEMBER+ can create)
  await spacesService.checkSpaceRole(spaceId, userId, ['OWNER', 'ADMIN', 'MEMBER']);

  // If parentFolderId is set, verify parent exists in same space
  if (data.parentFolderId) {
    const parentFolder = await prisma.folder.findUnique({
      where: { id: data.parentFolderId, deletedAt: null },
      select: { id: true, spaceId: true },
    });

    if (!parentFolder) {
      throw new AppError(404, 'Parent folder not found', 'NOT_FOUND');
    }

    if (parentFolder.spaceId !== spaceId) {
      throw new AppError(400, 'Parent folder must be in the same space', 'INVALID_PARENT');
    }
  }

  // Get max position
  const maxPos = await prisma.folder.aggregate({
    where: {
      spaceId,
      parentFolderId: data.parentFolderId ?? null,
      deletedAt: null,
    },
    _max: { position: true },
  });
  const position = (maxPos._max.position ?? -1) + 1;

  const folder = await prisma.folder.create({
    data: {
      spaceId,
      name: data.name,
      description: data.description,
      color: data.color,
      icon: data.icon,
      parentFolderId: data.parentFolderId,
      position,
      createdById: userId,
    },
  });

  return folder;
}

async function getFolderById(folderId: string, userId: string) {
  const folder = await prisma.folder.findUnique({
    where: { id: folderId, deletedAt: null },
    include: {
      lists: {
        where: { deletedAt: null },
        orderBy: { position: 'asc' },
      },
      subfolders: {
        where: { deletedAt: null },
        orderBy: { position: 'asc' },
      },
      statuses: {
        orderBy: { position: 'asc' },
      },
    },
  });

  if (!folder) {
    throw new AppError(404, 'Folder not found', 'NOT_FOUND');
  }

  // Check space access
  await spacesService.checkSpaceAccess(folder.spaceId, userId);

  return folder;
}

async function updateFolder(folderId: string, userId: string, data: UpdateFolderInput) {
  const folder = await prisma.folder.findUnique({
    where: { id: folderId, deletedAt: null },
    select: { id: true, spaceId: true, createdById: true },
  });

  if (!folder) {
    throw new AppError(404, 'Folder not found', 'NOT_FOUND');
  }

  // Require space ADMIN+ or folder creator
  const member = await spacesService.checkSpaceAccess(folder.spaceId, userId);
  const isAdminPlus = member && ['OWNER', 'ADMIN'].includes(member.role);
  const isCreator = folder.createdById === userId;

  if (!isAdminPlus && !isCreator) {
    throw new AppError(403, 'You do not have permission to update this folder', 'FORBIDDEN');
  }

  const updated = await prisma.folder.update({
    where: { id: folderId },
    data: {
      name: data.name,
      description: data.description,
      color: data.color,
      icon: data.icon,
    },
  });

  return updated;
}

async function deleteFolder(folderId: string, userId: string) {
  const folder = await prisma.folder.findUnique({
    where: { id: folderId, deletedAt: null },
    select: { id: true, spaceId: true, createdById: true },
  });

  if (!folder) {
    throw new AppError(404, 'Folder not found', 'NOT_FOUND');
  }

  // Require space ADMIN+ or folder creator
  const member = await spacesService.checkSpaceAccess(folder.spaceId, userId);
  const isAdminPlus = member && ['OWNER', 'ADMIN'].includes(member.role);
  const isCreator = folder.createdById === userId;

  if (!isAdminPlus && !isCreator) {
    throw new AppError(403, 'You do not have permission to delete this folder', 'FORBIDDEN');
  }

  // Soft delete
  const deleted = await prisma.folder.update({
    where: { id: folderId },
    data: { deletedAt: new Date() },
  });

  return deleted;
}

async function updatePosition(folderId: string, position: number) {
  const folder = await prisma.folder.update({
    where: { id: folderId },
    data: { position },
  });

  return folder;
}

// ==========================================
// Subfolders
// ==========================================

async function getSubfolders(folderId: string) {
  const subfolders = await prisma.folder.findMany({
    where: {
      parentFolderId: folderId,
      deletedAt: null,
    },
    orderBy: { position: 'asc' },
  });

  return subfolders;
}

async function createSubfolder(folderId: string, userId: string, data: CreateFolderInput) {
  const parentFolder = await prisma.folder.findUnique({
    where: { id: folderId, deletedAt: null },
    select: { id: true, spaceId: true },
  });

  if (!parentFolder) {
    throw new AppError(404, 'Parent folder not found', 'NOT_FOUND');
  }

  // Create subfolder in the same space as parent, with parent set
  return createFolder(parentFolder.spaceId, userId, {
    ...data,
    parentFolderId: folderId,
  });
}

// ==========================================
// Folder Statuses (custom override)
// ==========================================

async function getEffectiveFolderStatuses(folderId: string) {
  const folder = await prisma.folder.findUnique({
    where: { id: folderId, deletedAt: null },
    select: {
      id: true,
      spaceId: true,
      useCustomStatuses: true,
      statuses: { orderBy: { position: 'asc' } },
    },
  });

  if (!folder) {
    throw new AppError(404, 'Folder not found', 'NOT_FOUND');
  }

  // If folder has custom statuses, return them
  if (folder.useCustomStatuses && folder.statuses.length > 0) {
    return {
      source: 'folder' as const,
      folderId: folder.id,
      statuses: folder.statuses,
    };
  }

  // Otherwise, inherit from the parent space
  const spaceStatuses = await prisma.spaceStatus.findMany({
    where: { spaceId: folder.spaceId },
    orderBy: { position: 'asc' },
  });

  return {
    source: 'space' as const,
    spaceId: folder.spaceId,
    statuses: spaceStatuses,
  };
}

async function createFolderStatus(folderId: string, data: CreateFolderStatusInput) {
  const folder = await prisma.folder.findUnique({
    where: { id: folderId, deletedAt: null },
    select: { id: true, useCustomStatuses: true },
  });

  if (!folder) {
    throw new AppError(404, 'Folder not found', 'NOT_FOUND');
  }

  // Get max position if not provided
  let position = data.position;
  if (position === undefined) {
    const maxPos = await prisma.folderStatus.aggregate({
      where: { folderId },
      _max: { position: true },
    });
    position = (maxPos._max.position ?? -1) + 1;
  }

  // Auto-enable custom statuses on the folder
  if (!folder.useCustomStatuses) {
    await prisma.folder.update({
      where: { id: folderId },
      data: { useCustomStatuses: true },
    });
  }

  const status = await prisma.folderStatus.create({
    data: {
      folderId,
      name: data.name,
      color: data.color,
      statusGroup: data.statusGroup,
      position,
    },
  });

  return status;
}

async function updateFolderStatus(statusId: string, data: UpdateFolderStatusInput) {
  const status = await prisma.folderStatus.update({
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

async function deleteFolderStatus(statusId: string) {
  const status = await prisma.folderStatus.findUnique({
    where: { id: statusId },
    include: {
      folder: {
        include: {
          lists: { where: { deletedAt: null }, select: { id: true } },
        },
      },
    },
  });

  if (!status) {
    throw new AppError(404, 'Folder status not found', 'NOT_FOUND');
  }

  // Check if any tasks in this folder's lists use this status name
  const listIds = status.folder.lists.map((l) => l.id);
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

  await prisma.folderStatus.delete({
    where: { id: statusId },
  });

  return { deleted: true };
}

// ==========================================
// Move
// ==========================================

async function moveFolder(folderId: string, userId: string, data: MoveFolderInput) {
  const folder = await prisma.folder.findUnique({
    where: { id: folderId, deletedAt: null },
    select: { id: true, spaceId: true },
  });

  if (!folder) {
    throw new AppError(404, 'Folder not found', 'NOT_FOUND');
  }

  // Require ADMIN+ in source space
  await spacesService.checkSpaceRole(folder.spaceId, userId, ['OWNER', 'ADMIN']);

  const updateData: { spaceId?: string; parentFolderId?: string | null } = {};

  // If moving to a different space
  if (data.targetSpaceId && data.targetSpaceId !== folder.spaceId) {
    // Require MEMBER+ in target space
    await spacesService.checkSpaceRole(data.targetSpaceId, userId, ['OWNER', 'ADMIN', 'MEMBER']);
    updateData.spaceId = data.targetSpaceId;
    // When moving to a new space, reset parentFolderId unless explicitly set
    updateData.parentFolderId = data.parentFolderId !== undefined ? data.parentFolderId : null;
  } else if (data.parentFolderId !== undefined) {
    // Moving within the same space to a new parent
    if (data.parentFolderId !== null) {
      const targetParent = await prisma.folder.findUnique({
        where: { id: data.parentFolderId, deletedAt: null },
        select: { id: true, spaceId: true },
      });

      if (!targetParent) {
        throw new AppError(404, 'Target parent folder not found', 'NOT_FOUND');
      }

      const effectiveSpaceId = data.targetSpaceId || folder.spaceId;
      if (targetParent.spaceId !== effectiveSpaceId) {
        throw new AppError(400, 'Target parent folder must be in the same space', 'INVALID_PARENT');
      }

      // Prevent circular reference
      if (data.parentFolderId === folderId) {
        throw new AppError(400, 'A folder cannot be its own parent', 'CIRCULAR_REFERENCE');
      }
    }
    updateData.parentFolderId = data.parentFolderId;
  }

  const updated = await prisma.folder.update({
    where: { id: folderId },
    data: updateData,
  });

  return updated;
}

// ==========================================
// Export
// ==========================================

export const foldersService = {
  // Folder CRUD
  getFolders,
  createFolder,
  getFolderById,
  updateFolder,
  deleteFolder,
  updatePosition,
  // Subfolders
  getSubfolders,
  createSubfolder,
  // Folder Statuses
  getEffectiveFolderStatuses,
  createFolderStatus,
  updateFolderStatus,
  deleteFolderStatus,
  // Move
  moveFolder,
};
