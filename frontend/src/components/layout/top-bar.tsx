import { Search, Bell, Sun, Moon, Wifi, WifiOff } from 'lucide-react';
import { useUIStore } from '@/stores/ui.store';
import { useNotificationStore } from '@/stores/notification.store';
import { Badge } from '@/components/shared/badge';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';
import { getSocket } from '@/lib/socket';

const moduleNames: Record<string, string> = {
  messenger: 'Messenger',
  workspace: 'Workspace',
  email: 'Email',
  calendar: 'Calendar',
  tasks: 'Tasks',
  files: 'Files',
  notes: 'Notes',
  contacts: 'Contacts',
  meetings: 'Meetings',
  settings: 'Settings',
};

export function TopBar() {
  const { activeModule, theme, setTheme, setSearchOpen, setNotificationPanelOpen } = useUIStore();
  const unreadCount = useNotificationStore((s) => s.unreadCount);
  const [connected, setConnected] = useState(true);

  useEffect(() => {
    const socket = getSocket();
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    setConnected(socket.connected);
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, []);

  return (
    <header className="h-11 bg-bg-secondary border-b border-border-primary flex items-center px-4 flex-shrink-0 z-10">
      {/* Left — Module name */}
      <div className="flex items-center gap-2 min-w-0 sm:min-w-[140px]">
        <h1 className="text-sm font-semibold text-text-primary truncate">
          {moduleNames[activeModule] || activeModule}
        </h1>
      </div>

      {/* Center — Search */}
      <div className="flex-1 flex justify-center max-w-xl mx-auto min-w-0 px-2">
        <button
          onClick={() => setSearchOpen(true)}
          aria-label="Search everything (Ctrl+K)"
          className="flex items-center gap-2 w-full max-w-md h-8 px-3 rounded-lg bg-bg-tertiary border border-border-primary text-text-tertiary text-sm hover:border-border-secondary transition-colors focus-visible:outline-2 focus-visible:outline-accent-blue"
        >
          <Search size={14} className="flex-shrink-0" />
          <span className="truncate hidden sm:inline">Search everything...</span>
          <kbd className="ml-auto text-[10px] bg-bg-primary px-1.5 py-0.5 rounded-md border border-border-secondary flex-shrink-0 hidden sm:inline">
            Ctrl+K
          </kbd>
        </button>
      </div>

      {/* Right — Actions */}
      <div className="flex items-center gap-1 min-w-0 sm:min-w-[140px] justify-end">
        {/* Connection status */}
        <div
          className={cn('p-2 flex-shrink-0', connected ? 'text-accent-emerald' : 'text-accent-red')}
          role="status"
          aria-label={connected ? 'Connected' : 'Disconnected'}
        >
          {connected ? <Wifi size={14} /> : <WifiOff size={14} />}
        </div>

        {/* Theme toggle */}
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          className="p-2 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-colors flex-shrink-0 focus-visible:outline-2 focus-visible:outline-accent-blue"
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        {/* Notifications */}
        <button
          onClick={() => setNotificationPanelOpen(true)}
          aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
          className="relative p-2 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-colors flex-shrink-0 focus-visible:outline-2 focus-visible:outline-accent-blue"
        >
          <Bell size={16} />
          {unreadCount > 0 && (
            <Badge
              count={unreadCount}
              className="absolute -top-0.5 -right-0.5"
              color="var(--accent-red)"
            />
          )}
        </button>
      </div>
    </header>
  );
}
