# Celestix - Complete Project Documentation

## Overview

**Celestix** is an ecosystem of products built around a unified workspace and AI-powered federal contract intelligence platform. The project consists of three major components:

1. **Celestix Workspace** — A full-stack, enterprise-grade unified workspace (Slack + Google Workspace + Notion combined) with desktop app
2. **Celestix AI (FCIS)** — A Federal Contract Intelligence System marketing site & dashboard preview for an AI-powered government contract analysis platform
3. **Celestix Download Page** — Static distribution page for the Workspace desktop app

---

## 1. Celestix Workspace

**Location:** `C:/Users/emlok/celestix-workspace/`
**Live Backend:** `https://celestix-backend-053h.onrender.com`

### Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | Express.js (TypeScript 5.6), Node 20 |
| **Frontend** | React 18.3 + Vite 5.4 (TypeScript) |
| **Desktop** | Electron 40.8 + electron-builder 26.8 |
| **Database** | PostgreSQL 16 (Prisma 5.20 ORM) |
| **Cache/RT** | Redis 7 + Socket.io 4.8 |
| **Auth** | JWT + Passport (JWT + Local) + 2FA (Speakeasy TOTP) |
| **Styling** | Tailwind CSS 3.4 + Radix UI primitives |
| **State** | Zustand 4.5 |
| **Data Fetching** | TanStack React Query 5.56 + Axios |
| **Rich Text** | TipTap 2.7 (Markdown, tables, code blocks) |
| **Video** | SimplePeer 9.11 (WebRTC) |
| **Charts** | Recharts |
| **DnD** | dnd-kit 6.1 |
| **Queue** | BullMQ 5.12 |
| **Logging** | Pino 9.4 |
| **Validation** | Zod 3.23 |
| **File Processing** | Sharp 0.33, Multer 1.4, Mammoth 1.8 |
| **Email Integration** | Nodemailer 6.9 + IMAPFlow |

### Database Schema (70+ Models, 2527 lines)

#### Core Modules

| Module | Models | Description |
|--------|--------|-------------|
| **Users** | User, Session | 40+ fields, profiles, preferences, 2FA, storage quotas, device tracking |
| **Messenger** | Chat, ChatMember, Message, MessageVersion, MessageReaction, MessageReadReceipt, Poll, SavedMessage, ScheduledMessage, ChatFolder | Slack-like DM/group/channel messaging with reactions, read receipts, polls, scheduled messages |
| **Workspace** | Workspace, WsChannel, WsChannelMember, WsMessage, WsMessageReaction, WsMention, WsChannelBookmark, WsCustomEmoji | Team channels (public/private/DM), threads, mentions, custom emoji |
| **Email** | EmailAccount, Email, EmailLabel, EmailSignature, EmailTemplate, EmailQuickStep, EmailRule | Multi-account IMAP/SMTP, labels, templates, auto-filtering rules |
| **Calendar** | Calendar, CalendarShare, CalendarEvent, EventAttendee, EventReminder | Multiple calendars, sharing, recurrence, RSVP |
| **Tasks** | Project, ProjectMember, ProjectLabel, Task, TaskAssignee, TaskLabel, TaskComment, TaskActivity, TaskDependency, TimeEntry, Sprint | Full project management with sprints, time tracking, dependencies |
| **Files** | File, FileVersion, FileShare | Upload, version control, granular sharing (VIEW/EDIT) |
| **Notes** | Note, NoteFolder, NoteTag, NoteComment | Rich text notes with folders, tags, comments |
| **Contacts** | Contact, ContactLabel | CRM-style contact database with segmentation |
| **Meetings** | Meeting, MeetingParticipant | Video meetings with WebRTC, room codes |
| **Documents** | Document, DocumentVersion, DocumentComment, DocumentCollaborator | Google Docs-like collaborative editing |
| **Spreadsheets** | Spreadsheet | Excel-like data management |
| **Presentations** | Presentation | PowerPoint-like slide decks |
| **Forms** | Form, FormResponse | Form builder with responses |
| **Lists** | CxList, ListItem | Custom lists with properties |
| **Bookings** | Booking, Appointment | Scheduling system |
| **Whiteboard** | Whiteboard | Collaborative whiteboarding |
| **Loop** | LoopComponent, LoopPage | Drag-drop page builder |
| **Video** | Video, VideoProject | Video hosting with comments |
| **Workflows** | Workflow, WorkflowRun | Automation engine |
| **PDF** | PDF | PDF annotations |
| **Diagrams** | Diagram | Diagram editor |
| **Analytics** | AnalyticsReport, DataSource | Custom reports & data connections |
| **Todo** | TodoList, TodoItem | Simple todo lists with steps |
| **Sites** | Site, SitePage | Website builder |
| **Social** | NewsPost, NewsComment, Community, SocialPost | Internal news, communities |
| **Design** | Design | Design asset management |
| **Audit** | AuditLog | Compliance & audit trail |
| **Notifications** | Notification | 20+ notification types, multi-channel |

