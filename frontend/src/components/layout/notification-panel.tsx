import { useEffect, useMemo } from 'react';
import {
  X, Check, CheckCheck,
  MessageCircle, Mail, CheckSquare, CalendarDays,
  Bell, Users, FileText, Target,
} from 'lucide-react';
import { useUIStore } from '@/stores/ui.store';
import { useNotificationStore } from '@/stores/notification.store';
import { api } from '@/lib/api';
import { Avatar } from '@/components/shared/avatar';
import { formatRelativeTime, cn } from '@/lib/utils';

const typeIcons: Record<string, React.ReactNode> = {
  message: <MessageCircle size={14} />,
  email: <Mail size={14} />,
  task: <CheckSquare size={14} />,
  event: <CalendarDays size={14} />,
  mention: <Users size={14} />,
  document: <FileText size={14} />,
  goal: <Target size={14} />,
};

function getNotificationIcon(type: string) {
  return typeIcons[type] || <Bell size={14} />;
}

type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body?: string;
  link?: string;
  isRead: boolean;
  sender?: { id: string; displayName: string; avatarUrl?: string };
  createdAt: string;
};

function groupByDate(notifications: NotificationItem[]) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const weekAgo = new Date(today.getTime() - 7 * 86400000);

  const groups: { label: string; items: typeof notifications }[] = [
    { label: 'Today', items: [] },
    { label: 'Yesterday', items: [] },
    { label: 'This Week', items: [] },
    { label: 'Older', items: [] },
  ];

  for (const n of notifications) {
    const d = new Date(n.createdAt);
    if (d >= today) groups[0].items.push(n);
    else if (d >= yesterday) groups[1].items.push(n);
    else if (d >= weekAgo) groups[2].items.push(n);
    else groups[3].items.push(n);
  }

  return groups.filter((g) => g.items.length > 0);
}

export function NotificationPanel() {
  const { notificationPanelOpen, setNotificationPanelOpen, setActiveModule } = useUIStore();
  const { notifications, setNotifications, markAsRead, markAllAsRead, setUnreadCount, clearAll } = useNotificationStore();

  useEffect(() => {
    if (notificationPanelOpen) {
      api.get('/notifications').then(({ data }) => {
        setNotifications(data.data);
        setUnreadCount(data.unreadCount || 0);
      }).catch(() => {});
    }
  }, [notificationPanelOpen, setNotifications, setUnreadCount]);

  const handleMarkAsRead = async (id: string) => {
    markAsRead(id);
    await api.post(`/notifications/${id}/read`).catch(() => {});
  };

  const handleMarkAllAsRead = async () => {
    markAllAsRead();
    await api.post('/notifications/read-all').catch(() => {});
  };

  const handleNotificationClick = (notification: NotificationItem) => {
    if (!notification.isRead) {
      handleMarkAsRead(notification.id);
    }
    if (notification.link) {
      const moduleMap: Record<string, string> = {
        message: 'messenger',
        email: 'email',
        task: 'tasks',
        event: 'calendar',
        mention: 'workspace',
        document: 'documents',
        goal: 'goals',
      };
      const mod = moduleMap[notification.type];
      if (mod) {
        setActiveModule(mod as any);
      }
      setNotificationPanelOpen(false);
    }
  };

  const grouped = useMemo(() => groupByDate(notifications), [notifications]);

  if (!notificationPanelOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0"
        style={{ zIndex: 199 }}
        onClick={() => setNotificationPanelOpen(false)}
      />

      {/* Panel */}
      <div
        className="fixed right-0 top-0 flex flex-col animate-slide-in-right"
        style={{
          width: 360,
          height: '100vh',
          background: '#111113',
          borderLeft: '1px solid rgba(255,255,255,0.08)',
          zIndex: 200,
          animation: 'slideInRight 250ms ease both',
        }}
        role="dialog"
        aria-modal="true"
        aria-label="Notifications"
      >
        {/* Header */}
        <div
          className="flex items-center justify-between flex-shrink-0"
          style={{
            padding: '0 16px',
            height: 52,
            borderBottom: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <h2 style={{ fontSize: 16, fontWeight: 600, color: 'rgba(255,255,255,0.95)' }}>
            Notifications
          </h2>
          <div className="flex items-center gap-1">
            {/* Mark all read */}
            <button
              onClick={handleMarkAllAsRead}
              className="flex items-center gap-1.5 transition-colors"
              style={{
                fontSize: 12,
                color: 'rgba(255,255,255,0.40)',
                background: 'transparent',
                border: 'none',
                padding: '6px 8px',
                borderRadius: 6,
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'rgba(255,255,255,0.80)';
                e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'rgba(255,255,255,0.40)';
                e.currentTarget.style.background = 'transparent';
              }}
              title="Mark all as read"
            >
              <CheckCheck size={14} />
              <span>Mark all read</span>
            </button>

            {/* Close */}
            <button
              onClick={() => setNotificationPanelOpen(false)}
              aria-label="Close notifications"
              className="flex items-center justify-center transition-colors"
              style={{
                width: 32,
                height: 32,
                borderRadius: 6,
                background: 'transparent',
                color: 'rgba(255,255,255,0.40)',
                border: 'none',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                e.currentTarget.style.color = 'white';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'rgba(255,255,255,0.40)';
              }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {notifications.length === 0 && (
            <div className="flex flex-col items-center justify-center" style={{ height: 256 }}>
              <Check size={32} style={{ color: 'rgba(255,255,255,0.20)', marginBottom: 8 }} />
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.40)' }}>All caught up!</p>
            </div>
          )}

          {grouped.map((group) => (
            <div key={group.label}>
              {/* Group label */}
              <div
                className="sticky top-0"
                style={{
                  padding: '8px 16px',
                  fontSize: 11,
                  fontWeight: 600,
                  color: 'rgba(255,255,255,0.30)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  background: '#111113',
                }}
              >
                {group.label}
              </div>

              {group.items.map((notification) => (
                <button
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className="w-full flex items-start gap-3 text-left transition-colors"
                  style={{
                    padding: '10px 16px',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  {/* Icon / Avatar */}
                  {notification.sender ? (
                    <Avatar
                      src={notification.sender.avatarUrl}
                      name={notification.sender.displayName}
                      size="sm"
                    />
                  ) : (
                    <div
                      className="flex items-center justify-center flex-shrink-0"
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: '50%',
                        background: 'rgba(59,130,246,0.15)',
                        color: 'rgba(59,130,246,0.80)',
                      }}
                    >
                      {getNotificationIcon(notification.type)}
                    </div>
                  )}

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p
                      className="truncate"
                      style={{
                        fontSize: 13,
                        color: notification.isRead ? 'rgba(255,255,255,0.60)' : 'rgba(255,255,255,0.95)',
                        fontWeight: notification.isRead ? 400 : 500,
                        margin: 0,
                      }}
                    >
                      {notification.title}
                    </p>
                    {notification.body && (
                      <p
                        className="line-clamp-2"
                        style={{
                          fontSize: 12,
                          color: 'rgba(255,255,255,0.30)',
                          marginTop: 2,
                        }}
                      >
                        {notification.body}
                      </p>
                    )}
                    <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.40)', marginTop: 4 }}>
                      {formatRelativeTime(notification.createdAt)}
                    </p>
                  </div>

                  {/* Unread dot */}
                  {!notification.isRead && (
                    <span
                      className="flex-shrink-0"
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: '#3b82f6',
                        marginTop: 6,
                      }}
                    />
                  )}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
