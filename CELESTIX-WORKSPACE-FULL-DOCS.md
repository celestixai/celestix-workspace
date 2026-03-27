# Celestix Workspace - Complete Documentation

> Full-stack enterprise collaboration platform with 30+ modules, real-time messaging, Electron desktop app, and CI/CD pipeline.

**Repository:** `C:/Users/emlok/celestix-workspace/`
**GitHub:** `celestixai/celestix-workspace`
**Live Backend:** https://celestix-backend-053h.onrender.com
**Local Dev:** http://localhost:5173 (frontend) | http://localhost:3001 (backend)

---

## Table of Contents

1. [Tech Stack](#1-tech-stack)
2. [Project Structure](#2-project-structure)
3. [Backend Architecture](#3-backend-architecture)
4. [Authentication Module](#4-authentication-module)
5. [Messenger Module](#5-messenger-module)
6. [Workspace Module](#6-workspace-module)
7. [Email Module](#7-email-module)
8. [Calendar Module](#8-calendar-module)
9. [Tasks Module](#9-tasks-module)
10. [Files Module](#10-files-module)
11. [Notes Module](#11-notes-module)
12. [Contacts Module](#12-contacts-module)
13. [Meetings Module](#13-meetings-module)
14. [Notifications Module](#14-notifications-module)
15. [Dashboard & Admin](#15-dashboard--admin)
16. [Search Module](#16-search-module)
17. [Documents, Spreadsheets & Presentations](#17-documents-spreadsheets--presentations)
18. [Additional Modules (18 more)](#18-additional-modules)
19. [Frontend Architecture](#19-frontend-architecture)
20. [State Management (Zustand)](#20-state-management-zustand)
21. [Frontend Components](#21-frontend-components)
22. [Real-Time / Socket.IO](#22-real-time--socketio)
23. [Electron Desktop App](#23-electron-desktop-app)
24. [Database Schema (Prisma)](#24-database-schema-prisma)
25. [Middleware & Security](#25-middleware--security)
26. [Docker & Infrastructure](#26-docker--infrastructure)
27. [CI/CD Pipelines](#27-cicd-pipelines)
28. [E2E Tests (Playwright)](#28-e2e-tests-playwright)
29. [Audit & Dev Scripts](#29-audit--dev-scripts)
30. [Environment Variables](#30-environment-variables)
31. [Seed Data & Demo Accounts](#31-seed-data--demo-accounts)
32. [Git History & Development Timeline](#32-git-history--development-timeline)
33. [API Conventions](#33-api-conventions)

---

## 1. Tech Stack

### Backend
| Technology | Version | Purpose |
|-----------|---------|---------|
| Node.js | 20+ | Runtime |
| Express.js | 4.21 | HTTP framework |
| TypeScript | 5.6 | Language |
| PostgreSQL | 16 | Primary database |
| Prisma | 5.20 | ORM (70+ models) |
| Redis | 7 | Cache, sessions, queues |
| Socket.IO | 4.8 | Real-time communication |
| BullMQ | 5.12 | Background job queue |
| Passport | 0.7 | Authentication (JWT + Local + 2FA) |
| Zod | 3.23 | Schema validation |
| Pino | 9.4 | Structured logging |
| Sharp | 0.33 | Image processing |
| Nodemailer | 6.9 | Email sending (SMTP) |
| IMAPFlow | 1.0 | Email syncing (IMAP) |
| Multer | 1.4 | File upload handling |

### Frontend
| Technology | Version | Purpose |
|-----------|---------|---------|
| React | 18.3 | UI framework |
| Vite | 5.4 | Build tool & dev server |
| TypeScript | 5.6 | Language |
| Electron | 40.8 | Desktop app shell |
| Zustand | 4.5 | Global state management |
| TanStack Query | 5.56 | Server state / data fetching |
| Radix UI | Various | Accessible UI primitives |
| TipTap | 2.7 | Rich text editor |
| Tailwind CSS | 3.4 | Styling |
| Socket.IO Client | 4.8 | Real-time client |
| Lucide React | 0.441 | Icons |
| dnd-kit | 6.1 | Drag & drop (Kanban, sorting) |
| React Hook Form | 7.53 | Form handling |
| Recharts | 2.12 | Charts & data viz |
| SimplePeer | 9.11 | WebRTC peer connections |
| emoji-mart | 5.6 | Emoji picker |

---

## 2. Project Structure

```
celestix-workspace/
├── backend/
│   ├── src/
│   │   ├── index.ts                 # Express server setup
│   │   ├── config/                  # Environment config
│   │   ├── middleware/              # Auth, error, rate-limit, cache
│   │   ├── modules/                 # 30+ feature modules
│   │   │   ├── auth/
│   │   │   ├── messenger/
│   │   │   ├── workspace/
│   │   │   ├── email/
│   │   │   ├── calendar/
│   │   │   ├── tasks/
│   │   │   ├── files/
│   │   │   ├── notes/
│   │   │   ├── contacts/
│   │   │   ├── meetings/
│   │   │   ├── notifications/
│   │   │   ├── dashboard/
│   │   │   ├── admin/
│   │   │   ├── search/
│   │   │   ├── documents/
│   │   │   ├── spreadsheets/
│   │   │   ├── presentations/
│   │   │   ├── forms/
│   │   │   ├── lists/
│   │   │   ├── bookings/
│   │   │   ├── whiteboard/
│   │   │   ├── stream/
│   │   │   ├── workflows/
│   │   │   ├── pdf/
│   │   │   ├── diagrams/
│   │   │   ├── designer/
│   │   │   ├── sites/
│   │   │   ├── social/
│   │   │   ├── analytics/
│   │   │   ├── todo/
│   │   │   ├── video-editor/
│   │   │   └── loop/
│   │   ├── socket/                  # Socket.IO event handlers
│   │   │   ├── presence.socket.ts
│   │   │   ├── messenger.socket.ts
│   │   │   ├── workspace.socket.ts
│   │   │   ├── meetings.socket.ts
│   │   │   └── notifications.socket.ts
│   │   ├── utils/
│   │   └── __tests__/
│   ├── prisma/
│   │   ├── schema.prisma            # 70+ models, 2500+ lines
│   │   ├── seed.ts                  # Demo data seeder
│   │   ├── init.sql                 # DB initialization
│   │   └── migrations/
│   ├── storage/                     # File uploads (avatars, attachments)
│   ├── Dockerfile
│   ├── start.sh                     # Docker startup with DB retry
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── App.tsx                  # Routing, layout, socket init
│   │   ├── main.tsx                 # React root, QueryClient, Router
│   │   ├── stores/                  # Zustand stores (4)
│   │   ├── lib/                     # API client, socket, utils
│   │   ├── components/
│   │   │   ├── layout/              # NavRail, TopBar, Titlebar, Search
│   │   │   ├── ui/                  # Button, Input, Modal, Skeleton, Toast
│   │   │   └── shared/              # Avatar, Badge, EmptyState
│   │   ├── modules/                 # 30 lazy-loaded feature modules
│   │   ├── hooks/
│   │   └── types/
│   ├── electron/
│   │   ├── main.cjs                 # Electron main process
│   │   └── preload.cjs              # IPC bridge
│   ├── public/                      # PWA manifest, favicon
│   ├── Dockerfile
│   ├── electron-builder.yml
│   ├── vite.config.ts
│   └── package.json
├── shared/
│   └── types.ts                     # Shared TS types (97 lines)
├── e2e/                             # Playwright E2E tests
├── scripts/                         # Audit & dev scripts
├── nginx/
│   └── nginx.conf                   # Reverse proxy config
├── .github/workflows/               # CI/CD pipelines
├── docker-compose.yml               # 5-service orchestration
├── CELESTIX-PROJECT.md              # Project documentation
└── package.json                     # Monorepo root
```

---

## 3. Backend Architecture

### Server Setup (`src/index.ts`)

- **Framework:** Express.js with `express-async-errors`
- **CORS:** Dynamic origin whitelist from `CORS_ORIGINS` env var
- **Body Parsing:** JSON (10MB limit)
- **Security:** Helmet headers, cookie-parser
- **Compression:** gzip response compression
- **Static Files:** `/storage` serves uploaded files
- **Health Check:** `GET /api/health` returns `{ status: "ok", timestamp }`
- **Socket.IO:** Attached to HTTP server, JWT auth middleware, ping 25s/timeout 30s

### API Route Prefix

All API routes are under `/api/v1/`:
```
/api/v1/auth/*
/api/v1/messenger/*
/api/v1/workspace/*
/api/v1/email/*
/api/v1/calendar/*
/api/v1/tasks/*
/api/v1/files/*
/api/v1/notes/*
/api/v1/contacts/*
/api/v1/meetings/*
/api/v1/notifications/*
/api/v1/dashboard/*
/api/v1/admin/*
/api/v1/search/*
/api/v1/documents/*
/api/v1/spreadsheets/*
/api/v1/presentations/*
/api/v1/forms/*
/api/v1/lists/*
/api/v1/bookings/*
/api/v1/whiteboard/*
/api/v1/stream/*
/api/v1/workflows/*
/api/v1/pdf/*
/api/v1/diagrams/*
/api/v1/designer/*
/api/v1/sites/*
/api/v1/social/*
/api/v1/analytics/*
/api/v1/todo/*
/api/v1/video-editor/*
/api/v1/loop/*
```

---

## 4. Authentication Module

**Route prefix:** `/api/v1/auth`

### Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/register` | No | Register new user account |
| POST | `/login` | No | Login (email + password), supports 2FA & rememberMe |
| POST | `/refresh` | No | Refresh access token using refresh token |
| POST | `/logout` | Yes | Logout, invalidate session |
| GET | `/me` | Yes | Get current user profile |
| PATCH | `/profile` | Yes | Update profile (name, bio, theme, timezone, etc.) |
| POST | `/avatar` | Yes | Upload avatar image |
| POST | `/change-password` | Yes | Change password (requires current) |
| POST | `/forgot-password` | No | Request password reset email |
| POST | `/reset-password` | No | Reset password with token |
| POST | `/2fa/setup` | Yes | Generate 2FA TOTP secret & QR code |
| POST | `/2fa/verify` | Yes | Verify 2FA code and enable |
| POST | `/2fa/disable` | Yes | Disable 2FA (requires current code) |
| GET | `/sessions` | Yes | List active sessions |
| DELETE | `/sessions/:sessionId` | Yes | Revoke specific session |
| GET | `/users?search=` | Yes | Search users by name/email |

### Auth Flow
1. User registers or logs in -> receives `accessToken` + `refreshToken`
2. Access token in `Authorization: Bearer <token>` header
3. Token also set as httpOnly cookie
4. 401 response triggers client-side refresh flow
5. Failed refresh -> logout and redirect to `/login`

### Password Rules
- Minimum 8 characters
- At least 1 uppercase, 1 lowercase, 1 number
- Hashed with bcrypt (12 rounds)

### 2FA (TOTP)
- Uses `speakeasy` library
- Setup generates secret + QR code
- Verify requires valid 6-digit TOTP code
- Once enabled, login requires 2FA code

---

## 5. Messenger Module

**Route prefix:** `/api/v1/messenger`

### Chat Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/chats` | List user's chats (DM, Group, Channel) |
| POST | `/chats` | Create new chat |
| GET | `/chats/:chatId` | Get chat details |
| PATCH | `/chats/:chatId` | Update chat (name, avatar) |
| GET | `/chats/:chatId/messages` | Get messages (cursor pagination + search) |
| POST | `/chats/:chatId/messages` | Send message (text, attachments, replies) |
| PATCH | `/messages/:messageId` | Edit message (stores version history) |
| DELETE | `/messages/:messageId` | Delete message (self or for all) |
| POST | `/messages/:messageId/reactions` | Toggle emoji reaction |
| POST | `/messages/:messageId/pin` | Pin/unpin message |
| GET | `/chats/:chatId/pinned` | Get pinned messages |
| POST | `/chats/:chatId/read` | Mark as read |

### Chat Members
| Method | Path | Description |
|--------|------|-------------|
| POST | `/chats/:chatId/members` | Add members |
| DELETE | `/chats/:chatId/members/:userId` | Remove member |
| POST | `/chats/:chatId/leave` | Leave chat |
| POST | `/chats/:chatId/invite-link` | Generate invite link |
| POST | `/join/:inviteLink` | Join via invite link |

### Polls
| Method | Path | Description |
|--------|------|-------------|
| POST | `/polls` | Create poll (options, quiz mode, anonymous) |
| POST | `/polls/:pollId/vote` | Vote on option |
| GET | `/polls/:pollId` | Get poll + vote counts |
| POST | `/polls/:pollId/close` | Close poll (creator only) |

### Saved & Scheduled Messages
| Method | Path | Description |
|--------|------|-------------|
| GET | `/saved` | List saved messages |
| POST | `/saved` | Save message with optional note |
| DELETE | `/saved/:id` | Remove saved message |
| GET | `/scheduled` | List scheduled messages |
| POST | `/scheduled` | Schedule message for future delivery |
| DELETE | `/scheduled/:id` | Cancel scheduled message |

### Chat Folders
| Method | Path | Description |
|--------|------|-------------|
| GET | `/folders` | List chat folders |
| POST | `/folders` | Create folder |
| PATCH | `/folders/:id` | Update folder |
| DELETE | `/folders/:id` | Delete folder |

### Chat Types
- **DIRECT** - One-to-one messaging
- **GROUP** - Multi-participant with any member adding others
- **CHANNEL** - Broadcast-style with role-based permissions

---

## 6. Workspace Module

**Route prefix:** `/api/v1/workspace`

### Workspace CRUD
| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | List user's workspaces |
| POST | `/` | Create workspace |
| GET | `/:workspaceId` | Get workspace details |
| PATCH | `/:workspaceId` | Update workspace |
| DELETE | `/:workspaceId` | Delete workspace |

### Invites
| Method | Path | Description |
|--------|------|-------------|
| POST | `/:workspaceId/regenerate-invite` | New invite code |
| POST | `/join/:inviteCode` | Join via code |
| GET | `/join/:token` | Validate invite token |
| POST | `/join-token/:token` | Join via token |
| POST | `/:workspaceId/invites` | Create invite (expiry, max uses) |
| GET | `/:workspaceId/invites` | List active invites |
| DELETE | `/:workspaceId/invites/:inviteId` | Revoke invite |

### Members
| Method | Path | Description |
|--------|------|-------------|
| POST | `/:workspaceId/members` | Invite users (with role) |
| PATCH | `/:workspaceId/members/:userId` | Change role |
| DELETE | `/:workspaceId/members/:userId` | Remove member |
| POST | `/:workspaceId/leave` | Leave workspace |

### Channels
| Method | Path | Description |
|--------|------|-------------|
| GET | `/:workspaceId/channels` | List channels |
| POST | `/:workspaceId/channels` | Create channel |
| POST | `/:workspaceId/dm` | Create DM |
| GET | `/channels/:channelId` | Get channel details |
| PATCH | `/channels/:channelId` | Update channel |
| POST | `/channels/:channelId/archive` | Archive/unarchive |
| DELETE | `/channels/:channelId` | Delete channel |
| POST | `/channels/:channelId/join` | Join public channel |
| POST | `/channels/:channelId/leave` | Leave channel |

### Channel Members
| Method | Path | Description |
|--------|------|-------------|
| POST | `/channels/:channelId/members` | Add members |
| DELETE | `/channels/:channelId/members/:userId` | Remove member |
| PATCH | `/channels/:channelId/members/:userId/role` | Change role |
| PATCH | `/channels/:channelId/prefs` | Notification prefs (all/mentions/none) |

### Channel Messages & Threads
| Method | Path | Description |
|--------|------|-------------|
| GET | `/channels/:channelId/messages` | Get messages (cursor pagination) |
| POST | `/channels/:channelId/messages` | Send message |
| PATCH | `/messages/:messageId` | Edit message |
| DELETE | `/messages/:messageId` | Delete message |
| GET | `/messages/:messageId/thread` | Get thread replies |
| POST | `/messages/:messageId/reactions` | Toggle reaction |

### Bookmarks & Pins
| Method | Path | Description |
|--------|------|-------------|
| GET | `/channels/:channelId/bookmarks` | List bookmarks |
| POST | `/channels/:channelId/bookmarks` | Add bookmark (title + URL) |
| DELETE | `/bookmarks/:bookmarkId` | Remove bookmark |
| POST | `/messages/:messageId/bookmark` | Toggle message bookmark |
| POST | `/messages/:messageId/pin` | Pin message |
| GET | `/channels/:channelId/pins` | Get pinned messages |
| GET | `/:workspaceId/saved` | Get saved messages |

### Read/Unread & Search
| Method | Path | Description |
|--------|------|-------------|
| POST | `/channels/:channelId/read` | Mark as read |
| GET | `/:workspaceId/unread` | Unread counts per channel |
| GET | `/:workspaceId/search` | Search messages |
| GET | `/:workspaceId/mentions` | Get user's mentions |

### Custom Emoji & Slash Commands
| Method | Path | Description |
|--------|------|-------------|
| GET | `/:workspaceId/emoji` | List custom emoji |
| POST | `/:workspaceId/emoji` | Add custom emoji |
| DELETE | `/emoji/:emojiId` | Remove emoji |
| POST | `/:workspaceId/command` | Handle slash commands |

### Huddles (Voice/Video in Channels)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/channels/:channelId/huddle/start` | Start huddle |
| POST | `/channels/:channelId/huddle/join` | Join huddle |
| POST | `/channels/:channelId/huddle/leave` | Leave huddle |
| GET | `/channels/:channelId/huddle` | Get huddle info |

### Canvas (Collaborative Docs)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/channels/:channelId/canvas` | Create canvas |
| GET | `/channels/:channelId/canvas` | List canvases |
| GET | `/canvas/:canvasId` | Get canvas content |
| PATCH | `/canvas/:canvasId` | Update canvas |
| DELETE | `/canvas/:canvasId` | Delete canvas |

### Channel Analytics & Automations
| Method | Path | Description |
|--------|------|-------------|
| GET | `/channels/:channelId/analytics?days=30` | Channel stats |
| POST | `/:workspaceId/automations` | Create automation rule |
| GET | `/:workspaceId/automations` | List automations |
| PATCH | `/automations/:automationId` | Update automation |
| DELETE | `/automations/:automationId` | Delete automation |

---

## 7. Email Module

**Route prefix:** `/api/v1/email`

### Core Email Operations
| Method | Path | Description |
|--------|------|-------------|
| GET | `/emails` | List emails (filter by folder, pagination) |
| GET | `/emails/search` | Search emails |
| GET | `/emails/:emailId` | Get email (auto-marks read) |
| POST | `/emails/send` | Compose and send |
| POST | `/emails/reply` | Reply to email |
| POST | `/emails/forward` | Forward email |
| PATCH | `/emails/:emailId/read` | Toggle read |
| PATCH | `/emails/:emailId/star` | Toggle star |
| PATCH | `/emails/:emailId/move/:folder` | Move to folder |
| POST | `/emails/:emailId/archive` | Archive |
| POST | `/emails/:emailId/trash` | Trash |
| DELETE | `/emails/:emailId` | Permanent delete (trash only) |

### Snooze & Schedule
| Method | Path | Description |
|--------|------|-------------|
| POST | `/emails/:emailId/snooze` | Snooze until time |
| POST | `/emails/:emailId/unsnooze` | Bring back snoozed |
| POST | `/emails/:emailId/cancel-schedule` | Cancel scheduled send |

### Threads
| Method | Path | Description |
|--------|------|-------------|
| GET | `/threads` | Threaded view for folder |
| GET | `/threads/:threadId` | All emails in thread |

### Drafts
| Method | Path | Description |
|--------|------|-------------|
| POST | `/drafts` | Save draft |
| PATCH | `/drafts/:draftId` | Auto-save draft |
| POST | `/drafts/:draftId/send` | Send draft |

### Labels
| Method | Path | Description |
|--------|------|-------------|
| GET | `/labels` | List labels |
| POST | `/labels` | Create label |
| PATCH | `/labels/:labelId` | Update label |
| DELETE | `/labels/:labelId` | Delete label |
| POST | `/labels/assign` | Assign to emails |
| POST | `/labels/remove` | Remove from emails |

### Signatures
| Method | Path | Description |
|--------|------|-------------|
| GET | `/signatures` | List signatures |
| POST | `/signatures` | Create signature |
| PATCH | `/signatures/:signatureId` | Update |
| DELETE | `/signatures/:signatureId` | Delete |
| POST | `/signatures/:signatureId/default` | Set default |

### Email Accounts (IMAP/SMTP)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/accounts` | List accounts |
| POST | `/accounts` | Add account (SMTP/IMAP config) |
| PATCH | `/accounts/:accountId` | Update |
| DELETE | `/accounts/:accountId` | Delete |
| POST | `/accounts/test` | Test SMTP connection |

### Bulk Operations
| Method | Path | Description |
|--------|------|-------------|
| POST | `/bulk/archive` | Bulk archive |
| POST | `/bulk/delete` | Bulk trash |
| POST | `/bulk/permanent-delete` | Bulk permanent delete |
| POST | `/bulk/mark-read` | Bulk read/unread |
| POST | `/bulk/label` | Bulk assign label |
| POST | `/bulk/remove-label` | Bulk remove label |
| POST | `/bulk/move` | Bulk move folder |

### Folder Management
| Method | Path | Description |
|--------|------|-------------|
| GET | `/folders/counts` | Unread/total per folder |
| DELETE | `/folders/trash` | Empty trash |
| DELETE | `/folders/spam` | Empty spam |

### Templates, Quick Steps & Rules
| Method | Path | Description |
|--------|------|-------------|
| GET/POST/PATCH/DELETE | `/templates/*` | Email templates CRUD |
| GET/POST/PATCH/DELETE | `/quick-steps/*` | Quick step automations CRUD |
| GET/POST/PATCH/DELETE | `/rules/*` | Email rules (conditions + actions) |

### Focused Inbox
| Method | Path | Description |
|--------|------|-------------|
| GET | `/focused` | Focused emails (from contacts/replied-to senders) |

### Email Folders (Enum)
`INBOX | SENT | DRAFTS | ARCHIVE | TRASH | SPAM`

---

## 8. Calendar Module

**Route prefix:** `/api/v1/calendar`

### Calendars
| Method | Path | Description |
|--------|------|-------------|
| GET | `/calendars` | List calendars |
| POST | `/calendars` | Create calendar |
| GET | `/calendars/:calendarId` | Get details |
| PATCH | `/calendars/:calendarId` | Update |
| DELETE | `/calendars/:calendarId` | Delete |

### Calendar Sharing
| Method | Path | Description |
|--------|------|-------------|
| POST | `/calendars/:calendarId/share` | Share (VIEW or EDIT) |
| PATCH | `/shares/:shareId` | Update permission |
| DELETE | `/shares/:shareId` | Remove share |

### Events
| Method | Path | Description |
|--------|------|-------------|
| GET | `/events?start=&end=` | Query events in date range |
| POST | `/events` | Create event |
| GET | `/events/:eventId` | Get event |
| PATCH | `/events/:eventId` | Update event |
| DELETE | `/events/:eventId` | Delete event |

### Attendees & RSVP
| Method | Path | Description |
|--------|------|-------------|
| POST | `/events/:eventId/attendees` | Add attendee |
| DELETE | `/events/:eventId/attendees/:userId` | Remove attendee |
| POST | `/events/:eventId/rsvp` | RSVP (ACCEPTED/DECLINED/TENTATIVE) |

### Reminders & Conflicts
| Method | Path | Description |
|--------|------|-------------|
| POST | `/events/:eventId/reminders` | Add reminder (minutes before) |
| DELETE | `/reminders/:reminderId` | Delete reminder |
| GET | `/conflicts?start=&end=` | Detect overlapping events |

### Calendar Views
| Method | Path | Description |
|--------|------|-------------|
| GET | `/view/day?date=` | Day view |
| GET | `/view/week?date=` | Week view |
| GET | `/view/month?year=&month=` | Month view |
| GET | `/busy/:userId?start=&end=` | Free/busy slots |

### Resources (Room/Equipment)
| Method | Path | Description |
|--------|------|-------------|
| GET/POST/PATCH/DELETE | `/resources/*` | Resource CRUD |
| GET | `/resources/:id/bookings` | Resource bookings |
| POST | `/resources/:id/bookings` | Book resource |
| POST | `/availability` | Combined availability for multiple users |

### Event Properties
- title, description, start/end, location, color
- allDay flag, recurrenceRule (RRULE format)
- busyStatus: BUSY | FREE | TENTATIVE | OUT_OF_OFFICE
- attachments, reminders, attendees with RSVP

---

## 9. Tasks Module

**Route prefix:** `/api/v1/tasks`

### Projects
| Method | Path | Description |
|--------|------|-------------|
| GET | `/projects` | List projects |
| POST | `/projects` | Create project |
| GET | `/projects/:projectId` | Get project |
| PATCH | `/projects/:projectId` | Update project |
| DELETE | `/projects/:projectId` | Delete project |
| POST | `/projects/:projectId/members` | Add member |
| PATCH | `/projects/:projectId/members/:userId` | Update role |
| DELETE | `/projects/:projectId/members/:userId` | Remove member |

### Task Views
| Method | Path | Description |
|--------|------|-------------|
| GET | `/projects/:projectId/tasks` | List view (filterable) |
| GET | `/projects/:projectId/board` | Kanban board view |
| GET | `/projects/:projectId/list` | Sorted list view |
| POST | `/projects/:projectId/tasks` | Create task |
| POST | `/projects/:projectId/bulk` | Bulk update tasks |

### Task Detail
| Method | Path | Description |
|--------|------|-------------|
| GET | `/:taskId` | Get task with all details |
| PATCH | `/:taskId` | Update task |
| DELETE | `/:taskId` | Delete task |
| PATCH | `/:taskId/position` | Reorder (Kanban drag) |

### Assignees & Labels
| Method | Path | Description |
|--------|------|-------------|
| POST | `/:taskId/assignees` | Assign users |
| DELETE | `/:taskId/assignees/:userId` | Unassign |
| POST | `/:taskId/labels` | Add labels |
| DELETE | `/:taskId/labels/:labelId` | Remove label |

### Comments & Activity
| Method | Path | Description |
|--------|------|-------------|
| GET | `/:taskId/comments` | Get comments |
| POST | `/:taskId/comments` | Add comment |
| PATCH | `/comments/:commentId` | Edit comment |
| DELETE | `/comments/:commentId` | Delete comment |
| GET | `/:taskId/activities` | Activity log |

### Time Tracking
| Method | Path | Description |
|--------|------|-------------|
| POST | `/:taskId/timer/start` | Start timer |
| POST | `/:taskId/timer/stop` | Stop timer |
| GET | `/:taskId/time-entries` | Get time entries |
| POST | `/:taskId/time-entries` | Log time manually |
| DELETE | `/time-entries/:entryId` | Delete entry |

### Dependencies, Sprints, Custom Fields
| Method | Path | Description |
|--------|------|-------------|
| POST | `/:taskId/dependencies` | Add dependency |
| DELETE | `/:taskId/dependencies/:dependsOnId` | Remove dependency |
| GET | `/my-tasks` | Cross-project tasks for current user |
| GET/POST/PATCH/DELETE | `/projects/:projectId/sprints/*` | Sprint management |
| GET/POST/DELETE | `/projects/:projectId/custom-fields/*` | Custom fields |
| GET | `/projects/:projectId/analytics` | Task stats |

### Task Properties
- **Status:** BACKLOG | TODO | IN_PROGRESS | REVIEW | DONE
- **Priority:** URGENT | HIGH | MEDIUM | LOW | NONE
- title, description, dueDate, estimatedHours, position
- assignees, labels, comments, dependencies, time entries, custom fields

---

## 10. Files Module

**Route prefix:** `/api/v1/files`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | List files (filter, pagination) |
| POST | `/folders` | Create folder |
| POST | `/upload` | Upload single file |
| POST | `/upload-multiple` | Upload multiple (up to 20) |
| GET | `/:fileId/download` | Download file |
| GET | `/:fileId` | Get file details |
| PATCH | `/:fileId/rename` | Rename |
| PATCH | `/:fileId/move` | Move to folder |
| POST | `/:fileId/star` | Toggle star |
| DELETE | `/:fileId?permanent=true` | Delete/trash |
| POST | `/:fileId/restore` | Restore from trash |
| POST | `/:fileId/share` | Share (expiry, password, permissions) |
| GET | `/shared/:token` | Access shared file (public) |
| POST | `/:fileId/versions` | Upload new version |
| GET | `/:fileId/versions` | Version history |
| GET | `/breadcrumbs/:folderId` | Folder breadcrumbs |
| POST | `/bulk` | Bulk move/copy/delete |
| GET | `/storage/usage` | Storage usage stats |

### File Limits
- Max file size: 500MB
- Max avatar size: 5MB
- Default storage quota: 5GB per user

---

## 11. Notes Module

**Route prefix:** `/api/v1/notes`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | List notes (filter) |
| POST | `/` | Create note |
| GET | `/templates` | Note templates |
| GET | `/:noteId` | Get note |
| PATCH | `/:noteId` | Update note |
| DELETE | `/:noteId` | Delete note |
| POST | `/:noteId/restore` | Restore deleted |
| GET/POST/PATCH/DELETE | `/folders/*` | Folder management |
| GET/POST/DELETE | `/tags/*` | Tag management |
| POST/DELETE | `/:noteId/tags/:tagId` | Tag assignment |
| GET | `/:noteId/versions/:versionId` | Get version |
| POST | `/:noteId/versions/:versionId/restore` | Restore version |
| POST | `/:noteId/share` | Share note |
| GET | `/shared/:token` | Access shared note |
| GET | `/:noteId/backlinks` | Find referencing notes |

### Note Content
- Rich text via `contentJson` (TipTap format) + plain `contentText`
- Pinned & starred flags
- Collaborative editing ready
- Version history with restore

---

## 12. Contacts Module

**Route prefix:** `/api/v1/contacts`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | List contacts (pagination) |
| POST | `/` | Create contact |
| GET | `/:contactId` | Get contact |
| PATCH | `/:contactId` | Update contact |
| DELETE | `/:contactId` | Delete contact |
| POST | `/sync` | Sync internal users as contacts |
| GET/POST/DELETE | `/groups/*` | Group management |
| GET | `/duplicates` | Find duplicates |
| POST | `/merge` | Merge two contacts |
| GET | `/skills?skill=` | Search by skill |
| GET | `/distribution-lists` | Distribution lists |
| GET | `/suggestions` | Contact suggestions |
| GET | `/org-chart` | Organization chart |

### Contact Properties
- displayName, firstName, lastName
- emails (labeled: work, personal, other)
- phones (labeled), company, jobTitle, department
- isFavorite, isInternalUser
- addresses, websites, notes

---

## 13. Meetings Module

**Route prefix:** `/api/v1/meetings`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | List meetings (filter by status) |
| POST | `/` | Create meeting |
| GET | `/:meetingCode` | Get meeting details |
| PATCH | `/:meetingCode` | Update meeting |
| POST | `/:meetingCode/join` | Join (optional password) |
| POST | `/:meetingCode/leave` | Leave |
| POST | `/:meetingCode/end` | End (host only) |
| GET | `/:meetingCode/participants` | Active participants |
| POST/GET | `/:meetingCode/chat` | Meeting chat |
| POST | `/:meetingCode/recording/start` | Start recording |
| POST | `/:meetingCode/recording/stop` | Stop recording |
| GET | `/:meetingCode/recordings` | Get recordings |
| POST | `/:meetingCode/transcription/start` | Start transcription |
| POST | `/:meetingCode/transcription/stop` | Stop transcription |
| GET | `/:meetingCode/transcript` | Get transcript |
| POST | `/:meetingCode/breakout-rooms` | Create breakout rooms |
| POST | `/:meetingCode/breakout-rooms/:roomId/assign` | Assign participants |
| POST/PATCH | `/:meetingCode/whiteboards/*` | Meeting whiteboards |
| POST | `/:meetingCode/polls` | Meeting polls |
| POST | `/:meetingCode/reactions` | Send reaction |
| PATCH | `/:meetingCode/settings` | Update settings |

### Meeting Properties
- code (unique join link), title, hostId
- startTime, endTime, status (UPCOMING/ACTIVE/ENDED)
- recordingEnabled, transcriptionEnabled, maxParticipants
- optional password, breakout rooms, whiteboards

---

## 14. Notifications Module

**Route prefix:** `/api/v1/notifications`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | List notifications (paginated) |
| GET | `/unread-count` | Get unread count |
| POST | `/:id/read` | Mark as read |
| POST | `/read-all` | Mark all as read |
| DELETE | `/:id` | Delete notification |
| DELETE | `/` | Clear all |

### Notification Types
`MESSAGE | MENTION | EMAIL | TASK_ASSIGNED | MEETING_STARTING | FILE_SHARED | CONTACT_REQUEST | CALENDAR_INVITE | REACTION | THREAD_REPLY | FORM_RESPONSE | BOOKING_CONFIRMED | BOOKING_CANCELLED | WORKFLOW_COMPLETED | LIST_ITEM_ASSIGNED | VIDEO_COMMENT`

---

## 15. Dashboard & Admin

### Dashboard (`/api/v1/dashboard`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Aggregated dashboard data (cached 30s) |
| GET/PUT | `/layout` | Widget layout |
| GET | `/activity` | Cross-module activity feed |
| GET | `/quick-actions` | Available quick actions |
| GET | `/stats` | Cross-module statistics |

### Admin (`/api/v1/admin`) - Requires `isAdmin`
| Method | Path | Description |
|--------|------|-------------|
| GET | `/stats` | System stats (users, messages, storage) |
| GET | `/users` | List all users (pagination) |
| PATCH | `/users/:userId` | Update user (admin, quota) |
| POST | `/users/:userId/disable` | Disable user |
| POST | `/users/:userId/enable` | Enable user |
| GET | `/audit-log` | System audit log |
| GET/PUT | `/settings` | System settings |

---

## 16. Search Module

**Route prefix:** `/api/v1/search`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/?q=&category=&limit=10` | Cross-module search |

Searches across all 30+ modules: messages, emails, files, contacts, tasks, notes, calendar, forms, lists, bookings, videos, whiteboards, workflows, documents, spreadsheets, presentations, diagrams, todo, designs, sites, social posts.

Results include: type, id, title, preview, module, timestamp, link. Cached for 15 seconds.

---

## 17. Documents, Spreadsheets & Presentations

### Documents (`/api/v1/documents`)
- Full CRUD for collaborative documents
- TipTap-based rich text content
- Comments, reactions, version history
- Sharing with users/teams

### Spreadsheets (`/api/v1/spreadsheets`)
- Create, edit, delete spreadsheets
- Real-time cell editing
- Formulas, formatting
- Import/export (CSV, Excel)

### Presentations (`/api/v1/presentations`)
- Slide editor with themes
- Transitions, animations
- Presenter mode
- Publish/share

---

## 18. Additional Modules

| Module | Route Prefix | Key Features |
|--------|-------------|--------------|
| **Forms** | `/api/v1/forms` | Form builder, multiple field types, responses, analytics, conditional logic |
| **Lists** | `/api/v1/lists` | Structured lists, checkboxes, assignments, bulk ops, filtering |
| **Bookings** | `/api/v1/bookings` | Booking pages, time slots, confirmations, reminders |
| **Whiteboard** | `/api/v1/whiteboard` | Real-time collaborative canvas, shapes, text, export |
| **Stream** | `/api/v1/stream` | Video upload/management, comments, reactions, transcoding |
| **Workflows** | `/api/v1/workflows` | Automation triggers + actions, conditions, execution history |
| **PDF** | `/api/v1/pdf` | PDF viewer, annotations (highlight, note, draw), export |
| **Diagrams** | `/api/v1/diagrams` | Flowcharts, UML, shapes, connectors, export PNG/SVG |
| **Analytics** | `/api/v1/analytics` | Report builder, charts (bar, line, pie, KPI), data sources |
| **Todo** | `/api/v1/todo` | Simple todos, My Day, Important, smart lists, recurring |
| **Designer** | `/api/v1/designer` | Design canvas, layers, shapes, effects, asset library |
| **Sites** | `/api/v1/sites` | Website builder, WYSIWYG editor, SEO, public hosting |
| **Social** | `/api/v1/social` | Community feed, posts, comments, reactions, mentions |
| **Video Editor** | `/api/v1/video-editor` | Trim, cut, merge, effects, text overlay, export |
| **Loop** | `/api/v1/loop` | Interactive components, page composition, publishing |

---

## 19. Frontend Architecture

### Entry Points
- `main.tsx` - React root with QueryClient (30s staleTime, 1 retry), BrowserRouter (web) or HashRouter (Electron), PWA service worker registration
- `App.tsx` - Main routing, lazy module loading, socket connection, presence heartbeat

### Routing

```
/welcome          -> WelcomePage (landing, auth redirect)
/login            -> LoginPage
/register         -> RegisterPage
/*                -> AuthenticatedLayout
  /               -> Dashboard
  /messenger      -> Messenger
  /workspace      -> Workspace
  /email          -> Email
  /calendar       -> Calendar
  /tasks          -> Tasks
  /files          -> Files
  /notes          -> Notes
  /contacts       -> Contacts
  /meetings       -> Meetings
  /forms          -> Forms
  /lists          -> Lists
  /bookings       -> Bookings
  /loop           -> Loop
  /whiteboard     -> Whiteboard
  /stream         -> Stream
  /workflows      -> Workflows
  /documents      -> Documents
  /spreadsheets   -> Spreadsheets
  /presentations  -> Presentations
  /pdf            -> PDF
  /diagrams       -> Diagrams
  /analytics      -> Analytics
  /todo           -> Todo
  /video-editor   -> Video Editor
  /designer       -> Designer
  /sites          -> Sites
  /social         -> Social
  /settings       -> Settings
```

All module pages are **lazy-loaded** with `React.lazy()` and `Suspense` fallback.

### AuthenticatedLayout Structure
```
┌─ Titlebar (Electron only) ─────────────────────────────┐
├─ UpdateBanner (if update available) ───────────────────┤
├─────────────────────────────────────────────────────────┤
│ NavRail │ TopBar (search, launcher, theme, notifs)     │
│  72px   │──────────────────────────────────────────────│
│         │                                               │
│  Icons  │  Module Content (lazy-loaded)                 │
│  for    │                                               │
│  30     │                                               │
│  modules│                                               │
│         │                                               │
│ Settings│                                               │
│ Avatar  │                                               │
├─────────┴──────────────────────────────────────────────┤
│ MobileNav (bottom, mobile only)                         │
└─────────────────────────────────────────────────────────┘
```

### Key Frontend Features per Module

| Module | Frontend Highlights |
|--------|-------------------|
| **Dashboard** | Widget grid (events, tasks, emails, notes), quick actions |
| **Messenger** | Real-time chat, typing indicators, emoji reactions, file attachments, message search, read receipts |
| **Workspace** | Slack-style channels, threads, member sidebar, pinned messages |
| **Email** | Folder navigation (inbox/sent/drafts/archive/trash), compose modal, thread view, bulk actions |
| **Calendar** | Day/week/month views, event creation modal, drag-to-create |
| **Tasks** | Kanban board (dnd-kit), list view, task detail panel, time tracking |
| **Files** | Grid/list view, drag-drop upload, folder tree, file preview |
| **Notes** | TipTap rich editor, folder sidebar, tag chips, split view |
| **Contacts** | Contact cards, groups, starred, import/export |
| **Meetings** | Video grid, participant list, chat panel, recording controls |
| **Settings** | Profile, appearance (theme/accent color), notifications, privacy, email accounts |

---

## 20. State Management (Zustand)

### auth.store.ts
```typescript
{
  user: User | null
  token: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  // Methods
  setUser, setTokens, login, logout, updateUser
}
// Persisted to localStorage key "celestix-auth"
```

### ui.store.ts
```typescript
{
  theme: 'dark' | 'light' | 'system'
  sidebarCollapsed: boolean
  searchOpen: boolean
  notificationPanelOpen: boolean
  activeModule: string  // 30 module options
  fileToOpen: { fileId, fileName, mimeType, downloadUrl } | null
  // Methods
  setTheme, toggleSidebar, setSearchOpen, setActiveModule, openFileInModule
}
// Persisted to localStorage key "celestix-ui"
```

### notification.store.ts
```typescript
{
  notifications: Notification[]
  unreadCount: number
  // Methods
  setNotifications, addNotification, markAsRead, markAllAsRead, clearAll
}
// In-memory only (not persisted)
```

### presence.store.ts
```typescript
{
  onlineUsers: Map<userId, status>
  typingUsers: Map<chatId, Set<userId>>
  // Methods
  setUserStatus, setTyping, getUserStatus, getTypingUsers, bulkSetOnline
}
// Socket events: "presence:update", "messenger:typing"
```

---

## 21. Frontend Components

### Layout Components
| Component | Description |
|-----------|-------------|
| `NavRail` | 72px sidebar, 30 module icons, settings + avatar |
| `TopBar` | Module name, Ctrl+K search, app launcher, theme toggle, notification badge |
| `Titlebar` | Electron window controls (min/max/close) |
| `SearchPalette` | Global Cmd+K search overlay, debounced API call, keyboard nav |
| `NotificationPanel` | Real-time notification list with unread badge |
| `MobileNav` | Bottom nav for mobile (5 main modules) |

### UI Components (Radix-based)
| Component | Variants/Features |
|-----------|-------------------|
| `Button` | primary, secondary, ghost, danger, outline / sm, md, lg, icon / loading state |
| `Input` | Label, error, icon support, ARIA attributes |
| `Modal` | sm, md, lg, xl, full / overlay fade animation |
| `Skeleton` | Pulse animation for loading states |
| `Toast` | success, error, info / auto-dismiss or persistent |

### Shared Components
| Component | Features |
|-----------|----------|
| `Avatar` | Image/initials, 5 sizes (xs-xl), online status indicator |
| `Badge` | Colored variants |
| `EmptyState` | Icon + title + description for empty lists |

### Utility Functions (`lib/utils.ts`)
- `cn()` - Classname combiner
- `formatMessageTime()` - "HH:mm" / "Yesterday" / "MMM d"
- `formatFullDate()` - "MMM d, yyyy HH:mm"
- `formatRelativeTime()` - "2 hours ago"
- `formatFileSize()` - "1.2 MB"
- `getInitials()` - "JD" from "John Doe"
- `getAvatarColor()` - Hash-based color from 8 presets
- `truncate()` - String truncation with ellipsis

---

## 22. Real-Time / Socket.IO

### Connection Flow
1. Client connects with JWT token in socket auth
2. Server validates token in Socket.IO middleware
3. User joins personal room `user:${userId}`
4. Redis presence set to ONLINE (5 min expiry)
5. Heartbeat every 30s to maintain presence
6. On disconnect, emit OFFLINE if no other connections

### Event Categories

#### Presence
| Event | Direction | Description |
|-------|-----------|-------------|
| `presence:heartbeat` | Client -> Server | Keep-alive (30s interval) |
| `presence:get-online` | Client -> Server | Get initial online users |
| `presence:update` | Server -> Client | User status changed |
| `presence:bulk` | Server -> Client | Bulk online users list |
| `presence:subscribe` | Client -> Server | Subscribe to updates |

#### Messenger
| Event | Direction | Description |
|-------|-----------|-------------|
| `message:new` | Server -> Client | New message |
| `message:edit` | Server -> Client | Message edited |
| `message:delete` | Server -> Client | Message deleted |
| `typing:start` / `typing:stop` | Bidirectional | Typing indicator |
| `reaction:add` / `reaction:remove` | Server -> Client | Emoji reactions |

#### Workspace
| Event | Direction | Description |
|-------|-----------|-------------|
| `ws:message:new` | Server -> Client | New workspace message |
| `ws:message:edit` / `ws:message:delete` | Server -> Client | Message updates |
| `ws:typing:start` / `ws:typing:stop` | Bidirectional | Typing |
| `ws:reaction:add` / `ws:reaction:remove` | Server -> Client | Reactions |
| `ws:user:joined` / `ws:user:left` | Server -> Client | Channel membership |

#### Meetings
| Event | Direction | Description |
|-------|-----------|-------------|
| `meeting:participant:joined/left` | Server -> Client | Participant changes |
| `meeting:chat` | Bidirectional | Chat messages |
| `meeting:recording:started/stopped/available` | Server -> Client | Recording events |
| WebRTC offer/answer/ICE | Bidirectional | Media signaling |
| Audio/video toggles, hand raise, reactions | Bidirectional | Meeting controls |

#### Notifications
| Event | Direction | Description |
|-------|-----------|-------------|
| `notification:new` | Server -> Client | New notification |
| `notification:read` | Server -> Client | Marked as read |
| `unread:count` | Server -> Client | Count update |

---

## 23. Electron Desktop App

### Main Process (`electron/main.cjs`)
- **Window:** 1440x900, frameless, dark background
- **Dev mode:** Loads `http://localhost:5173`
- **Production:** Loads `dist/index.html`
- **Auto-updater:** Checks every 30 min in packaged builds

### IPC Handlers
| Channel | Description |
|---------|-------------|
| `get-backend-url` | Returns CELESTIX_BACKEND env or fallback |
| `get-app-version` | App version from package.json |
| `is-electron` | Returns true |
| `get-platform` | Returns OS platform |
| `minimize-window` | Minimize |
| `maximize-window` | Toggle maximize |
| `close-window` | Close app |
| `install-update` | Install pending update |

### Preload (`electron/preload.cjs`)
Context-isolated API exposed to renderer:
- `electronAPI.getBackendUrl()`, `getAppVersion()`, `isElectron()`, `getPlatform()`
- Window controls: `minimizeWindow()`, `maximizeWindow()`, `closeWindow()`
- Auto-updater: `installUpdate()`, `onUpdateAvailable()`, `onUpdateDownloaded()`

### Build Targets (electron-builder.yml)
| Platform | Format | Notes |
|----------|--------|-------|
| Windows | NSIS installer (.exe) | Code signing support |
| macOS | DMG + ZIP | Universal binary |
| Linux | AppImage + .deb | All architectures |

---

## 24. Database Schema (Prisma)

### Core Models (70+)

#### User
```
id (UUID), email, passwordHash, displayName, firstName, lastName
avatarUrl, bio, phone, timezone, language
status: ONLINE | AWAY | DND | OFFLINE | INVISIBLE
customStatus, customStatusEmoji, lastSeenAt
isAdmin, is2FAEnabled, totpSecret
theme, accentColor, fontSize, compactMode
showOnlineStatus, showReadReceipts, showLastSeen
storageUsed (BigInt), storageQuota (BigInt, default 5GB)
navOrder (Json), createdAt, updatedAt, deletedAt
```

#### Session
```
id, userId (FK), token (unique), deviceInfo, ipAddress, expiresAt
```

#### Chat
```
id, type: DIRECT | GROUP | CHANNEL
name, description, avatarUrl, inviteLink (unique), isPinned
-> members (ChatMember[]), messages (Message[])
```

#### ChatMember
```
id, chatId (FK), userId (FK)
role: OWNER | ADMIN | MEMBER | GUEST
isMuted, isPinned, lastReadMessageId, joinedAt
Unique: [chatId, userId]
```

#### Message
```
id, chatId (FK), senderId (FK)
content, contentHtml
replyToId (FK), forwardedFromId (FK)
isPinned, isEdited, isDeleted, deletedForAll
attachments (Json), linkPreview (Json), metadata (Json)
-> reactions, versions, readReceipts
```

#### Workspace
```
id, name, slug (unique), description, iconUrl, inviteCode (unique)
-> members, channels, customEmojis, invites
```

#### WsChannel
```
id, workspaceId (FK), name, description, topic
type: PUBLIC | PRIVATE | DM
isArchived, createdById (FK)
Unique: [workspaceId, name]
-> members, messages, bookmarks
```

#### WsMessage
```
id, channelId (FK), senderId (FK), parentMessageId (FK)
content, contentHtml, isEdited, isDeleted
attachments, metadata
-> reactions, mentions, bookmarks
```

#### Email
```
id, userId (FK), accountId (FK)
folder: INBOX | SENT | DRAFTS | ARCHIVE | TRASH | SPAM
fromAddress, fromName, toAddresses (Json), ccAddresses, bccAddresses
subject, bodyText, bodyHtml
isRead, isStarred, isSnoozed, snoozeUntil, labels (Json)
threadId, attachments, metadata
```

#### Calendar + CalendarEvent
```
Calendar: id, userId, name, description, color, isDefault, isHidden, timezone
Event: id, calendarId, title, description, startAt, endAt, location, color
       allDay, recurrenceRule, busyStatus, attachments, metadata
       -> attendees (with RSVP), reminders
```

#### Project + Task
```
Project: id, name, description, color, icon, createdById
         -> members, tasks, labels, sprints
Task: id, projectId, title, description
      status: BACKLOG | TODO | IN_PROGRESS | REVIEW | DONE
      priority: URGENT | HIGH | MEDIUM | LOW | NONE
      dueDate, estimatedHours, position, createdById
      -> assignees, comments, labels, dependencies, timeEntries
```

#### File + FileVersion
```
File: id, userId, parentFolderId, name, type: FILE | FOLDER
      mimeType, sizeBytes (BigInt), storagePath
      isTrashed, isStarred
      -> versions, shares
```

#### Note + NoteFolder + NoteTag
```
Note: id, userId, folderId, title, contentText, contentJson
      isPinned, isStarred
      -> tags, versions, shares
```

#### Contact + ContactGroup
```
Contact: id, userId, displayName, firstName, lastName
         emails (Json), phones (Json), company, jobTitle, department
         isFavorite, isInternalUser, internalUserId
         addresses, websites, notes
```

#### Meeting + MeetingParticipant
```
Meeting: id, code (unique), title, hostId
         startTime, endTime, status: UPCOMING | ACTIVE | ENDED
         recordingEnabled, transcriptionEnabled, maxParticipants, password
```

#### Notification
```
id, userId, senderId, type (NotificationType enum)
title, description, relatedId, isRead, metadata (Json)
```

#### AuditLog
```
id, userId, action (AuditAction enum), targetId, details (Json)
```

---

## 25. Middleware & Security

### Authentication (`middleware/auth.ts`)
- `authenticate` - Validates JWT (header or cookie), attaches user to request
- `requireAdmin` - Checks `user.isAdmin`, returns 403 if not

### Error Handler (`middleware/error-handler.ts`)
- Catches all errors, formats consistent JSON responses
- Handles: AppError, ZodError, Prisma errors (P2002 conflict, P2003 invalid ref, P2025 not found)
- `notFoundHandler` for 404 responses

### Rate Limiting (`middleware/rate-limit.ts`)
| Limiter | Limit | Window |
|---------|-------|--------|
| `globalLimiter` | 10,000 req | 1 min |
| `authLimiter` | 500 req | 1 min |
| `uploadLimiter` | 50 req | 1 min |
| `messageLimiter` | 300 req | 1 min |

All backed by Redis for distributed rate limiting.

### Caching (`middleware/cache.ts`)
- Redis-backed GET response caching
- Key format: `${prefix}:${userId}:${url}`
- Configurable TTL (default 60s)
- Used for: search (15s), dashboard (30s), stats (30s)

### Security Headers (Helmet)
- Content-Security-Policy, X-Frame-Options, X-Content-Type-Options
- Strict-Transport-Security, X-XSS-Protection

---

## 26. Docker & Infrastructure

### docker-compose.yml (5 services)

| Service | Image | Port | Purpose |
|---------|-------|------|---------|
| **postgres** | postgres:16-alpine | 5432 | Primary database |
| **redis** | redis:7-alpine | 6379 | Cache/queue |
| **backend** | Custom (Node.js) | 3001 | API server |
| **frontend** | Custom (Nginx) | 3000 | Static frontend |
| **nginx** | nginx:alpine | 80/443 | Reverse proxy |

### Nginx Configuration
- Gzip compression (level 6)
- Rate limiting: 100 req/min per IP with 20 burst
- Upstream routing: `/api/*` -> backend, `/socket.io/*` -> backend (WebSocket), `/storage/*` -> backend
- Client max body size: 500MB
- Proper proxy headers: X-Real-IP, X-Forwarded-For, X-Forwarded-Proto

### Backend Dockerfile (multi-stage)
1. **Builder:** node:20-alpine, installs openssl (Prisma), `npm ci`, `prisma generate`, `npm run build`
2. **Runtime:** node:20-alpine, copies dist + node_modules, creates storage dirs, runs `start.sh`

### Frontend Dockerfile (multi-stage)
1. **Builder:** node:20-alpine, `npm install`, Vite build
2. **Runtime:** nginx:alpine, serves dist from `/usr/share/nginx/html`

### Backend start.sh
- Resilient startup with DB health retry (exponential backoff)
- Runs `prisma migrate deploy` then `node dist/index.js`

---

## 27. CI/CD Pipelines

### Main Pipeline (`.github/workflows/ci.yml`)
**Triggers:** push (main/develop), PR to main

| Job | Environment | Description |
|-----|-------------|-------------|
| 1. Lint & Type Check | ubuntu-latest | Backend + Frontend ESLint & tsc |
| 2. Backend Tests | ubuntu-latest + PG + Redis | Jest with coverage |
| 3. Frontend Tests | ubuntu-latest | Vitest with coverage |
| 4. Build | ubuntu-latest | TypeScript + Vite build |
| 5. Deploy Backend | Render webhook | Main branch only |
| 6. Deploy AI Site | Netlify CLI | Main branch only |

### Desktop Build Pipeline (`.github/workflows/build-desktop.yml`)
**Triggers:** Push tags `v*`, manual dispatch

3 parallel builds:
- **macOS** -> DMG + ZIP
- **Windows** -> NSIS EXE
- **Linux** -> AppImage

Creates GitHub Release (draft) with all artifacts.

### Security Audit (`.github/workflows/security.yml`)
**Schedule:** Weekly (Monday 9 AM UTC) + PRs to main
- `pnpm audit --audit-level=critical` (backend + frontend)
- Prisma schema validation

---

## 28. E2E Tests (Playwright)

**Config:** `playwright.config.ts`
- Test dir: `./e2e`, pattern: `**/*.e2e.ts`
- Timeout: 30s, expect: 5s
- Retries: 2 in CI, 0 locally
- Browsers: Chromium, Firefox, Mobile Chrome (Pixel 5)
- Base URL: `http://localhost:5173`
- Screenshots/videos on failure

### Current Test: `auth.e2e.ts`
- Login page visibility
- Registration flow
- Login with valid/invalid credentials
- Module navigation after login
- Dynamic test emails per run

---

## 29. Audit & Dev Scripts

| Script | Path | Purpose |
|--------|------|---------|
| `api-audit.mjs` | `scripts/` | Discover & test all API endpoints, timing, JSON report |
| `frontend-audit.mjs` | `scripts/` | Scan modules, validate exports, match to router |
| `socket-audit.mjs` | `scripts/` | Analyze Socket.IO event handlers, trace flow |
| `extract-errors.mjs` | `scripts/` | Parse & categorize error logs |
| `show-summary.mjs` | `scripts/` | Display metrics from audit reports |

```bash
npm run audit:api          # Run API endpoint audit
npm run audit:frontend     # Run frontend module audit
```

---

## 30. Environment Variables

### Backend `.env`

| Category | Variables |
|----------|-----------|
| **App** | `NODE_ENV=development`, `APP_NAME=Celestix Workspace`, `APP_URL`, `API_URL`, `PORT=3001`, `FRONTEND_PORT=3000` |
| **Database** | `DATABASE_URL=postgresql://celestix:celestix_secret@localhost:5433/celestix?schema=public` |
| **Redis** | `REDIS_URL=redis://localhost:6379` |
| **Auth** | `JWT_SECRET`, `JWT_EXPIRES_IN=7d`, `JWT_REFRESH_EXPIRES_IN=30d`, `SESSION_SECRET`, `TOTP_ISSUER=Celestix Workspace` |
| **Storage** | `STORAGE_PATH=./storage`, `MAX_FILE_SIZE=524288000` (500MB), `MAX_AVATAR_SIZE=5242880` (5MB), `USER_STORAGE_QUOTA=5368709120` (5GB) |
| **Email** | `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=587`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM=noreply@celestix.local` |
| **WebRTC** | `STUN_URL=stun:stun.l.google.com:19302`, `TURN_URL`, `TURN_USERNAME`, `TURN_PASSWORD` |
| **Rate Limits** | `RATE_LIMIT_WINDOW_MS=60000`, `RATE_LIMIT_MAX=1000`, `AUTH_RATE_LIMIT_MAX=10`, `UPLOAD_RATE_LIMIT_MAX=5` |
| **CORS** | `CORS_ORIGINS=http://localhost:3000,http://localhost:5173,http://localhost:5174` |
| **Logging** | `LOG_LEVEL=debug` |

### Frontend Environment
| Variable | Description |
|----------|-------------|
| `VITE_BACKEND_URL` | Backend URL (production only, empty for dev proxy) |

---

## 31. Seed Data & Demo Accounts

### Users (10 accounts, all password: `Password123`)

| Email | Name | Role |
|-------|------|------|
| alice@celestix.local | Alice Chen | **Admin** |
| bob@celestix.local | Bob Martinez | Full-stack Developer |
| carol@celestix.local | Carol Williams | Product Designer |
| david@celestix.local | David Kim | DevOps Engineer |
| emma@celestix.local | Emma Johnson | Project Manager |
| frank@celestix.local | Frank Brown | Backend Developer |
| grace@celestix.local | Grace Lee | UX Researcher |
| henry@celestix.local | Henry Davis | Data Scientist |
| iris@celestix.local | Iris Patel | Frontend Developer |
| jack@celestix.local | Jack Wilson | CTO |

### Seeded Content
- **Workspace:** "Celestix HQ" with 6 channels (general, engineering, design, random, announcements, leadership)
- **Chats:** 2 DMs + 1 group chat with sample messages
- **Calendar:** 5 events for Alice (sprint planning, design review, standup, lunch, all-hands)
- **Projects:** "Website Redesign" & "Mobile App v2" with sample tasks
- **Notes:** Sprint planning notes & API design ideas
- **Contacts:** All 10 users + 1 external (Sarah Thompson)
- **Contact Groups:** Team, Clients
- **Files:** Folders (Documents, Images) + sample files (PDF, Excel, Word, PNG)

---

## 32. Git History & Development Timeline

| Commit | Description |
|--------|-------------|
| `bd0ade3` | Revert to flex-col-reverse message layout + fix read receipt index **(latest)** |
| `681c063` | Revert previous message layout fix |
| `6f49daa` | Fix message layout: bottom-to-top rendering |
| `744f09c` | Stack messages like Telegram using flex-col-reverse |
| `9024b4d` | Messenger overhaul: Telegram-style input, profiles, file attachments |
| `19293dd` | Performance audit and final polish (Steps 54-55) |
| `0404f3c` | Cross-module file type integration + diagrams (Step 52) |
| `2b4b1c9` | Add 11 new modules (Documents, Spreadsheets, Presentations, PDF, Diagrams, Analytics, Video Editor, Designer, Sites, Social, To Do) |
| `98dfab9` | Workspace & Meetings + cross-module integration + PWA + mobile responsiveness |
| `827785f` | Add 8 new modules (Dashboard, Forms, Lists, Bookings, Loop, Whiteboard, Stream, Workflows) |
| `87aa889` | Add GitHub Actions for cross-platform desktop builds |
| `6b546b5` | Add OpenSSL to Alpine for Prisma |
| `eb22131` | Add resilient startup script with DB retry logic |

---

## 33. API Conventions

### Response Format
```json
{
  "success": true,
  "data": { },
  "error": "message (if success=false)",
  "code": "ERROR_CODE",
  "pagination": { "hasMore": true, "cursor": "..." }
}
```

### HTTP Status Codes
| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad request (validation) |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not found |
| 409 | Conflict (duplicate) |
| 429 | Rate limited |
| 500 | Internal error |

### Pagination
- **Cursor-based** for messages and large lists
- **Offset-based** for most other lists
- Returns `hasMore` + `cursor`/`page` info

### Authentication
- JWT in `Authorization: Bearer <token>` header
- Also stored in httpOnly cookie
- All timestamps in ISO 8601 format

### Validation
- Zod schemas validate all inputs
- Detailed field-level errors on failure

---

## Summary Stats

| Metric | Count |
|--------|-------|
| Backend Modules | 32 |
| Frontend Modules | 30 |
| API Endpoints | 300+ |
| Database Models (Prisma) | 70+ |
| Prisma Schema Lines | 2,500+ |
| Socket.IO Events | 50+ |
| Zustand Stores | 4 |
| CI/CD Workflows | 3 |
| Docker Services | 5 |
| Demo Users | 10 |
| Dependencies (Backend) | 40+ |
| Dependencies (Frontend) | 50+ |
