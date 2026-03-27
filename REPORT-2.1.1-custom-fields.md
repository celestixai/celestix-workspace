# REPORT 2.1.1: Custom Fields Schema & Service

**Task:** Custom Fields Engine (20 types) — Schema, Service, Routes
**Status:** COMPLETE
**Date:** 2026-03-26

---

## Schema Changes

### Enums Added
| Enum | Values |
|------|--------|
| CustomFieldType | TEXT, LONG_TEXT, NUMBER, MONEY, DROPDOWN, MULTI_SELECT, LABEL, DATE, CHECKBOX, EMAIL, PHONE, URL, RATING, PROGRESS, FILE, RELATIONSHIP, FORMULA, ROLLUP, LOCATION, VOTING, PEOPLE (21 types) |
| HierarchyLevel | WORKSPACE, SPACE, FOLDER, LIST |

### Models Added
| Model | Table | Purpose |
|-------|-------|---------|
| CustomFieldDefinition | custom_field_definitions | Workspace-scoped field type definitions |
| CustomFieldLocation | custom_field_locations | Pins fields to hierarchy locations |
| CustomFieldValue | custom_field_values | Polymorphic value storage per task |

### Relations Added
- Workspace → customFieldDefinitions
- User → customFieldsCreated
- Task → customFieldValues

## Files Created (3)

| File | Purpose |
|------|---------|
| `backend/src/modules/custom-fields/custom-fields.validation.ts` | 6 Zod schemas |
| `backend/src/modules/custom-fields/custom-fields.service.ts` | 13 service methods |
| `backend/src/modules/custom-fields/custom-fields.routes.ts` | 12 endpoints |

## Endpoints (12)

### Field Definitions
| # | Method | Path | Status |
|---|--------|------|--------|
| 1 | POST | /workspace/:workspaceId | WORKING |
| 2 | GET | /workspace/:workspaceId | WORKING |
| 3 | GET | /:fieldId | WORKING |
| 4 | PATCH | /:fieldId | WORKING |
| 5 | DELETE | /:fieldId | WORKING |

### Field Locations
| # | Method | Path | Status |
|---|--------|------|--------|
| 6 | POST | /:fieldId/locations | WORKING |
| 7 | DELETE | /:fieldId/locations/:locationRecordId | WORKING |
| 8 | GET | /location/:locationType/:locationId | WORKING |

### Field Values
| # | Method | Path | Status |
|---|--------|------|--------|
| 9 | GET | /task/:taskId | WORKING |
| 10 | PUT | /task/:taskId/:fieldId | WORKING |
| 11 | DELETE | /task/:taskId/:fieldId | WORKING |
| 12 | PUT | /task/:taskId/bulk | WORKING |

### Filtering
| # | Method | Path | Status |
|---|--------|------|--------|
| 13 | GET | /tasks/filter | WORKING |

## Value Storage Strategy

| Field Types | Storage Column |
|-------------|---------------|
| TEXT, LONG_TEXT, EMAIL, PHONE, URL | valueText |
| NUMBER, MONEY, RATING, PROGRESS | valueNumber |
| DATE | valueDate |
| CHECKBOX | valueBoolean |
| DROPDOWN, MULTI_SELECT, LABEL, PEOPLE, FILE, LOCATION, VOTING, RELATIONSHIP | valueJson |
| FORMULA, ROLLUP | Calculated, stored in valueNumber or valueText |

## Validation Per Type
- NUMBER: validates range from config (min/max)
- MONEY: validates as number with precision
- EMAIL: validates email format
- URL: validates URL format
- DROPDOWN/MULTI_SELECT: validates option IDs exist in config
- RATING: validates 0 to max from config
- PROGRESS: validates min to max from config

## Filter Operators
eq, neq, gt, lt, gte, lte, contains, in, empty, not_empty

## Test Results

| Test | Result |
|------|--------|
| Create TEXT field | 201 — created |
| Create NUMBER field | 201 — created |
| Create DROPDOWN field (with options) | 201 — config stored |
| Add field to location | 201 — location record created |
| Set text value | 200 — valueText populated |
| Set number value | 200 — valueNumber populated |
| Set dropdown value | 200 — valueJson populated |
| Get task values | 200 — 3 values with field definitions |
| Filter by text eq | 200 — 1 match |
| Filter by number gte | 200 — 1 match |

## Build
- `pnpm run build` — 0 TypeScript errors
