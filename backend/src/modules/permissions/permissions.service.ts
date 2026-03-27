import { SpaceRole, WorkspaceRole } from '@prisma/client';
import type { SpaceMember, WorkspaceMember } from '@prisma/client';
import { prisma } from '../../config/database';
import { AppError } from '../../middleware/error-handler';
import { Permission, ResourceType } from './permissions.types';

// ==========================================
// Permission sets by role
// ==========================================

const ALL_PERMISSIONS = Object.values(Permission);

const SPACE_OWNER_PERMISSIONS = ALL_PERMISSIONS;

const SPACE_ADMIN_PERMISSIONS = ALL_PERMISSIONS.filter(
  (p) => p !== Permission.SPACE_DELETE
);

const SPACE_MEMBER_PERMISSIONS: Permission[] = [
  Permission.SPACE_VIEW,
  Permission.FOLDER_CREATE,
  Permission.LIST_CREATE,
  Permission.TASK_CREATE,
  Permission.TASK_EDIT,
  Permission.TASK_DELETE,
  Permission.TASK_ASSIGN,
  Permission.TASK_COMMENT,
  Permission.TASK_CHANGE_STATUS,
  Permission.VIEW_CREATE,
];

const SPACE_GUEST_PERMISSIONS: Permission[] = [
  Permission.SPACE_VIEW,
  Permission.TASK_COMMENT,
];

function getPermissionsForSpaceRole(role: SpaceRole): Permission[] {
  switch (role) {
    case 'OWNER':
      return SPACE_OWNER_PERMISSIONS;
    case 'ADMIN':
      return SPACE_ADMIN_PERMISSIONS;
    case 'MEMBER':
      return SPACE_MEMBER_PERMISSIONS;
    case 'GUEST':
      return SPACE_GUEST_PERMISSIONS;
    default:
      return [];
  }
}

// ==========================================
// Resolution helpers (private)
// ==========================================

async function resolveSpaceId(
  resourceType: ResourceType,
  resourceId: string
): Promise<string | null> {
  switch (resourceType) {
    case 'space':
      return resourceId;

    case 'folder': {
      const folder = await prisma.folder.findUnique({
        where: { id: resourceId },
        select: { spaceId: true },
      });
      return folder?.spaceId ?? null;
    }

    case 'list': {
      const list = await prisma.taskList.findUnique({
        where: { id: resourceId },
        select: { spaceId: true },
      });
      return list?.spaceId ?? null;
    }

    case 'task': {
      const task = await prisma.task.findUnique({
        where: { id: resourceId },
        select: { listId: true },
      });
      if (!task?.listId) return null;
      const taskList = await prisma.taskList.findUnique({
        where: { id: task.listId },
        select: { spaceId: true },
      });
      return taskList?.spaceId ?? null;
    }

    default:
      return null;
  }
}

async function resolveWorkspaceId(
  resourceType: ResourceType,
  resourceId: string
): Promise<string | null> {
  if (resourceType === 'workspace') {
    return resourceId;
  }

  const spaceId = await resolveSpaceId(resourceType, resourceId);
  if (!spaceId) return null;

  const space = await prisma.space.findUnique({
    where: { id: spaceId },
    select: { workspaceId: true },
  });
  return space?.workspaceId ?? null;
}

// ==========================================
// Membership lookups
// ==========================================

async function getSpaceMembership(
  userId: string,
  spaceId: string
): Promise<SpaceMember | null> {
  return prisma.spaceMember.findUnique({
    where: { spaceId_userId: { spaceId, userId } },
  });
}

async function getWorkspaceMembership(
  userId: string,
  workspaceId: string
): Promise<WorkspaceMember | null> {
  return prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
  });
}

// ==========================================
// Core permission methods
// ==========================================

async function canAccess(
  userId: string,
  resourceType: ResourceType,
  resourceId: string
): Promise<boolean> {
  // 1. Workspace-level: just check WorkspaceMember
  if (resourceType === 'workspace') {
    const wsMember = await getWorkspaceMembership(userId, resourceId);
    return !!wsMember;
  }

  // 2. Resolve workspace and check workspace-level admin/owner
  const workspaceId = await resolveWorkspaceId(resourceType, resourceId);
  if (!workspaceId) return false;

  const wsMember = await getWorkspaceMembership(userId, workspaceId);
  if (!wsMember) return false;

  // Workspace OWNER/ADMIN always have full access
  if (wsMember.role === 'OWNER' || wsMember.role === 'ADMIN') {
    return true;
  }

  // 3. For space-level and below, resolve spaceId
  const spaceId = await resolveSpaceId(resourceType, resourceId);
  if (!spaceId) return false;

  // Check space membership
  const spaceMember = await getSpaceMembership(userId, spaceId);
  if (spaceMember) return true;

  // Public space + workspace member → can view
  const space = await prisma.space.findUnique({
    where: { id: spaceId, deletedAt: null },
    select: { isPrivate: true },
  });
  if (space && !space.isPrivate) return true;

  return false;
}

async function getPermissions(
  userId: string,
  resourceType: ResourceType,
  resourceId: string
): Promise<Permission[]> {
  // 1. Workspace-level: OWNER/ADMIN → all perms, others → none (workspace itself has no granular perms)
  if (resourceType === 'workspace') {
    const wsMember = await getWorkspaceMembership(userId, resourceId);
    if (!wsMember) return [];
    if (wsMember.role === 'OWNER' || wsMember.role === 'ADMIN') {
      return ALL_PERMISSIONS;
    }
    return [];
  }

  // 2. Resolve workspace and check workspace-level role
  const workspaceId = await resolveWorkspaceId(resourceType, resourceId);
  if (!workspaceId) return [];

  const wsMember = await getWorkspaceMembership(userId, workspaceId);
  if (!wsMember) return [];

  // Workspace OWNER/ADMIN → all permissions on everything
  if (wsMember.role === 'OWNER' || wsMember.role === 'ADMIN') {
    return ALL_PERMISSIONS;
  }

  // 3. Resolve spaceId and check space membership
  const spaceId = await resolveSpaceId(resourceType, resourceId);
  if (!spaceId) return [];

  const spaceMember = await getSpaceMembership(userId, spaceId);
  if (spaceMember) {
    return getPermissionsForSpaceRole(spaceMember.role);
  }

  // 4. Public space + workspace member → view only
  const space = await prisma.space.findUnique({
    where: { id: spaceId, deletedAt: null },
    select: { isPrivate: true },
  });
  if (space && !space.isPrivate) {
    return [Permission.SPACE_VIEW, Permission.TASK_COMMENT];
  }

  return [];
}

async function requirePermission(
  userId: string,
  permission: Permission,
  resourceType: ResourceType,
  resourceId: string
): Promise<void> {
  const permissions = await getPermissions(userId, resourceType, resourceId);

  if (!permissions.includes(permission)) {
    throw new AppError(
      403,
      'You do not have permission to perform this action',
      'FORBIDDEN'
    );
  }
}

// ==========================================
// Export
// ==========================================

export const permissionsService = {
  canAccess,
  getPermissions,
  requirePermission,
  getSpaceMembership,
  getWorkspaceMembership,
  resolveSpaceId,
  resolveWorkspaceId,
};
