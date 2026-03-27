# REPORT 3.2.7: Activity, Team, Embed, Form Views

**Task:** Implement Remaining Lightweight Views
**Status:** COMPLETE
**Date:** 2026-03-26

---

## Backend Changes

- `task-query.service.ts` — Added `getActivityFeed()` with cursor pagination
- `views.routes.ts` — Added `GET /views/activity` endpoint

## Files Created (4)

| File | Purpose |
|------|---------|
| `frontend/src/modules/views/ActivityView.tsx` | Chronological activity feed |
| `frontend/src/modules/views/TeamView.tsx` | Team member grid with stats |
| `frontend/src/modules/views/EmbedView.tsx` | External URL iframe embed |
| `frontend/src/modules/views/FormView.tsx` | Form builder + task submissions |

## Files Modified (3)

| File | Change |
|------|--------|
| `backend/src/modules/views/task-query.service.ts` | getActivityFeed() method |
| `backend/src/modules/views/views.routes.ts` | Activity endpoint |
| `frontend/src/modules/spaces/spaces-page.tsx` | Renders all 4 views by viewType |

## Activity View
- Chronological feed with avatar + action text + timestamp
- Filter by type (All, Status Changes, Comments, Assignments, Created)
- Date range filter (Today, This Week, This Month)
- Cursor-based "Load More" pagination
- Clickable task titles

## Team View
- Responsive grid of member cards (1-4 columns)
- Avatar, name, active tasks, completed this week
- Colored status breakdown bar
- Click to expand mini task list
- Sort by name/task count/activity
- Unassigned card

## Embed View
- URL input with validation
- Full-size responsive iframe with sandbox
- Loading spinner, embed hints (Google Docs, Figma, etc.)
- Change URL button, open-in-new-tab link

## Form View
- Build Form / Submissions tabs
- Field toggles: Title, Description, Priority, Due Date, Assignee + custom fields
- Live form preview with submission → creates task in list
- Submissions list with click-to-open
- Share URL placeholder

## Build
- Backend: 0 errors
- Frontend: 0 errors in new files
