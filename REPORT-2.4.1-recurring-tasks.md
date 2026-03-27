# REPORT 2.4.1: Recurring Tasks Engine

**Task:** Implement Recurring Tasks with Scheduler
**Status:** COMPLETE
**Date:** 2026-03-26

---

## Schema Changes

### Enums Added
- **RecurrenceFrequency**: DAILY, WEEKLY, BIWEEKLY, MONTHLY, QUARTERLY, YEARLY, CUSTOM
- **ScheduleStatus**: ACTIVE, PAUSED, COMPLETED

### Models Added
- **RecurringSchedule** (recurring_schedules): frequency, interval, daysOfWeek, dayOfMonth, startDate, endDate, maxOccurrences, occurrenceCount, nextRunAt, createBefore, status, timezone

### Task Model Modified
- Added: isRecurring, recurrenceConfig, recurrenceParentId (self-relation), recurringScheduleId

## Files Created (6)

| File | Purpose |
|------|---------|
| `backend/src/modules/recurring/recurring.validation.ts` | Zod schemas |
| `backend/src/modules/recurring/recurring.service.ts` | Full service (9 methods) |
| `backend/src/modules/recurring/recurring.routes.ts` | 8 endpoints |
| `backend/src/modules/recurring/recurring.scheduler.ts` | Interval-based scheduler (60min) |
| `frontend/src/hooks/useRecurring.ts` | TanStack Query hooks |
| `frontend/src/modules/recurring/RecurrenceModal.tsx` | Full modal with frequency/interval/preview |

## Files Modified (2)

| File | Change |
|------|--------|
| `backend/src/index.ts` | Registered routes, starts scheduler on boot, graceful shutdown |
| `frontend/src/modules/spaces/ListViewPage.tsx` | Repeat icon on recurring tasks |

## Endpoints (8)

| Method | Path | Description |
|--------|------|-------------|
| POST | /tasks/:taskId/recurrence | Make task recurring |
| GET | /tasks/:taskId/recurrence | Get settings + next 5 dates |
| PATCH | /tasks/:taskId/recurrence | Update settings |
| DELETE | /tasks/:taskId/recurrence | Stop recurring |
| POST | /tasks/:taskId/recurrence/pause | Pause |
| POST | /tasks/:taskId/recurrence/resume | Resume |
| GET | /upcoming | List upcoming within N days |
| POST | /process | Manually trigger processing |

## Scheduler Logic

1. Finds active schedules where `nextRunAt <= now`
2. Creates new task instance (copies title, description, priority, list, assignees)
3. Sets recurrenceParentId, new dueDate, first NOT_STARTED status
4. Advances nextRunAt based on frequency/interval
5. Increments occurrenceCount, checks maxOccurrences/endDate
6. Runs every 60 minutes (configurable)

## Test Results

| Test | Result |
|------|--------|
| Create daily recurrence | Schedule created, nextRunAt calculated |
| Get recurrence | Returns schedule + 5 upcoming dates |
| Pause | Status → PAUSED |
| Resume | Status → ACTIVE, nextRunAt recalculated |
| Process (trigger) | New task created, occurrenceCount=1, nextRunAt advanced |

## Build
- Backend: 0 errors
- Frontend: new files clean
