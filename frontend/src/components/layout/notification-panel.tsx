import { useEffect, useMemo } from 'react';
import {
  X, Check, CheckCheck, Trash2,
  MessageCircle, Mail, CheckSquare, CalendarDays,
  Bell, Users, FileText, Target,
} from 'lucide-react';
import { useUIStore } from '@/stores/ui.store';
import { useNotificationStore } from '@/stores/notification.store';
import { api } from '@/lib/api';
import { Avatar } from '@/components/shared/avatar';
import { formatRelativeTime, cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

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

  const handleClearAll = () => {
    clearAll();
  };

  const handleNotificationClick = (notification: NotificationItem) => {
    if (!notification.isRead) {
      handleMarkAsRead(notification.id);
    }
    // Navigate to source if link exists
    if (notification.link) {
      // Try to extract module from link
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
      <div className="fixed inset-0 z-40" onClick={() => setNotificationPanelOpen(false)} />
      <div className="fixed right-0 top-0 h-full w-[calc(100vw-3rem)] sm:w-96 bg-bg-secondary border-l border-border-primary z-50 animate-slide-in-right flex flex-col shadow-lg" role="dialog" aria-modal="true" aria-label="Notifications">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-primary">
          <h2 className="text-base font-semibold truncate">Notifications</h2>
          <div className="flex items-center gap-1 flex-shrink-0">
            <Button variant="ghost" size="sm" onClick={handleMarkAllAsRead} title="Mark all as read">
              <CheckCheck size={14} />
              <span className="hidden sm:inline">Mark all read</span>
            </Button>
            <Button variant="ghost" size="sm" onClick={handleClearAll} title="Clear all notifications">
              <Trash2 size={14} />
              <span className="hidden sm:inline">Clear</span>
            </Button>
            <button
              onClick={() => setNotificationPanelOpen(false)}
              aria-label="Close notifications"
              className="p-1.5 rounded-lg hover:bg-bg-hover text-text-tertiary hover:text-text-primary transition-colors focus-visible:outline-2 focus-visible:outline-accent-blue"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {notifications.length === 0 && (
            <div className="flex flex-col items-center justify-center h-64 text-text-tertiary">
              <Check size={32} className="mb-2" />
              <p className="text-sm">All caught up!</p>
            </div>
          )}

          {grouped.map((group) => (
            <div key={group.label}>
              <div className="px-4 py-1.5 text-[10px] font-semibold text-text-tertiary uppercase tracking-wider bg-bg-tertiary/50 sticky top-0">
                {group.label}
              </div>
              {group.items.map((notification) => (
                <button
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={cn(
                    'w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-bg-hover border-b border-border-primary',
                    !notification.isRead && 'bg-bg-active/50',
                  )}
                >
                  {/* Type icon or sender avatar */}
                  {notification.sender ? (
                    <Avatar
                      src={notification.sender.avatarUrl}
                      name={notification.sender.displayName}
                      size="sm"
                    />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-accent-blue/20 flex items-center justify-center flex-shrink-0">
                      {getNotificationIcon(notification.type)}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-text-tertiary flex-shrink-0">{getNotificationIcon(notification.type)}</span>
                      <p className={cn('text-sm truncate', !notification.isRead ? 'text-text-primary font-medium' : 'text-text-secondary')}>
                        {notification.title}
                      </p>
                    </div>
                    {notification.body && (
                      <p className="text-xs text-text-tertiary mt-0.5 line-clamp-2">{notification.body}</p>
                    )}
                    <p className="text-[10px] text-text-tertiary mt-1">
                      {formatRelativeTime(notification.createdAt)}
                    </p>
                  </div>
                  {!notification.isRead && (
                    <span className="h-2 w-2 rounded-full bg-accent-blue flex-shrink-0 mt-2" />
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
