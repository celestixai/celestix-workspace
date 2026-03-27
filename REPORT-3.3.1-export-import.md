# REPORT 3.3.1: View Export & Import

**Task:** Implement Export/Import for Task Data
**Status:** COMPLETE
**Date:** 2026-03-26

---

## Files Created (4)

| File | Purpose |
|------|---------|
| `backend/src/modules/views/export.service.ts` | CSV + JSON export with custom fields |
| `backend/src/modules/views/import.service.ts` | CSV parsing, column mapping, task creation |
| `frontend/src/components/views/ExportButton.tsx` | Download dropdown (CSV/JSON) |
| `frontend/src/components/views/ImportWizard.tsx` | 4-step import modal wizard |

## Files Modified (3)

| File | Change |
|------|--------|
| `backend/src/modules/views/views.routes.ts` | 4 new endpoints (export, template, preview, execute) |
| `frontend/src/components/views/ViewControlsBar.tsx` | Export + Import buttons, ImportWizard modal |
| `frontend/src/modules/spaces/spaces-page.tsx` | Passes location/list props to ViewControlsBar |

## Export Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /views/export?format=csv\|json | Export tasks with current filters |
| GET | /views/import/template | Download sample CSV template |

## Import Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /views/import/preview | Upload CSV, get column mapping preview |
| POST | /views/import/execute | Execute import with mapping |

## Export Features
- **CSV**: Task ID, Title, Status, Priority, Assignees, Dates, Tags, Estimates + custom fields
- **JSON**: Normalized task array
- Respects saved view filters/sorts if viewId provided
- Paginates through all results (200/page)
- Proper CSV escaping

## Import Features
- **CSV parsing**: handles quoted fields, escaped quotes, commas
- **Auto-mapping**: regex-based column name matching
- **Preview**: first 10 rows mapped
- **Execution**: creates tasks with status matching, priority validation, assignee email lookup, tag creation, custom task ID generation
- **Results**: { created, failed, errors[] }
- **Template**: downloadable sample CSV

## Import Wizard (Frontend)
1. Upload — drag-and-drop or file picker
2. Map Columns — auto-suggested, dropdown selectors
3. Preview — table of mapped rows
4. Import — progress + results summary

## Build
- Backend: 0 errors
- Frontend: 0 errors in new files
