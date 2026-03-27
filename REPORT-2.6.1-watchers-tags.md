# REPORT 2.6.1: Task Watchers & Tags System

**Task:** Implement Watchers (Followers) & Workspace Tags
**Status:** COMPLETE
**Date:** 2026-03-26

---

## Schema Changes

### Models Added
| Model | Table | Purpose |
|-------|-------|---------|
| TaskWatcher | task_watchers | User watching a task (unique: taskId+userId) |
| WorkspaceTag | workspace_tags | Workspace-level colored tags (unique: workspaceId+name) |
| TaskTag | task_tags_new | Join table: task ↔ tag (unique: taskId+tagId) |

### Relations Added
- Task: watchers, workspaceTags
- User: taskWatching, workspaceTagsCreated
- Workspace: tags

## Files Created (5)

| File | Purpose |
|------|---------|
| `backend/src/modules/tags/tags.validation.ts` | Zod schemas |
| `backend/src/modules/tags/tags.service.ts` | 7 tag methods |
| `backend/src/modules/tags/tags.routes.ts` | 7 endpoints |
| `frontend/src/hooks/useTags.ts` | TanStack Query hooks |
| `frontend/src/hooks/useWatchers.ts` | TanStack Query hooks |
| `frontend/src/modules/tags/TagSelector.tsx` | Dropdown with search, multi-select, inline create |

## Files Modified (4)

| File | Change |
|------|--------|
| `backend/src/modules/tasks/tasks.service.ts` | 5 watcher methods + auto-watch on create/assign/comment + tags/watchers in getTask |
| `backend/src/modules/tasks/tasks.routes.ts` | 3 watcher endpoints |
| `backend/src/index.ts` | Registered tags router |
| `frontend/src/modules/spaces/ListViewPage.tsx` | Tag chips + eye icon for watched tasks |

## Watcher Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /:taskId/watchers | Watch task |
| DELETE | /:taskId/watchers | Unwatch task |
| GET | /:taskId/watchers | List watchers |

## Auto-Watch Rules
- Task creator → auto-watched
- Task assignee → auto-watched
- Task commenter → auto-watched

## Tag Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /workspace/:workspaceId | List workspace tags |
| POST | /workspace/:workspaceId | Create tag |
| PATCH | /:tagId | Update tag |
| DELETE | /:tagId | Delete tag (removes from all tasks) |
| POST | /task/:taskId/tags | Add tags to task |
| DELETE | /task/:taskId/tags/:tagId | Remove tag |
| GET | /task/:taskId/tags | List task's tags |

## Task Detail Integration
- `watchers` array with user info
- `isWatching` boolean for current user
- `tags` array with id, name, color

## Frontend
- TagSelector: dropdown with search, checkboxes, inline creation with color picker
- ListViewPage: colored tag chips (max 3 + overflow), eye icon for watched

## Build
- Backend: 0 errors
- Frontend: new files clean
