# REPORT 5.1.2: SyncUps (Video/Audio in Chat)

**Task:** Implement SyncUps — Spontaneous Calls in Channels
**Status:** COMPLETE
**Date:** 2026-03-26

---

## Schema Changes

- **SyncUpStatus enum**: ACTIVE, ENDED
- **SyncUp model** (sync_ups): channel-scoped, one active per channel
- **SyncUpParticipant model** (sync_up_participants): join/leave tracking, media toggles

## Backend Files Created (3)

| File | Purpose |
|------|---------|
| `backend/src/modules/syncups/syncups.validation.ts` | Zod schemas |
| `backend/src/modules/syncups/syncups.service.ts` | 11 methods (start/join/leave/end/recording/media) |
| `backend/src/modules/syncups/syncups.routes.ts` | 11 endpoints |

## Endpoints (11)

| Method | Path | Description |
|--------|------|-------------|
| POST | /start | Start SyncUp |
| POST | /:syncUpId/join | Join |
| POST | /:syncUpId/leave | Leave (auto-ends if last) |
| POST | /:syncUpId/end | End |
| GET | /:syncUpId | Get details |
| GET | /:syncUpId/participants | List participants |
| GET | /active | Check for active SyncUp |
| POST | /:syncUpId/recording/start | Start recording |
| POST | /:syncUpId/recording/stop | Stop recording |
| POST | /:syncUpId/audio | Toggle audio |
| POST | /:syncUpId/video | Toggle video |

## Frontend Files Created (4)

| File | Purpose |
|------|---------|
| `frontend/src/hooks/useSyncUps.ts` | Hooks with polling (10s/5s) |
| `frontend/src/modules/workspace/SyncUpIndicator.tsx` | Green dot + participant count + Join |
| `frontend/src/modules/workspace/SyncUpBar.tsx` | Bottom bar: avatars, timer, mic/camera/leave |
| `frontend/src/modules/workspace/StartSyncUpButton.tsx` | Headphones button for channel header |

## Build
- Backend: 0 errors
- Frontend: 0 errors in new files
