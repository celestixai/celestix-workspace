# REPORT 5.2.1: Advanced Docs — Wikis, Sub-pages, Publishing, Comments, Templates

**Task:** Enhance Documents Module
**Status:** COMPLETE
**Date:** 2026-03-26

---

## Schema Changes

- **Document model**: +9 fields (isWiki, parentDocId, slug, isPublished, publishedUrl, coverImageUrl, icon, spaceId, depth) + self-relation for sub-pages
- **DocCommentEnhanced model** (new): anchored comments with highlightedText, positionJson, resolve, threaded replies
- **DocTemplate model** (new): reusable doc templates with category

## Backend Files Created (3)

| File | Purpose |
|------|---------|
| `backend/src/modules/docs-enhanced/docs-enhanced.validation.ts` | Zod schemas |
| `backend/src/modules/docs-enhanced/docs-enhanced.service.ts` | 18 methods |
| `backend/src/modules/docs-enhanced/docs-enhanced.routes.ts` | 18 endpoints |

## Endpoints (18)

| Category | Endpoints |
|----------|-----------|
| Hub | GET /hub (filter: all/wikis/myDocs/shared/recent/favorites) |
| Wiki | PATCH /:docId/wiki |
| Sub-pages | POST/GET /:docId/sub-pages |
| Publishing | POST /:docId/publish, POST /:docId/unpublish, GET /public/:slug (no auth) |
| Task linking | POST /:docId/link-task, GET /task/:taskId |
| Comments | GET/POST /:docId/comments, PATCH/DELETE/POST resolve /comments/:id |
| Templates | GET/POST /templates, POST /:docId/from-template, POST /:docId/save-as-template |

## Frontend Files Created (4)

| File | Purpose |
|------|---------|
| `frontend/src/hooks/useDocs.ts` | 16 hooks |
| `frontend/src/modules/docs/DocsHubPage.tsx` | Hub with sidebar filters, wiki badges, template picker |
| `frontend/src/modules/docs/DocCommentsPanel.tsx` | Anchored comments with resolve/reply |
| `frontend/src/modules/docs/DocSubPageTree.tsx` | Nested sub-page tree sidebar |

## Build
- Backend: 0 errors
- Frontend: 0 errors in new files
