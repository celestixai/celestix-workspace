# REPORT 2.3.1: Advanced Relationships System

**Task:** Implement Task Relationships (Blocking/Waiting/Linked)
**Status:** COMPLETE
**Date:** 2026-03-26

---

## Schema Changes

- **RelationType enum**: BLOCKS, WAITING_ON, LINKED_TO
- **TaskRelationship model**: sourceTaskId, targetTaskId, type, createdById. Unique on [source, target, type].
- **Task model**: Added relationshipsAsSource/Target relations
- **User model**: Added taskRelationshipsCreated relation

## Files Created (5)

| File | Purpose |
|------|---------|
| `backend/src/modules/relationships/relationships.validation.ts` | Zod schema |
| `backend/src/modules/relationships/relationships.service.ts` | CRUD + auto-inverse + warnings |
| `backend/src/modules/relationships/relationships.routes.ts` | 4 endpoints |
| `frontend/src/hooks/useRelationships.ts` | TanStack Query hooks |
| `frontend/src/modules/tasks/TaskRelationships.tsx` | UI with grouped display + add modal |

## Files Modified (3)

| File | Change |
|------|--------|
| `backend/src/modules/tasks/tasks.routes.ts` | Mounted relationships router |
| `backend/src/modules/tasks/tasks.service.ts` | Task detail includes relationships + warnings |
| `frontend/src/modules/spaces/ListViewPage.tsx` | Link icon + warning icon on tasks |

## Relationship Types

| Type | Behavior |
|------|----------|
| BLOCKS | Auto-creates inverse WAITING_ON on target |
| WAITING_ON | Auto-creates inverse BLOCKS on target |
| LINKED_TO | Bidirectional pair, deduped in response |

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /:taskId/relationships | Create (auto-inverse) |
| GET | /:taskId/relationships | Grouped: blocking, waitingOn, linkedTo |
| DELETE | /relationships/:relationshipId | Deletes both sides |
| GET | /:taskId/dependency-warnings | Unresolved blocking warnings |

## Test Results

| Test | Result |
|------|--------|
| Create BLOCKS | Inverse WAITING_ON auto-created |
| Get relationships (both sides) | Correct grouped data |
| Dependency warnings | Warning when blocker not DONE |
| Delete relationship | Both sides removed |
| LINKED_TO | Bidirectional, deduped |
| Self-relationship | Prevented |

## Build
- Backend: 0 errors
- Frontend: new files clean
