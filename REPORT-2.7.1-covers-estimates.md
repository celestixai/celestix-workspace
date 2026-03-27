# REPORT 2.7.1: Cover Images & Time Estimates

**Task:** Implement Cover Images & Enhanced Time Estimates
**Status:** COMPLETE
**Date:** 2026-03-26

---

## Schema Changes

### Task Model — Added Fields
- `coverImageUrl` — stored image URL
- `coverImageColor` — solid hex color alternative
- `timeEstimate` — total estimated minutes

### Model Added
- **TaskTimeEstimate** (task_time_estimates): per-user estimates, unique on [taskId, userId]

## Backend Changes

### 7 New Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /:taskId/cover-image | Upload cover image (multipart) |
| DELETE | /:taskId/cover-image | Remove cover image |
| PATCH | /:taskId/cover-color | Set solid color cover |
| PUT | /:taskId/time-estimate | Set total estimate |
| PUT | /:taskId/time-estimate/:userId | Set per-user estimate |
| DELETE | /:taskId/time-estimate/:userId | Remove per-user estimate |
| GET | /:taskId/time-summary | Full time summary |

### Time Summary Response
```json
{
  "estimated": { "total": 480, "perUser": [{ "userId", "displayName", "minutes" }] },
  "tracked": { "total": 320, "perUser": [{ "userId", "displayName", "minutes" }] },
  "remaining": 160,
  "percentComplete": 66.7
}
```

## Frontend Files Created (3)

| File | Purpose |
|------|---------|
| `frontend/src/hooks/useTimeEstimate.ts` | TanStack Query hooks |
| `frontend/src/modules/tasks/TaskCoverImage.tsx` | Cover display + upload/color picker/remove |
| `frontend/src/modules/tasks/TaskTimeEstimate.tsx` | Progress bar, h/m inputs, per-user breakdown |

## Frontend Modified (1)

| File | Change |
|------|--------|
| `frontend/src/modules/spaces/ListViewPage.tsx` | Time estimate indicator column |

## Build
- Backend: 0 errors
- Frontend: new files clean
