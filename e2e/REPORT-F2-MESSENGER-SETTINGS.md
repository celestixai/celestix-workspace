# REPORT — Phase F2: Messenger, Settings, Contacts, Real-Time

**Date:** 2026-03-28
**Status:** Complete
**Build:** Successful (frontend `tsc && vite build` passed)

---

## F2.1: Messenger Overhaul

**Status:** Already 90% implemented from prior work. Completed remaining items.

| Requirement | Status | Notes |
|-------------|--------|-------|
| Chat list shows person name, avatar, last message, timestamp | Already done | `chat-list.tsx` transforms DM names correctly |
| Unread count badge | Already done | Blue dot indicator on chat items |
| Online indicator on avatar | Already done | Green dot via presence store |
| "+" button to create new chat | Already done | Opens CreateChatModal with DM/Group/Channel wizard |
| DM vs Group distinction | Already done | Auto-detects DIRECT type, shows other person's name |
| Duplicate DM prevention | Already done | Checks existing chats before creating |
| Sender name above bubbles | Already done | Shows in groups, hidden in DMs |
| Telegram-style message bubbles | Already done | Blue (#2563EB) for own, dark (#111113) for others |
| Message timestamps | Already done | 11px below each bubble |
| Input spacing from attachment | Already done | Attach button inside input box with proper padding |
| Chat header with name + status | Already done | Shows online/away/DND, typing indicator |
| Phone call button | **Added** | Shows "Coming soon" toast |
| More options (...) dropdown | **Added** | Pinned messages, Mute/Unmute, Delete chat |
| Profile panel on avatar click | Already done | Right-side 320px slide-in panel |
| Channel settings panel | Already done | Group/Channel info with members, add/remove, invite link, leave |

**Files modified:**
- `frontend/src/modules/messenger/chat-header.tsx` — Added Phone button, More (...) dropdown with menu
- `frontend/src/modules/messenger/chat-view.tsx` — Added `onPhoneCall` and `onDeleteChat` props

---

## F2.2: Socket.IO Real-Time Messaging

**Status:** Already fully implemented.

The real-time messaging system was complete:
- Frontend connects via singleton socket (`lib/socket.ts`) with JWT auth
- Chat rooms: `messenger:join` / `messenger:leave` on chat open/close
- Real-time events: `messenger:message`, `messenger:message-updated`, `messenger:message-deleted`
- Typing indicators: `messenger:typing` with presence store
- Read receipts: `messenger:read-receipt` with both socket and HTTP fallback
- Messages appear instantly without page reload via React Query cache updates
- Chat list updates via `messenger:chat-updated` and `messenger:unread-updated` events

No changes needed.

---

## F2.3: Password Change Validation

**Status:** Fixed.

**Problem:** Frontend showed generic "Failed to change password" on error.
**Root cause:** Backend was correct (validates current password with `bcrypt.compare`, returns 400 with "Current password is incorrect"). Frontend `onError` handler discarded the server message.
**Fix:** Updated error handler to extract `err.response.data.error` or `err.response.data.message` and display it in the toast.

**File modified:** `frontend/src/modules/settings/settings-page.tsx` (line ~269)

---

## F2.4: Settings Toggles Save

**Status:** Fixed.

| Toggle Category | Before | After |
|----------------|--------|-------|
| Appearance (theme, accent, font, compact) | Saved to API | No change needed |
| Privacy (online status, read receipts, last seen) | Saved to API | No change needed |
| Notifications (messages, emails, tasks, sound, desktop) | localStorage only | Now saves to both localStorage AND `PATCH /auth/profile` (notificationPrefs JSON) |

**Changes:**
- `backend/prisma/schema.prisma` — Added `notificationPrefs Json?` column to User model
- `backend/src/modules/auth/auth.service.ts` — Added `notificationPrefs` to getProfile and updateProfile select
- SQL migration applied: `ALTER TABLE users ADD COLUMN notification_prefs JSONB`
- `frontend/src/modules/settings/settings-page.tsx` — NotificationsSection now saves to server via `PATCH /auth/profile` and loads from server prefs on init

---

## F2.5: 2FA Toggle

**Status:** Fixed.

**Problem:** Frontend called non-existent `/auth/2fa/enable` endpoint directly, skipping the setup/verify flow.
**Fix:** Replaced inline button with `TwoFactorCard` component implementing proper flow:

1. **Enable flow:** POST `/auth/2fa/setup` → display QR code → user enters 6-digit TOTP → POST `/auth/2fa/verify` → 2FA enabled
2. **Disable flow:** User enters 6-digit TOTP → POST `/auth/2fa/disable` → 2FA disabled
3. QR code rendered via external QR service from `otpauth_url`
4. Manual secret display for apps that don't support QR scanning
5. Input restricted to 6 digits only

**File modified:** `frontend/src/modules/settings/settings-page.tsx` — New `TwoFactorCard` component

---

## F2.6: Active Sessions

**Status:** Fixed.

**Problems:**
1. Sessions had null `deviceInfo` and `ipAddress` (not captured at login)
2. No "Current session" indicator (backend didn't mark it)

**Fixes:**
- `backend/src/modules/auth/auth.routes.ts` — Login route now captures `user-agent` and `x-forwarded-for` IP, passes as meta to `generateTokens`
- `backend/src/modules/auth/auth.service.ts`:
  - `login()` accepts optional `meta` parameter and passes to `generateTokens`
  - `getSessions()` accepts current token, compares to mark `isCurrent: true`
- Sessions route passes current auth token to `getSessions` for current-session detection

---

## F2.7: Contacts Bugs

**Status:** Fixed.

### Bug: "All Contact 0" when group has contacts
**Cause:** Sidebar showed `contacts.length` which was the filtered result (only current group's contacts).
**Fix:** Added separate `totalContacts` query fetching unfiltered count. "All Contacts" now shows total regardless of current filter.

### Bug: "Add Contact" in groups doesn't work
**Cause:** No add-to-group UI existed.
**Fix:**
- Added `addToGroup` mutation calling `POST /contacts/:contactId/groups/:groupId`
- Added `AddToGroupModal` component: searchable list of contacts not already in the group
- Sidebar button changes from "New Contact" to "Add to Group" when viewing a group

### Bug: Duplicate "New Contact" button
**Fix:** Button now contextually shows either "New Contact" (no group selected) or "Add to Group" (group selected).

**File modified:** `frontend/src/modules/contacts/contacts-page.tsx`

---

## F2.8: Profile Popup Design

**Status:** Fixed.

Updated `ProfileModal.tsx` to Celestix design system:

| Element | Before | After |
|---------|--------|-------|
| Background | `bg-bg-secondary` | `#161618` (cx-raised) |
| Border | `border-border-primary` | `1px rgba(255,255,255,0.12)` |
| Border radius | `rounded-xl` | `rounded-2xl` (16px) |
| Avatar | 64px, blue bg | 64px, ring border, blue/15 bg |
| Name | `text-lg text-text-primary` | `18px/600 rgba(255,255,255,0.95)` |
| Email/username | `text-sm text-text-secondary` | `13px rgba(255,255,255,0.40)` |
| Bio | Not shown | Now displayed (14px, cx-text-2) |
| Stats cards | `bg-bg-primary rounded-lg` | `#111113 rounded-xl` with border |
| Buttons | Blue + ghost | Message (primary blue), View Profile (secondary) |
| Backdrop | `bg-black/50` | `bg-black/60 backdrop-blur-sm` |

**File modified:** `frontend/src/modules/profiles/ProfileModal.tsx`

---

## F2.9: Build & Test

**Build:** `tsc && vite build` — passed in 8.94s, no type errors.

### Manual Test Checklist

- [ ] Send DM → message appears instantly without reload
- [ ] Send in workspace channel → message appears instantly
- [ ] DM shows as 1-on-1 (not group)
- [ ] Sender names visible in group messages
- [ ] Change password with wrong current → "Current password is incorrect" error shown
- [ ] Toggle notification settings → persists on page reload
- [ ] Enable 2FA → QR code shown → verify with authenticator app
- [ ] Active sessions show device info and "Current" badge
- [ ] Contacts: "All Contacts" shows correct total count
- [ ] Contacts: Add contact to group via "Add to Group" button
- [ ] Contacts: "New Contact" button hidden when viewing a group
- [ ] Profile popup uses dark Celestix design (rounded-2xl, #161618 bg)

---

## Files Modified Summary

### Frontend
| File | Changes |
|------|---------|
| `modules/messenger/chat-header.tsx` | Phone icon, More (...) dropdown |
| `modules/messenger/chat-view.tsx` | Pass new header props |
| `modules/settings/settings-page.tsx` | Password error msg, notification server sync, 2FA proper flow |
| `modules/contacts/contacts-page.tsx` | Total count fix, add-to-group, contextual button |
| `modules/profiles/ProfileModal.tsx` | Celestix design overhaul |

### Backend
| File | Changes |
|------|---------|
| `prisma/schema.prisma` | Added `notificationPrefs` JSON column |
| `modules/auth/auth.service.ts` | Login meta, session current marker, notificationPrefs in selects |
| `modules/auth/auth.routes.ts` | Login captures UA/IP, sessions passes current token |

### Database
| Migration | Description |
|-----------|-------------|
| `ALTER TABLE users ADD COLUMN notification_prefs JSONB` | Notification preferences storage |
