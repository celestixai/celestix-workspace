# REPORT 1.5.1: Hierarchical Permissions Engine

**Task:** Create Permissions Service & Middleware
**Status:** COMPLETE
**Date:** 2026-03-26

---

## Files Created (3)

| File | Purpose |
|------|---------|
| `backend/src/modules/permissions/permissions.types.ts` | Permission enum (20 types) + ResourceType union |
| `backend/src/modules/permissions/permissions.service.ts` | Core permission resolution service |
| `backend/src/middleware/permissions.ts` | `checkPermission()` middleware factory |

## Permission Types (20)

| Level | Permissions |
|-------|------------|
| Space | SPACE_VIEW, SPACE_EDIT, SPACE_DELETE, SPACE_MANAGE_MEMBERS, SPACE_MANAGE_STATUSES |
| Folder | FOLDER_CREATE, FOLDER_EDIT, FOLDER_DELETE |
| List | LIST_CREATE, LIST_EDIT, LIST_DELETE |
| Task | TASK_CREATE, TASK_EDIT, TASK_DELETE, TASK_ASSIGN, TASK_COMMENT, TASK_CHANGE_STATUS |
| View | VIEW_CREATE, VIEW_EDIT |

## Role → Permission Mapping

| Role | Permissions |
|------|------------|
| Workspace OWNER/ADMIN | ALL (full access to everything) |
| Space OWNER | All space + folder + list + task + view |
| Space ADMIN | Same minus SPACE_DELETE |
| Space MEMBER | VIEW, CREATE (folder/list/task/view), EDIT/DELETE own, ASSIGN, COMMENT, CHANGE_STATUS |
| Space GUEST | VIEW, COMMENT only |

## Service Methods

- `canAccess(userId, resourceType, resourceId)` — hierarchy resolution (task→list→space→workspace)
- `getPermissions(userId, resourceType, resourceId)` — returns Permission[] based on role
- `requirePermission(userId, permission, resourceType, resourceId)` — throws 403 if denied
- `getSpaceMembership(userId, spaceId)` — SpaceMember lookup
- `getWorkspaceMembership(userId, workspaceId)` — WorkspaceMember lookup
- `resolveSpaceId(resourceType, resourceId)` — walks hierarchy to find spaceId
- `resolveWorkspaceId(resourceType, resourceId)` — walks hierarchy to find workspaceId

## Middleware

`checkPermission(permission, resourceType, paramName)` — factory that creates Express middleware extracting userId from req.user and resourceId from req.params.

## Test Results

- Iris (workspace MEMBER, space MEMBER on Engineering): received 10 permissions matching MEMBER role
- `canAccess`, `getPermissions`, `requirePermission`, membership lookups all verified

## Build

- `pnpm run build` — 0 TypeScript errors
