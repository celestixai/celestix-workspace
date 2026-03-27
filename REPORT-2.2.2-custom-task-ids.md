# REPORT 2.2.2: Custom Task IDs

**Task:** Implement Custom Task IDs (e.g., ENG-001)
**Status:** COMPLETE
**Date:** 2026-03-26

---

## Schema Changes

- **Space model**: Added `taskIdPrefix` (String?) and `taskIdCounter` (Int, default 0)
- **Task model**: Added `@unique` constraint to `customTaskId`

## Files Modified (11)

### Backend (8)
| File | Change |
|------|--------|
| `backend/prisma/schema.prisma` | Space fields + Task @unique |
| `backend/src/modules/spaces/spaces.validation.ts` | setTaskIdPrefixSchema |
| `backend/src/modules/spaces/spaces.service.ts` | setTaskIdPrefix() method |
| `backend/src/modules/spaces/spaces.routes.ts` | PATCH /:spaceId/task-id-prefix |
| `backend/src/modules/tasks/tasks.service.ts` | generateCustomTaskId() + integrated into create flows |
| `backend/src/modules/tasks/tasks.schema.ts` | Added listId, statusName, statusColor, taskTypeId to create schema |
| `backend/src/modules/tasks/tasks.routes.ts` | GET /by-id/:customTaskId |
| `backend/prisma/seed.ts` | Prefixes (ENG/DES/MKT), custom IDs on tasks, counters |

### Frontend (3)
| File | Change |
|------|--------|
| `frontend/src/hooks/useSpaces.ts` | Added taskIdPrefix/Counter to Space interface |
| `frontend/src/modules/spaces/ListViewPage.tsx` | Clickable custom ID badge (copy to clipboard) |
| `frontend/src/modules/spaces/SpaceSettingsPage.tsx` | Task ID Prefix section with preview |

## How It Works

1. Admin sets prefix on Space (e.g., "ENG") via Space Settings
2. When a task is created in that space's lists, `generateCustomTaskId()`:
   - Atomically increments `Space.taskIdCounter` in a Prisma `$transaction`
   - Sets `customTaskId = "ENG-001"` (zero-padded to 3 digits)
3. Custom ID is unique across the entire database
4. Searchable via `GET /tasks/by-id/:customTaskId` (case-insensitive)

## Test Results

| Test | Result |
|------|--------|
| Seeded tasks have custom IDs | ENG-001 through ENG-009, DES-001/002, MKT-001/002 |
| Create new task auto-assigns | ENG-010 |
| Search by custom ID | GET /tasks/by-id/ENG-001 returns task |
| Case-insensitive search | eng-005 works |
| Non-existent ID | Returns 404 |
| Duplicate prefix rejected | "ENG" blocked when already in use |

## Build
- Backend: 0 errors
- Frontend: new files clean
