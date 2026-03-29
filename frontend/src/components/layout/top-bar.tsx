import { Search, Bell, Sun, Moon, Sparkles } from 'lucide-react';
import { useUIStore } from '@/stores/ui.store';
import { useNotificationStore } from '@/stores/notification.store';
import { Badge } from '@/components/shared/badge';
import { AIChatPanel } from '@/modules/ai/AIChatPanel';
import { useAIStatus } from '@/hooks/useAI';
import { cn } from '@/lib/utils';
import { useState } from 'react';

const moduleNames: Record<string, string> = {
  dashboard: 'Home',
  inbox: 'Inbox',
  messenger: 'Messenger',
  workspace: 'Workspace',
  email: 'Email',
  calendar: 'Calendar',
  tasks: 'Tasks',
  spaces: 'Spaces',
  files: 'Files',
  notes: 'Notes',
  contacts: 'Contacts',
  meetings: 'Meetings',
  settings: 'Settings',
  forms: 'Forms',
  lists: 'Lists',
  bookings: 'Bookings',
  loop: 'Loop',
  whiteboard: 'Whiteboard',
  stream: 'Stream',
  workflows: 'Workflows',
  documents: 'Documents',
  spreadsheets: 'Spreadsheets',
  presentations: 'Presentations',
  pdf: 'PDF Tools',
  diagrams: 'Diagrams',
  analytics: 'Analytics',
  todo: 'To Do',
  'video-editor': 'Video Editor',
  designer: 'Designer',
  sites: 'Sites',
  social: 'Social',
  automations: 'Automations',
  goals: 'Goals',
  planner: 'Planner',
  clips: 'Clips',
  sprints: 'Sprints',
  'time-reports': 'Timesheets',
  integrations: 'Integrations',
  people: 'People',
};

export function TopBar() {
  const { activeModule, theme, setTheme, setSearchOpen, setNotificationPanelOpen } = useUIStore();
  const unreadCount = useNotificationStore((s) => s.unreadCount);
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const { data: aiStatus } = useAIStatus();
  const aiAvailable = aiStatus?.isAvailable ?? false;

  return (
    <header
      className="sticky top-0 z-[100] flex items-center justify-between flex-shrink-0"
      style={{
        height: 44,
        background: '#09090B',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        padding: '0 16px',
      }}
    >
      {/* Left — Breadcrumbs */}
      <nav className="flex items-center gap-0 min-w-0" style={{ fontFamily: 'Inter, sans-serif' }}>
        <span
          className="cursor-pointer transition-colors"
          style={{ fontSize: 13, color: 'rgba(255,255,255,0.40)' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.65)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.40)')}
        >
          Celestix
        </span>
        <span className="mx-1.5 select-none" style={{ fontSize: 13, color: 'rgba(255,255,255,0.20)' }}>
          ›
        </span>
        <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.95)', fontWeight: 500 }}>
          {moduleNames[activeModule] || activeModule}
        </span>
      </nav>

      {/* Right — Actions */}
      <div className="flex items-center" style={{ gap: 4 }}>
        {/* Search trigger */}
        <button
          onClick={() => setSearchOpen(true)}
          aria-label="Search everything (Cmd+K)"
          className="flex items-center gap-2 transition-colors"
          style={{
            height: 32,
            paddingLeft: 10,
            paddingRight: 8,
            background: 'transparent',
            borderRadius: 6,
            color: 'rgba(255,255,255,0.40)',
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
          <Search size={16} />
          <span
            className="flex items-center"
            style={{
              fontSize: 11,
              color: 'rgba(255,255,255,0.20)',
              background: 'rgba(255,255,255,0.04)',
              borderRadius: 9999,
              padding: '2px 6px',
              lineHeight: 1,
            }}
          >
            ⌘K
          </span>
        </button>

        {/* Theme toggle */}
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          className="flex items-center justify-center transition-colors"
          style={{
            width: 32,
            height: 32,
            background: 'transparent',
            borderRadius: 6,
            color: 'rgba(255,255,255,0.40)',
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
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        {/* AI Brain */}
        <button
          onClick={() => setAiPanelOpen(true)}
          aria-label={aiAvailable ? 'AI Assistant' : 'AI Offline'}
          className="relative flex items-center justify-center transition-colors"
          style={{
            width: 32,
            height: 32,
            background: 'transparent',
            borderRadius: 6,
            color: 'rgba(255,255,255,0.40)',
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
          <Sparkles size={16} />
          <span
            className="absolute flex-shrink-0 rounded-full"
            style={{
              width: 6,
              height: 6,
              bottom: 5,
              right: 5,
              background: aiAvailable ? '#22c55e' : 'rgba(255,255,255,0.25)',
            }}
          />
        </button>

        {/* Notifications */}
        <button
          onClick={() => setNotificationPanelOpen(true)}
          aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
          className="relative flex items-center justify-center transition-colors"
          style={{
            width: 32,
            height: 32,
            background: 'transparent',
            borderRadius: 6,
            color: 'rgba(255,255,255,0.40)',
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
          <Bell size={16} />
          {unreadCount > 0 && (
            <span
              className="absolute flex items-center justify-center"
              style={{
                top: 3,
                right: 3,
                minWidth: 14,
                height: 14,
                borderRadius: 9999,
                background: '#ef4444',
                color: 'white',
                fontSize: 9,
                fontWeight: 600,
                lineHeight: 1,
                padding: '0 3px',
              }}
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>

        {/* User avatar */}
        <button
          className="flex items-center justify-center flex-shrink-0 overflow-hidden transition-opacity hover:opacity-80"
          style={{
            width: 24,
            height: 24,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.10)',
            marginLeft: 4,
          }}
          aria-label="User menu"
        >
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.60)', fontWeight: 500 }}>U</span>
        </button>
      </div>

      <AIChatPanel open={aiPanelOpen} onClose={() => setAiPanelOpen(false)} />
    </header>
  );
}
