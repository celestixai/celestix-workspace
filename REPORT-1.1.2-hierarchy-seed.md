# REPORT 1.1.2: Hierarchy Seed Data

**Task:** Seed Default Hierarchy Data
**Status:** COMPLETE
**Date:** 2026-03-26

---

## What Was Done

Updated `backend/prisma/seed.ts` to create default hierarchy data for the "Celestix HQ" workspace.

## Seed Data Created

### Spaces (3)
| Space | Color | Icon | Created By |
|-------|-------|------|------------|
| Engineering | #4A90D9 | code | Alice |
| Design | #E91E63 | palette | Carol |
| Marketing | #4CAF50 | megaphone | Emma |

### Statuses per Space (5 each, 15 total)
| Status | Color | Group |
|--------|-------|-------|
| To Do | #87909E | NOT_STARTED (default) |
| In Progress | #4A90D9 | ACTIVE |
| In Review | #FFA500 | ACTIVE |
| Complete | #6BC950 | DONE |
| Closed | #808080 | CLOSED |

### Space Members (11 total)
| Space | Members |
|-------|---------|
| Engineering | Alice (admin), Bob, Carol, David, Frank, Iris |
| Design | Carol (admin), Grace, Alice |
| Marketing | Emma (admin), Henry |

### Folders (3)
| Folder | Space | Created By |
|--------|-------|------------|
| Backend | Engineering | Alice |
| Frontend | Engineering | Bob |
| UI Kit | Design | Carol |

### Task Lists (8)
| List | Location | Created By |
|------|----------|------------|
| API Development | Engineering / Backend | Alice |
| Bug Fixes | Engineering / Backend | Bob |
| Components | Engineering / Frontend | Iris |
| Pages | Engineering / Frontend | Bob |
| DevOps | Engineering (direct) | David |
| Design System | Design / UI Kit | Carol |
| Campaigns | Marketing (direct) | Emma |
| Content | Marketing (direct) | Henry |

### Hierarchy Tasks (13)
Tasks distributed across all 8 lists with various statuses and priorities.

### Checklists (3)
| Checklist | Task | Items | Completed |
|-----------|------|-------|-----------|
| Endpoint Checklist | Design REST endpoints for Spaces API | 4 | 3 |
| Investigation Steps | Fix race condition in message delivery | 3 | 1 |
| Color System | Define color tokens | 4 | 2 |

## Verification

- Database reset + seed: SUCCESS
- All 3 spaces created with correct colors/icons
- All 15 statuses (5 per space) with correct groups
- All 11 space members with correct roles
- All 3 folders in correct spaces
- All 8 task lists in correct folders/spaces
- All 13 hierarchy tasks with listId set
- All 3 checklists with items and completion states
- Backend build: 0 errors
- Server health check: OK

## Files Changed
- `backend/prisma/seed.ts` — added hierarchy section (~150 lines)

## Notes
- Seed is not idempotent (fails on re-run due to unique constraints on User.email). Use `npx prisma db push --force-reset && npx prisma db seed` for clean re-seed.
- Existing seed data (users, messenger, workspace, email, calendar, tasks, files, notes, contacts) preserved intact.
