# REPORT 2.5.1: Task Templates

**Task:** Implement Task Template System
**Status:** COMPLETE
**Date:** 2026-03-26

---

## Schema Changes

- **TemplateType enum**: TASK, LIST, FOLDER, SPACE
- **TaskTemplate model** (task_templates): name, description, templateType, templateData (JSON), tags, isPublic, isPinned, usageCount
- Workspace + User relations added

## Files Created (5)

| File | Purpose |
|------|---------|
| `backend/src/modules/templates/templates.validation.ts` | Zod schemas |
| `backend/src/modules/templates/templates.service.ts` | 10 service methods |
| `backend/src/modules/templates/templates.routes.ts` | 10 endpoints |
| `frontend/src/hooks/useTemplates.ts` | TanStack Query hooks |
| `frontend/src/modules/templates/TemplateLibrary.tsx` | Grid view with search/filter/preview |
| `frontend/src/modules/templates/ApplyTemplateModal.tsx` | Space/list selection + date remap |

## Files Modified (2)

| File | Change |
|------|--------|
| `backend/prisma/schema.prisma` | TemplateType enum + TaskTemplate model + relations |
| `backend/src/index.ts` | Registered templates router |

## Endpoints (10)

| Method | Path | Description |
|--------|------|-------------|
| GET | /workspace/:workspaceId | List templates (filter: type, tags, search) |
| POST | /workspace/:workspaceId | Create template from scratch |
| POST | /from-task/:taskId | Create template from existing task |
| POST | /from-list/:listId | Create template from list + tasks |
| GET | /:templateId | Get template details |
| PATCH | /:templateId | Update template |
| DELETE | /:templateId | Delete template |
| POST | /:templateId/apply | Apply template (creates tasks/lists) |
| POST | /:templateId/pin | Toggle pin |
| GET | /workspace/:workspaceId/tags | List all template tags |

## Apply Template Logic

- **TASK template**: Creates task with subtasks + checklists in target list
- **LIST template**: Creates list + all tasks
- **Date remapping**: Shifts all dates by offset from today
- **Custom IDs**: Auto-generates if space has prefix
- **Usage tracking**: Increments usageCount on each apply

## Build
- Backend: 0 errors
- Frontend: new files clean
