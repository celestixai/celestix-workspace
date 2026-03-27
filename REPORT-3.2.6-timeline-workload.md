# REPORT 3.2.6: Timeline & Workload Views

**Task:** Create Timeline and Workload Views
**Status:** COMPLETE
**Date:** 2026-03-26

---

## Backend Changes

- `task-query.service.ts` — Added `getWorkloadData()`: weekly aggregation of tasks/estimates per assignee
- `views.routes.ts` — Added `GET /views/workload?workspaceId=&startDate=&endDate=`

## Files Created (2)

| File | Purpose |
|------|---------|
| `frontend/src/modules/views/TimelineView.tsx` | Horizontal timeline grouped by assignee |
| `frontend/src/modules/views/WorkloadView.tsx` | Capacity planning grid per team member |

## Files Modified (3)

| File | Change |
|------|--------|
| `backend/src/modules/views/task-query.service.ts` | getWorkloadData() method |
| `backend/src/modules/views/views.routes.ts` | Workload endpoint |
| `frontend/src/modules/spaces/spaces-page.tsx` | Renders Timeline/Workload views |

## Timeline View Features (10)

1. Rows grouped by assignee (avatar + name)
2. Period selector: 1W / 2W / 1M / 3M
3. Task bars colored by priority with titles
4. Overlap detection (red/orange highlight)
5. Today indicator (blue line)
6. Drag to move (reschedule) or between rows (reassign)
7. Unassigned row
8. Prev/Next/Today navigation
9. Zoom controls
10. Weekend shading

## Workload View Features (10)

1. Grid: rows = members, columns = weekly periods
2. Capacity bars: green (<70%), yellow (70-100%), red (>100%)
3. Task count + hours labels per cell
4. Member avatars + names
5. Period selector: Weekly / Daily
6. Configurable capacity (default 40h/week)
7. Click cell → expand to see tasks
8. Summary row with team totals
9. Measure by: Time estimates / Task count
10. Prev/Next/Today navigation

## Build
- Backend: 0 errors
- Frontend: 0 errors in new files
