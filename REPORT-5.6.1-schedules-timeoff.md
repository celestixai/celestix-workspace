# REPORT 5.6.1: Work Schedules & Time Off

**Task:** Implement Work Schedules & Personal Time Off
**Status:** COMPLETE
**Date:** 2026-03-26

---

## Schema Changes

### Enums
- **TimeOffType**: VACATION, SICK, PERSONAL, HOLIDAY, OTHER
- **TimeOffStatus**: PENDING, APPROVED, REJECTED

### Models (3)
- **WorkSchedule**: name, workDays (JSON), hoursPerDay, start/end time, timezone
- **UserWorkSchedule**: user-schedule assignment with effective dates
- **TimeOff**: type, date range, half-day, approval status

## Backend Files Created (3)

| File | Purpose |
|------|---------|
| `backend/src/modules/schedules/schedules.validation.ts` | Zod schemas |
| `backend/src/modules/schedules/schedules.service.ts` | 14 methods |
| `backend/src/modules/schedules/schedules.routes.ts` | 11 endpoints |

## Endpoints (11)

| Category | Endpoints |
|----------|-----------|
| Schedules | GET/POST /workspace/:wsId, PATCH/DELETE /:id, POST /assign, GET /user/:userId |
| Time Off | POST /time-off, GET /time-off, PATCH /time-off/:id, DELETE /time-off/:id |
| Availability | GET /team-availability |

## Key Service Methods
- `isWorkingDay(userId, date)` — checks user's schedule
- `getWorkingHours(userId, date)` — returns hours for the day
- `getTeamAvailability(workspaceId, date)` — who's available today
- `approveTimeOff / rejectTimeOff` — admin approval flow

## Frontend Files Created (4)

| File | Purpose |
|------|---------|
| `frontend/src/hooks/useSchedules.ts` | All hooks |
| `frontend/src/modules/schedules/SchedulesPage.tsx` | Two-tab: Schedules + Time Off |
| `frontend/src/modules/schedules/TimeOffCalendar.tsx` | Month grid with colored blocks |
| `frontend/src/modules/schedules/RequestTimeOffModal.tsx` | Request form modal |

## Build
- Backend: 0 errors
- Frontend: 0 errors in new files
