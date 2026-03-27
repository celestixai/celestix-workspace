import { useState, useEffect, useCallback } from 'react';
import {
  MessageCircle,
  Hash,
  Mail,
  CalendarDays,
  CheckSquare,
  FolderOpen,
  FileText,
  Users,
  Video,
  Settings,
  LayoutDashboard,
  Zap,
  Target,
  Inbox,
  Repeat,
  Timer,
  Plug,
  Layers,
  Film,
  Star,
  BarChart3,
  CalendarClock,
  FileType,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/stores/ui.store';
import { useAuthStore } from '@/stores/auth.store';
import { Avatar } from '@/components/shared/avatar';
import { Badge } from '@/components/shared/badge';
import * as Tooltip from '@radix-ui/react-tooltip';
import logoIcon from '@/assets/logo-icon-blue.png';
import { useNotificationStore } from '@/stores/notification.store';

// -----------------------------------------------
// Nav groups with dividers
// -----------------------------------------------

type NavItem = {
  id: string;
  icon: React.ElementType;
  label: string;
  badge?: 'inbox' | 'messenger';
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const navGroups: NavGroup[] = [
  {
    label: 'Core',
    items: [
      { id: 'dashboard', icon: LayoutDashboard, label: 'Home' },
      { id: 'inbox', icon: Inbox, label: 'Inbox', badge: 'inbox' },
      { id: 'messenger', icon: MessageCircle, label: 'Messenger', badge: 'messenger' },
      { id: 'workspace', icon: Hash, label: 'Workspace' },
    ],
  },
  {
    label: 'Work',
    items: [
      { id: 'spaces', icon: Layers, label: 'Spaces' },
      { id: 'tasks', icon: CheckSquare, label: 'Tasks' },
      { id: 'calendar', icon: CalendarDays, label: 'Calendar' },
      { id: 'goals', icon: Target, label: 'Goals' },
      { id: 'sprints', icon: Repeat, label: 'Sprints' },
    ],
  },
  {
    label: 'Content',
    items: [
      { id: 'documents', icon: FileType, label: 'Docs' },
      { id: 'notes', icon: FileText, label: 'Notes' },
      { id: 'files', icon: FolderOpen, label: 'Files' },
      { id: 'clips', icon: Film, label: 'Clips' },
    ],
  },
  {
    label: 'Team',
    items: [
      { id: 'people', icon: Users, label: 'People' },
      { id: 'meetings', icon: Video, label: 'Meetings' },
      { id: 'planner', icon: CalendarClock, label: 'Planner' },
      { id: 'time-reports', icon: Timer, label: 'Timesheets' },
    ],
  },
  {
    label: 'System',
    items: [
      { id: 'automations', icon: Zap, label: 'Automations' },
      { id: 'dashboards', icon: BarChart3, label: 'Dashboards' },
      { id: 'integrations', icon: Plug, label: 'Integrations' },
    ],
  },
];

// Also include modules that exist but aren't in the main groups
// (email, contacts kept accessible via search / app launcher)

const FAVORITES_STORAGE_KEY = 'celestix-nav-favorites';
const COLLAPSED_STORAGE_KEY = 'celestix-nav-collapsed';

function loadFavorites(): string[] {
  try {
    const stored = localStorage.getItem(FAVORITES_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveFavorites(ids: string[]) {
  localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(ids));
}

function loadCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function NavRail() {
  const { activeModule, setActiveModule } = useUIStore();
  const user = useAuthStore((s) => s.user);
  const unreadCount = useNotificationStore((s) => s.unreadCount);
  const [favorites, setFavorites] = useState<string[]>(loadFavorites);
  const [collapsed, setCollapsed] = useState<boolean>(loadCollapsed);

  // Persist collapsed state
  useEffect(() => {
    localStorage.setItem(COLLAPSED_STORAGE_KEY, String(collapsed));
  }, [collapsed]);

  // Double-click to toggle collapse
  const handleDoubleClick = useCallback(() => {
    setCollapsed((c) => !c);
  }, []);

  const toggleFavorite = useCallback((id: string) => {
    setFavorites((prev) => {
      const next = prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id];
      saveFavorites(next);
      return next;
    });
  }, []);

  // Resolve favorite items from all groups
  const allItems = navGroups.flatMap((g) => g.items);
  const favoriteItems = favorites
    .map((id) => allItems.find((item) => item.id === id))
    .filter(Boolean) as NavItem[];

  // Simulated unread counts
  const getBadgeCount = (badge?: 'inbox' | 'messenger') => {
    if (!badge) return 0;
    if (badge === 'inbox') return unreadCount;
    // Messenger badge could come from a messenger store; using 0 as placeholder
    return 0;
  };

  const renderNavButton = (item: NavItem, showLabel: boolean) => {
    const isActive = activeModule === item.id;
    const badgeCount = getBadgeCount(item.badge);

    return (
      <Tooltip.Root key={item.id}>
        <Tooltip.Trigger asChild>
          <button
            onClick={() => setActiveModule(item.id as any)}
            onContextMenu={(e) => {
              e.preventDefault();
              toggleFavorite(item.id);
            }}
            aria-label={item.label}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'relative w-full py-1.5 rounded-xl flex items-center gap-2 transition-all duration-150 focus-visible:outline-2 focus-visible:outline-accent-blue',
              collapsed ? 'justify-center px-0' : 'px-2',
              isActive
                ? 'bg-bg-active text-accent-blue'
                : 'text-text-tertiary hover:text-text-secondary hover:bg-bg-hover',
            )}
          >
            {isActive && (
              <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-accent-blue rounded-r" />
            )}
            <span className="relative flex-shrink-0">
              <item.icon size={20} />
              {badgeCount > 0 && (
                <Badge
                  count={badgeCount}
                  className="absolute -top-1.5 -right-2"
                  color="var(--accent-red)"
                />
              )}
            </span>
            {showLabel && (
              <span className="text-[11px] leading-tight font-medium truncate">{item.label}</span>
            )}
          </button>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            side="right"
            className="bg-bg-tertiary text-text-primary text-xs py-1.5 px-3 rounded-lg shadow-md border border-border-secondary z-50"
            sideOffset={8}
          >
            {item.label}
            {badgeCount > 0 && ` (${badgeCount})`}
            <br />
            <span className="text-text-tertiary text-[10px]">Right-click to {favorites.includes(item.id) ? 'unfavorite' : 'favorite'}</span>
            <Tooltip.Arrow className="fill-bg-tertiary" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    );
  };

  const showLabels = !collapsed;
  const navWidth = collapsed ? 'w-[52px]' : 'w-[72px]';

  return (
    <Tooltip.Provider delayDuration={300}>
      <nav
        className={cn(navWidth, 'h-full bg-bg-secondary border-r border-border-primary flex flex-col items-center py-3 flex-shrink-0 transition-all duration-200')}
        onDoubleClick={handleDoubleClick}
      >
        {/* Logo */}
        <div className="mb-3 p-1.5 flex-shrink-0">
          <img src={logoIcon} alt="Celestix" className="w-8 h-8 object-contain" />
        </div>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="mb-2 p-1 rounded-md text-text-tertiary hover:text-text-secondary hover:bg-bg-hover transition-colors flex-shrink-0"
          aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>

        {/* Nav Items */}
        <div className="flex-1 flex flex-col gap-0.5 overflow-y-auto px-1 w-full scrollbar-thin">
          {/* Favorites section */}
          {favoriteItems.length > 0 && (
            <>
              {showLabels && (
                <div className="flex items-center gap-1 px-2 pt-1 pb-0.5">
                  <Star size={10} className="text-accent-amber" />
                  <span className="text-[9px] font-semibold text-text-tertiary uppercase tracking-wider">Favorites</span>
                </div>
              )}
              {!showLabels && (
                <div className="flex justify-center py-0.5">
                  <Star size={10} className="text-accent-amber" />
                </div>
              )}
              {favoriteItems.map((item) => renderNavButton(item, showLabels))}
              <div className="h-px bg-border-primary mx-2 my-1" />
            </>
          )}

          {/* Grouped nav items */}
          {navGroups.map((group, gi) => (
            <div key={group.label}>
              {gi > 0 && <div className="h-px bg-border-primary mx-2 my-1" />}
              {showLabels && (
                <div className="px-2 pt-1 pb-0.5">
                  <span className="text-[9px] font-semibold text-text-tertiary uppercase tracking-wider">{group.label}</span>
                </div>
              )}
              {group.items.map((item) => renderNavButton(item, showLabels))}
            </div>
          ))}
        </div>

        {/* Bottom section */}
        <div className="flex flex-col items-center gap-2 mt-2 flex-shrink-0 w-full px-1">
          <button
            onClick={() => setActiveModule('settings')}
            aria-label="Settings"
            className={cn(
              'w-full py-1.5 rounded-xl flex items-center gap-2 transition-colors focus-visible:outline-2 focus-visible:outline-accent-blue',
              collapsed ? 'justify-center px-0' : 'px-2',
              activeModule === 'settings'
                ? 'text-accent-blue bg-bg-active'
                : 'text-text-tertiary hover:text-text-secondary hover:bg-bg-hover',
            )}
          >
            <Settings size={18} />
            {showLabels && <span className="text-[11px] font-medium">Settings</span>}
          </button>

          {user && (
            <button
              onClick={() => setActiveModule('settings')}
              className="mt-1 rounded-full focus-visible:outline-2 focus-visible:outline-accent-blue flex-shrink-0"
              aria-label="User profile"
            >
              <Avatar
                src={user.avatarUrl}
                name={user.displayName}
                size="sm"
                userId={user.id}
                showStatus
              />
            </button>
          )}
        </div>
      </nav>
    </Tooltip.Provider>
  );
}
