# REPORT 1.1.1: Hierarchy Schema Models

**Task:** Create Space, Folder, List Prisma Models
**Status:** COMPLETE
**Date:** 2026-03-26

---

## Models Added (10 new models)

| # | Model | Table Name | Purpose |
|---|-------|------------|---------|
| 1 | Space | spaces_hierarchy | Top-level org unit within Workspace |
| 2 | SpaceMember | space_members | User membership + role in Space |
| 3 | SpaceStatus | space_statuses | Custom statuses per Space |
| 4 | Folder | folders | Grouping within Spaces (supports nesting) |
| 5 | FolderStatus | folder_statuses | Optional custom statuses per Folder |
| 6 | TaskList | task_lists | Task container (replaces Project concept) |
| 7 | ListStatus | list_statuses | Optional custom statuses per List |
| 8 | Checklist | checklists | Checklist groups within Tasks |
| 9 | ChecklistItem | checklist_items | Individual checklist items |
| 10 | TaskListMembership | task_list_memberships | Tasks in multiple Lists |

## Enums Added (2)

| Enum | Values |
|------|--------|
| StatusGroup | NOT_STARTED, ACTIVE, DONE, CLOSED |
| SpaceRole | OWNER, ADMIN, MEMBER, GUEST |

## Existing Models Modified

### Task model — 8 new fields added:
- `listId` (FK to TaskList) — new primary location
- `statusName` — actual status text (e.g., "In Progress")
- `statusColor` — color from status definition
- `taskType` — default "task" (task, milestone, bug, feature, etc.)
- `customTaskId` — like "DEV-123"
- `startDate` — task start date
- `isSubtask` — flag for subtasks
- `depth` — nesting depth for subtasks

### Task model — 3 new relations:
- `list` → TaskList
- `checklists` → Checklist[]
- `listMemberships` → TaskListMembership[]

### Task model — 1 new index:
- `@@index([listId, status])`

### Workspace model:
- Added `spaces: Space[]` relation

### User model — 5 new relations:
- `createdSpaces` → Space[] ("SpaceCreator")
- `spaceMembers` → SpaceMember[]
- `createdFolders` → Folder[] ("FolderCreator")
- `createdTaskLists` → TaskList[] ("TaskListCreator")
- `checklistItemAssignments` → ChecklistItem[] ("ChecklistItemAssignee")

## Migration

- **Name:** `20260326082431_add_hierarchy_models`
- **Status:** Applied successfully
- **Location:** `backend/prisma/migrations/20260326082431_add_hierarchy_models/`

## Build

- `npx prisma generate` — SUCCESS
- `pnpm run build` (tsc) — SUCCESS, 0 errors

## Errors & Fixes

1. **DLL lock on prisma generate:** Background dev server held lock on `query_engine-windows.dll.node`. Fixed by killing dev server processes before regenerating.
2. **No schema/migration errors** — all models validated and migrated cleanly.

## Verification

- All 10 new models present in schema at lines 2565-2743
- Both new enums at lines 147-160
- Task model fields at lines 822-829
- Task model relations at lines 842-844
- New index at line 848
- Migration file exists in migrations directory
- TypeScript compiles with zero errors