### Backend Architecture

```
backend/src/
├── modules/               # 35+ feature modules, each with:
│   │                      #   routes.ts, controller.ts, service.ts, schema.ts
│   ├── auth/              # JWT, 2FA, password reset, sessions
│   ├── messenger/         # Chat, DMs, polls, saved messages
│   ├── workspace/         # Channels, thread messages, mentions
│   ├── email/             # IMAP/SMTP multi-account integration
│   ├── calendar/          # Events, reminders, sharing, RSVP
│   ├── tasks/             # Projects, tasks, time tracking, sprints
│   ├── files/             # File storage & versioning
│   ├── notes/             # Rich text notes
│   ├── contacts/          # Contact management (CRM)
│   ├── meetings/          # Video meetings (WebRTC signaling)
│   ├── notifications/     # Real-time alerts
│   ├── documents/         # Collaborative docs
│   ├── spreadsheets/      # Sheet management
│   ├── presentations/     # Slide decks
│   ├── pdf/               # PDF annotations
│   ├── diagrams/          # Diagram editor
│   ├── bookings/          # Scheduling system
│   ├── forms/             # Form builder
│   ├── lists/             # Custom lists
│   ├── loop/              # Page builder
│   ├── whiteboard/        # Collaborative whiteboard
│   ├── stream/            # Streaming
│   ├── workflows/         # Automation engine
│   ├── dashboard/         # Dashboard widgets
│   ├── analytics/         # Reports & data sources
│   ├── admin/             # Admin panel APIs
│   ├── search/            # Full-text search
│   ├── todo/              # Todo lists
│   ├── video-editor/      # Video processing
│   ├── designer/          # Design tools
│   ├── sites/             # Website builder
│   └── social/            # Social features
├── socket/                # Real-time event handlers
│   ├── presence.socket.ts       # Online/Away/DND status + heartbeat
│   ├── messenger.socket.ts      # Chat send/edit/delete, reactions, typing
│   ├── workspace.socket.ts      # Channel messages, threads, typing
│   ├── meetings.socket.ts       # WebRTC offer/answer/ICE, screen share
│   └── notifications.socket.ts  # Real-time notification delivery
├── middleware/            # Auth, validation, rate limiting
├── config/                # Database, Redis, environment
└── utils/                 # Logging (Pino), helpers
```

**API:** `/api/v1/` — Rate limited (100/min global, 10/min auth, 5/min upload)

### Frontend Architecture

```
frontend/src/
├── modules/               # 30+ lazy-loaded feature modules
│   ├── auth/              # Login, register, welcome flow
│   ├── messenger/         # Chat UI (conversations, threads, reactions)
│   ├── workspace/         # Workspace channels UI
│   ├── email/             # Full email client UI
│   ├── calendar/          # Calendar with event management
│   ├── tasks/             # Kanban boards, task management
│   ├── files/             # File explorer
│   ├── notes/             # Notes editor (TipTap)
│   ├── contacts/          # Contact list & CRM
│   ├── meetings/          # Video call UI
│   ├── settings/          # User preferences
│   ├── dashboard/         # Customizable dashboard
│   ├── documents/         # Doc editor UI
│   ├── spreadsheets/      # Sheet editor UI
│   ├── presentations/     # Slide editor UI
│   ├── pdf/               # PDF viewer
│   ├── diagrams/          # Diagram editor
│   ├── analytics/         # Analytics dashboards
│   ├── forms/             # Form builder UI
│   ├── lists/             # Lists UI
│   ├── bookings/          # Booking system UI
│   ├── todo/              # Todo list UI
│   ├── video-editor/      # Video editor UI
│   ├── designer/          # Design tools
│   ├── sites/             # Website builder
│   ├── social/            # Social features
│   ├── loop/              # Page builder
│   ├── whiteboard/        # Whiteboard UI
│   ├── stream/            # Streaming UI
│   └── workflows/         # Workflow builder UI
├── components/
│   ├── layout/            # NavRail, TopBar, Titlebar, SearchPalette
│   ├── shared/            # Reusable UI components
│   └── ui/                # Radix UI + custom primitives
├── stores/                # Zustand state management
│   ├── auth.store.ts      # User auth state
│   ├── ui.store.ts        # Active module, sidebar state
│   ├── notification.store.ts
│   └── presence.store.ts  # Online status tracking
├── lib/
│   ├── api.ts             # Axios instance
│   └── socket.ts          # Socket.io client
├── hooks/                 # Custom React hooks
└── styles/                # Tailwind global styles
```

