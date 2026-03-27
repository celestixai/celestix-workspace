// Shared types between frontend and backend

export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T;
  error?: string;
  pagination?: PaginationInfo;
}

export interface PaginationInfo {
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface CursorPagination {
  cursor?: string;
  limit: number;
  hasMore: boolean;
}

// User types
export interface PublicUser {
  id: string;
  displayName: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
  status: UserStatus;
  customStatus?: string;
  customStatusEmoji?: string;
  lastSeenAt?: string;
}

export type UserStatus = 'ONLINE' | 'AWAY' | 'DND' | 'OFFLINE' | 'INVISIBLE';

export type ChatType = 'DIRECT' | 'GROUP' | 'CHANNEL';

export type MemberRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'GUEST';

export type TaskPriority = 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';

export type TaskStatus = 'BACKLOG' | 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE';

export type EmailFolder = 'INBOX' | 'SENT' | 'DRAFTS' | 'ARCHIVE' | 'TRASH' | 'SPAM';

export type RSVPStatus = 'ACCEPTED' | 'DECLINED' | 'TENTATIVE' | 'NO_RESPONSE';

export type NotificationType =
  | 'MESSAGE'
  | 'MENTION'
  | 'EMAIL'
  | 'TASK_ASSIGNED'
  | 'MEETING_STARTING'
  | 'FILE_SHARED'
  | 'CONTACT_REQUEST'
  | 'CALENDAR_INVITE'
  | 'REACTION'
  | 'THREAD_REPLY';

// Socket events
export interface SocketEvents {
  // Presence
  'presence:update': { userId: string; status: UserStatus };
  'presence:typing': { chatId: string; userId: string; isTyping: boolean };

  // Messenger
  'message:new': { chatId: string; message: unknown };
  'message:edit': { chatId: string; messageId: string; content: string };
  'message:delete': { chatId: string; messageId: string };
  'message:reaction': { chatId: string; messageId: string; emoji: string; userId: string; action: 'add' | 'remove' };
  'message:read': { chatId: string; messageId: string; userId: string };

  // Workspace
  'ws:message:new': { channelId: string; message: unknown };
  'ws:message:edit': { channelId: string; messageId: string; content: string };
  'ws:message:delete': { channelId: string; messageId: string };
  'ws:typing': { channelId: string; userId: string; isTyping: boolean };

  // Notifications
  'notification:new': { notification: unknown };
  'notification:read': { notificationId: string };

  // Meetings
  'meeting:join': { meetingCode: string };
  'meeting:leave': { meetingCode: string };
  'meeting:offer': { to: string; offer: unknown };
  'meeting:answer': { to: string; answer: unknown };
  'meeting:ice-candidate': { to: string; candidate: unknown };
  'meeting:toggle-audio': { userId: string; enabled: boolean };
  'meeting:toggle-video': { userId: string; enabled: boolean };
  'meeting:raise-hand': { userId: string; raised: boolean };
  'meeting:reaction': { userId: string; emoji: string };
  'meeting:chat': { message: string };
}
