# REPORT 5.1.1: Posts, FollowUps & Chat Enhancements

**Task:** Enhance Chat with Posts, FollowUps, Chat-to-Task
**Status:** COMPLETE
**Date:** 2026-03-26

---

## Schema Changes

- **FollowUpStatus enum**: PENDING, IN_PROGRESS, DONE
- **Post model** (posts): title, rich content, pin, cover image
- **PostComment model** (post_comments): threaded replies
- **FollowUp model** (follow_ups): message assignment with status/due date
- **WsMessage**: added isFollowUp field

## Backend Files Created (3)

| File | Purpose |
|------|---------|
| `backend/src/modules/posts/posts.validation.ts` | Zod schemas |
| `backend/src/modules/posts/posts.service.ts` | Posts, comments, follow-ups, chat-to-task |
| `backend/src/modules/posts/posts.routes.ts` | 12 endpoints |

## Endpoints (12)

### Posts (7)
POST/GET /channels/:channelId/posts, GET/PATCH/DELETE /posts/:postId, POST /posts/:postId/comments, POST /posts/:postId/pin

### FollowUps (4)
POST /messages/:messageId/follow-up, GET /:wsId/follow-ups, PATCH/DELETE /follow-ups/:id

### Chat-to-Task (1)
POST /messages/:messageId/create-task

## Frontend Files Created (4)

| File | Purpose |
|------|---------|
| `frontend/src/hooks/usePosts.ts` | 12 TanStack Query hooks |
| `frontend/src/modules/workspace/PostComposer.tsx` | Rich text editor with title + formatting |
| `frontend/src/modules/workspace/PostView.tsx` | Post display with threaded comments |
| `frontend/src/modules/workspace/FollowUpsList.tsx` | Grouped by status with quick actions |

## Build
- Backend: 0 errors
- Frontend: 0 errors in new files
