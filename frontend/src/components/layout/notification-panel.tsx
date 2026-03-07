import { useEffect } from 'react';
import { X, Check, CheckCheck, Trash2 } from 'lucide-react';
import { useUIStore } from '@/stores/ui.store';
import { useNotificationStore } from '@/stores/notification.store';
import { api } from '@/lib/api';
import { Avatar } from '@/components/shared/avatar';
import { formatRelativeTime, cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export function NotificationPanel() {
  const { notificationPanelOpen, setNotificationPanelOpen } = useUIStore();
  const { notifications, setNotifications, markAsRead, markAllAsRead, setUnreadCount } = useNotificationStore();

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

  if (!notificationPanelOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={() => setNotificationPanelOpen(false)} />
      <div className="fixed right-0 top-0 h-full w-[calc(100vw-3rem)] sm:w-96 bg-bg-secondary border-l border-border-primary z-50 animate-slide-in-right flex flex-col shadow-lg" role="dialog" aria-modal="true" aria-label="Notifications">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-primary">
          <h2 className="text-base font-semibold truncate">Notifications</h2>
          <div className="flex items-center gap-1 flex-shrink-0">
            <Button variant="ghost" size="sm" onClick={handleMarkAllAsRead}>
              <CheckCheck size={14} />
              <span className="hidden sm:inline">Mark all read</span>
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

          {notifications.map((notification) => (
            <button
              key={notification.id}
              onClick={() => handleMarkAsRead(notification.id)}
              className={cn(
                'w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-bg-hover border-b border-border-primary',
                !notification.isRead && 'bg-bg-active/50'
              )}
            >
              {notification.sender ? (
                <Avatar
                  src={notification.sender.avatarUrl}
                  name={notification.sender.displayName}
                  size="sm"
                />
              ) : (
                <div className="h-8 w-8 rounded-full bg-accent-blue/20 flex items-center justify-center">
                  <Check size={14} className="text-accent-blue" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className={cn('text-sm', !notification.isRead ? 'text-text-primary font-medium' : 'text-text-secondary')}>
                  {notification.title}
                </p>
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
      </div>
    </>
  );
}