**Key UI Features:**
- Dark theme by default with accent color customization
- NavRail sidebar with module icons + user menu
- Global Cmd+K search palette
- Responsive design (desktop NavRail + mobile bottom nav)
- Electron titlebar with window controls
- 30+ lazy-loaded modules with Suspense fallback

### Real-Time System (Socket.io)

| Category | Events |
|----------|--------|
| **Presence** | Online status, heartbeat, last seen tracking |
| **Messenger** | Message send/edit/delete, reactions, read receipts, typing indicators |
| **Workspace** | Channel messages, thread replies, reactions, typing |
| **Meetings** | WebRTC offer/answer/ICE candidates, screen share, in-meeting chat |
| **Notifications** | New notifications, mark read, bulk operations |

**Room Structure:** `user:{id}`, `chat:{id}`, `channel:{id}`, `meeting:{code}`

### Deployment

**Docker Compose (5 services):**
- PostgreSQL 16 (alpine)
- Redis 7 (alpine)
- Backend (Node 20, multi-stage build)
- Frontend (Node 20 build → Nginx serve)
- Nginx reverse proxy (port 80/443)

**Production:** Render.yaml configured (backend web service + free-tier PostgreSQL)

**Desktop Distribution (Electron):**
- Windows 10/11 (64-bit): NSIS installer (~103 MB)
- macOS 11+: DMG (Apple Silicon & Intel)
- Linux: AppImage (64-bit, glibc 2.28+)
- Auto-updater via electron-updater
- Download page at `workspace.celestix.ai`

---

## 3. Celestix Download Page

**Location:** `C:/Users/emlok/celestix-download-page/`

Static HTML page for distributing the Celestix Workspace desktop app. Offers download links for Windows, macOS (Apple Silicon & Intel), and Linux installers. Hosted at `workspace.celestix.ai`.

---

## Project Infrastructure

### Supabase Instances

| Instance | URL | Purpose |
|----------|-----|---------|
| **Cloud (Celestix AI)** | `https://ffduexzfemkqftrxeoey.supabase.co` | Blog posts, images |
| **Local (dev)** | `http://127.0.0.1:54321` | Development fallback |

### Domains

| Domain | Purpose |
|--------|---------|
| `celestix.ai` | AI/FCIS marketing site (Netlify) |
| `workspace.celestix.ai` | Desktop app download page |

### Email Accounts

- `admin@celestix.ai` — Admin account
- `support@celestix.ai` — Support account

### External Services

- **Render** — Backend hosting
- **Netlify** — AI site hosting
- **Supabase** — Database & storage (cloud)
- **Stripe** — Payment processing
- **AWS S3** — File storage
- **11Labs** — Voice AI (API key configured)

---

## What Has Been Built

### Completed

- Full backend with 35+ API modules, all routes, controllers, services
- Prisma schema with 70+ models and 20+ enums
- Full frontend with 30+ lazy-loaded React modules
- Real-time messaging, presence, and notification system (Socket.io)
- WebRTC video meetings with screen share
- Multi-account email integration (IMAP/SMTP)
- Rich text editing (TipTap with markdown, tables, code blocks)
- Electron desktop app with auto-updater
- Docker Compose setup for local development
- Render.yaml for production deployment
- Celestix AI marketing site with 17 pages
- Interactive dashboard previews (Command Center, Full Cycle, Agent Lab)
- Blog system with admin panel (Supabase + fallback)
- 15+ MagicUI animated components
- Download page for desktop app distribution
- Desktop installers for Windows, macOS, Linux

### Original Vision (from spec)

The original product spec outlined an even broader platform including:
- AI Assistant management (create, edit, chat with assistants)
- Integration Manager (Google Drive, Slack, Salesforce)
- Email Campaign system with sequences, scheduling, analytics
- Lead Finder (Apollo.io-style with filters)
- Pre-warmed email accounts marketplace
- Done-for-you Google Workspace email setup
- Email warmup system with health scores
- Inbox management with lead status tracking (Won, Lost, Wrong Person, etc.)
- Campaign analytics (Open rate, Click rate, Conversions)

---

## Repository Locations

```
C:/Users/emlok/celestix-workspace/          # Main full-stack workspace app
C:/Users/emlok/.local/bin/celestix-ai/      # AI/FCIS Next.js marketing site
C:/Users/emlok/celestix-download-page/      # Static download page
C:/Users/emlok/OneDrive/Desktop/Celestix UI/ # UI design screenshots
```
