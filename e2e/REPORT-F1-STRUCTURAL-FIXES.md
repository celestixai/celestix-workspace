# Phase F1 Report — Structural Fixes

**Date:** 2026-03-28
**Build Status:** Clean (0 errors, 9.78s)
**Deployed:** Live on https://workspace.celestix.ai

---

## Summary

Removed 11 unused modules from navigation, centered all modals, fixed dead buttons, fixed Automations/Forms/Documents errors, and added proper UI frames to 4 tool pages.

---

## F1.1 — Removed 11 Modules from Navigation

Removed from NavRail "More Apps" grid AND BottomTabBar mobile drawer:

| Module | Route |
|--------|-------|
| Lists | /lists |
| Bookings | /bookings |
| Whiteboard | /whiteboard |
| Sites | /sites |
| Sprints | /sprints |
| Time Reports | /time-reports |
| Stream | /stream |
| Designer | /designer |
| Clips | /clips |
| Loop | /loop |
| Planner | /planner |

**Routes still work** (direct URL access preserved), just removed from navigation menus.

**"More Apps" grid now contains 18 items:** Email, Contacts, Forms, Spreadsheets, Presentations, PDF, Diagrams, Workflows, Video Editor, Analytics, Todo, Social, Automations, Integrations, Settings, Meetings, Notes, Files

---

## F1.2 — Centered All Modals

- Desktop modal: replaced `fixed top-1/2 left-1/2 -translate` with `fixed inset-0 flex items-center justify-center`
- Click-outside-to-close via overlay onClick + panel stopPropagation
- Mobile bottom sheet behavior unchanged
- Framer-motion animations preserved
- All modals now perfectly centered

---

## F1.3 — Fixed Dead Buttons

| Button | Page | Fix |
|--------|------|-----|
| AI Brain | NavRail | Added onClick → opens search/command palette |
| Import/Export | Contacts | Added "Coming soon" toast on click |
| Dashboard quick actions | Dashboard | Already wired (verified working) |
| Create Goal | Goals | Already wired (verified working) |
| Create Team | People | Already wired (verified working) |
| Search | TopBar | Already wired (verified working) |

---

## F1.5 — Fixed Automations Workspace ID

- Replaced hardcoded `DEFAULT_WORKSPACE_ID = 'default'` with actual workspace from API
- Added `useQuery` to fetch workspaces, uses first workspace ID
- Fixed all 3 references in AutomationsPage

---

## F1.6 — Fixed Forms Create Error

- Publish toggle was sending `{ status: 'PUBLISHED' }` but backend expects `{ isPublished: boolean }`
- Fixed `onTogglePublish` handler

---

## F1.7 — Fixed Documents Empty Doc Error

- `countWords()` now handles null/undefined
- Documents normalized with safe defaults on load
- `dangerouslySetInnerHTML` uses fallback empty string
- Version restore uses safe content

---

## F1.4 — UI Frames for Tool Pages

### PDF Tools
- Toolbar: h-12, bg `#111113`, "Upload PDF" button
- Left sidebar: w-48, bg `#0C0C0E`, tool buttons (Merge, Split, Rotate, etc.)
- White paper preview area when PDF loaded
- Empty state when no PDF

### Spreadsheets
- Toolbar: h-10, bg `#111113`, format buttons
- Formula bar: h-8, bg `#0C0C0E`, cell reference + input
- Sheet tabs: h-8 at bottom, bg `#0C0C0E`

### Notes
- Editor wrapped in `max-w-2xl mx-auto` card
- Card: `bg-[#111113]`, rounded-[12px], padding 32px, min-h 600px
- Title: `text-2xl font-display`, no border
- Divider between title and content

### Presentations
- Left panel: w-48 slide thumbnails
- Center: 16:9 white canvas preview
- Toolbar with font-display title

---

## Files Modified

| File | Changes |
|------|---------|
| `nav-rail.tsx` | Removed 11 modules from More grid, AI Brain onClick |
| `BottomTabBar.tsx` | Removed 11 modules from More drawer |
| `modal.tsx` | Flexbox centering for desktop modals |
| `dashboard-page.tsx` | Verified buttons working |
| `contacts-page.tsx` | Import/Export toast handlers |
| `AutomationsPage.tsx` | Real workspace ID from API |
| `forms-page.tsx` | Fixed publish toggle field name |
| `documents-page.tsx` | Null safety for empty documents |
| `pdf-page.tsx` | Full tool frame with sidebar + paper preview |
| `spreadsheets-page.tsx` | Formula bar + sheet tabs + toolbar |
| `notes-page.tsx` | Paper card container for editor |
| `presentations-page.tsx` | Slide thumbnails + canvas preview |

---

*Generated 2026-03-28*
