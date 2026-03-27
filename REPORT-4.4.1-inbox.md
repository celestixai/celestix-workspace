# REPORT 4.4.1: Smart Inbox

**Task:** Implement Smart Inbox System
**Status:** COMPLETE
**Date:** 2026-03-26

---

## Schema Changes

- **InboxItemType enum**: 9 types (TASK_ASSIGNED, TASK_MENTIONED, etc.)
- **InboxCategory enum**: PRIMARY, OTHER, LATER
- **InboxItem model** (inbox_items): with smart categorization, snooze, save

## Files Created (5)

| File | Purpose |
|------|---------|
| `backend/src/modules/inbox/inbox.validation.ts` | Zod schemas |
| `backend/src/modules/inbox/inbox.service.ts` | CRUD + smart categorization + event hooks |
| `backend/src/modules/inbox/inbox.routes.ts` | 9 endpoints |
| `frontend/src/hooks/useInbox.ts` | TanStack Query hooks (30s refetch for counts) |
| `frontend/src/modules/inbox/InboxItem.tsx` | Item row with hover actions |
| `frontend/src/modules/inbox/InboxPage.tsx` | Full page with sidebar tabs + grouped items |

## Files Modified (5)

| File | Change |
|------|--------|
| `backend/prisma/schema.prisma` | InboxItem model + enums |
| `backend/src/index.ts` | Registered inbox routes |
| `frontend/src/stores/ui.store.ts` | Added 'inbox' to ActiveModule |
| `frontend/src/components/layout/nav-rail.tsx` | Inbox nav item after Home |
| `frontend/src/components/layout/top-bar.tsx` | inbox module name |
| `frontend/src/App.tsx` | Lazy import + moduleMap |

## Smart Categorization

| Category | Item Types |
|----------|-----------|
| PRIMARY | TASK_ASSIGNED, TASK_MENTIONED, COMMENT_ASSIGNED, DUE_DATE_REMINDER |
| OTHER | STATUS_CHANGED, WATCHER_UPDATE, COMMENT_MENTION |

## Endpoints (9)

GET /, GET /counts, PATCH /:id/read, PATCH /:id/action, POST /:id/snooze, POST /:id/save, DELETE /:id, POST /clear-all, POST /read-all

## Frontend Features

- Sidebar tabs: Primary/Other/Later/Saved with count badges
- Items grouped: Today/Yesterday/This Week/Older
- Hover actions: Done, Snooze, Save
- Click → navigate to source
- Bulk: mark all read, clear read

## Build
- Backend: 0 errors
- Frontend: succeeds
