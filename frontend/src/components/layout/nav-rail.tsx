import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageCircle,
  Calendar,
  FileText,
  Users,
  Settings,
  LayoutDashboard,
  Target,
  Inbox,
  Layers,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Grid3X3,
  Mail,
  Contact,
  ClipboardList,
  Sheet,
  Presentation,
  FileType2,
  Share2,
  MessageSquare,
  CheckSquare,
  Zap,
  Plug,
  Video,
  StickyNote,
  FolderOpen,
  GitBranch,
  Clapperboard,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/stores/ui.store';
import { useAuthStore } from '@/stores/auth.store';
import { Avatar } from '@/components/shared/avatar';
import * as Tooltip from '@radix-ui/react-tooltip';
import logoIcon from '@/assets/logo-icon-blue.png';
import { useNotificationStore } from '@/stores/notification.store';

// -----------------------------------------------
// Types
// -----------------------------------------------

type NavItem = {
  id: string;
  icon: React.ElementType;
  label: string;
  badge?: 'inbox' | 'messenger';
};

// -----------------------------------------------
// Primary 10 items (grouped visually)
// -----------------------------------------------

const coreItems: NavItem[] = [
  { id: 'dashboard', icon: LayoutDashboard, label: 'Home' },
  { id: 'inbox', icon: Inbox, label: 'Inbox', badge: 'inbox' },
  { id: 'messenger', icon: MessageCircle, label: 'Chat', badge: 'messenger' },
  { id: 'spaces', icon: Layers, label: 'Spaces' },
];

const workItems: NavItem[] = [
  { id: 'email', icon: Mail, label: 'Email' },
  { id: 'calendar', icon: Calendar, label: 'Calendar' },
  { id: 'documents', icon: FileText, label: 'Docs' },
  { id: 'goals', icon: Target, label: 'Goals' },
];

const teamItems: NavItem[] = [
  { id: 'people', icon: Users, label: 'People' },
  { id: 'dashboards', icon: BarChart3, label: 'Dashboards' },
];

// -----------------------------------------------
// "More Apps" grid modules (everything NOT primary)
// -----------------------------------------------

type MoreAppItem = {
  id: string;
  icon: React.ElementType;
  label: string;
};

const moreApps: MoreAppItem[] = [
  { id: 'contacts', icon: Contact, label: 'Contacts' },
  { id: 'forms', icon: ClipboardList, label: 'Forms' },
  { id: 'spreadsheets', icon: Sheet, label: 'Spreadsheets' },
  { id: 'presentations', icon: Presentation, label: 'Presentations' },
  { id: 'pdf', icon: FileType2, label: 'PDF' },
  { id: 'diagrams', icon: Share2, label: 'Diagrams' },
  { id: 'workflows', icon: GitBranch, label: 'Workflows' },
  { id: 'video-editor', icon: Clapperboard, label: 'Video Editor' },
  { id: 'analytics', icon: BarChart3, label: 'Analytics' },
  { id: 'todo', icon: CheckSquare, label: 'Todo' },
  { id: 'social', icon: MessageSquare, label: 'Social' },
  { id: 'automations', icon: Zap, label: 'Automations' },
  { id: 'integrations', icon: Plug, label: 'Integrations' },
  { id: 'settings', icon: Settings, label: 'Settings' },
  { id: 'meetings', icon: Video, label: 'Meetings' },
  { id: 'notes', icon: StickyNote, label: 'Notes' },
  { id: 'files', icon: FolderOpen, label: 'Files' },
];

// -----------------------------------------------
// Constants
// -----------------------------------------------

const COLLAPSED_STORAGE_KEY = 'celestix-nav-collapsed';
const COLLAPSED_WIDTH = 48;
const EXPANDED_WIDTH = 220;

/** Returns true when viewport is tablet-width (768-1023px) */
function useIsTablet(): boolean {
  const [isTablet, setIsTablet] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth >= 768 && window.innerWidth < 1024;
  });

  useEffect(() => {
    const mql = window.matchMedia('(min-width: 768px) and (max-width: 1023px)');
    const handler = (e: MediaQueryListEvent) => setIsTablet(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  return isTablet;
}

function loadCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

// -----------------------------------------------
// Component
// -----------------------------------------------

export function NavRail() {
  const { activeModule, setActiveModule } = useUIStore();
  const user = useAuthStore((s) => s.user);
  const unreadCount = useNotificationStore((s) => s.unreadCount);
  const isTablet = useIsTablet();
  const [userCollapsed, setUserCollapsed] = useState<boolean>(loadCollapsed);
  // D7.6: On tablet, always force collapsed (48px icons only)
  const collapsed = isTablet || userCollapsed;
  const setCollapsed = isTablet ? () => {} : setUserCollapsed;
  const [moreOpen, setMoreOpen] = useState(false);
  const [aiBrainOnline] = useState(true);
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Persist collapsed state
  useEffect(() => {
    if (!isTablet) {
      localStorage.setItem(COLLAPSED_STORAGE_KEY, String(userCollapsed));
    }
  }, [userCollapsed, isTablet]);

  // Close popover on outside click
  useEffect(() => {
    if (!moreOpen) return;
    function handleClick(e: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        moreButtonRef.current &&
        !moreButtonRef.current.contains(e.target as Node)
      ) {
        setMoreOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [moreOpen]);

  // Double-click to toggle collapse
  const handleDoubleClick = useCallback(() => {
    setCollapsed((c) => !c);
  }, []);

  const getBadgeCount = (badge?: 'inbox' | 'messenger') => {
    if (!badge) return 0;
    if (badge === 'inbox') return unreadCount;
    return 0;
  };

  const expanded = !collapsed;
  const width = collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH;

  // -----------------------------------------------
  // Render a single nav item
  // -----------------------------------------------
  const renderNavItem = (item: NavItem) => {
    const isActive = activeModule === item.id;
    const badgeCount = getBadgeCount(item.badge);

    const button = (
      <button
        onClick={() => setActiveModule(item.id as any)}
        aria-label={item.label}
        aria-current={isActive ? 'page' : undefined}
        className={cn(
          'relative flex items-center w-full rounded-lg transition-all duration-150 focus-visible:outline-2 focus-visible:outline-accent-blue group',
          collapsed
            ? 'justify-center h-10'
            : 'gap-3 py-[9px] px-3 mx-0',
          isActive
            ? expanded
              ? 'bg-[rgba(255,255,255,0.08)] text-white font-medium'
              : 'text-white opacity-100'
            : 'text-[rgba(255,255,255,0.40)] opacity-50 hover:opacity-100 hover:bg-[rgba(255,255,255,0.04)] hover:text-[rgba(255,255,255,0.65)]',
        )}
        style={expanded ? { margin: '1px 8px', borderRadius: 8 } : undefined}
      >
        {/* Active left bar (collapsed mode) */}
        {isActive && collapsed && (
          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-accent-blue rounded-r" />
        )}

        {/* Icon */}
        <span className="relative flex-shrink-0">
          <item.icon size={collapsed ? 20 : 18} />
          {badgeCount > 0 && (
            <span className="absolute -top-1.5 -right-2 inline-flex items-center justify-center min-w-[16px] h-4 px-0.5 rounded-full bg-[#EF4444] text-white text-[10px] font-semibold">
              {badgeCount > 99 ? '99+' : badgeCount}
            </span>
          )}
        </span>

        {/* Label (expanded) */}
        <AnimatePresence>
          {expanded && (
            <motion.span
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto' }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: 0.15 }}
              className="text-sm leading-tight truncate overflow-hidden"
            >
              {item.label}
            </motion.span>
          )}
        </AnimatePresence>
      </button>
    );

    if (collapsed) {
      return (
        <Tooltip.Root key={item.id}>
          <Tooltip.Trigger asChild>{button}</Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Content
              side="right"
              className="bg-[#1C1C1F] text-[rgba(255,255,255,0.95)] text-xs py-1.5 px-3 rounded-lg shadow-md border border-[rgba(255,255,255,0.08)] z-[200]"
              sideOffset={8}
            >
              {item.label}
              {badgeCount > 0 && ` (${badgeCount})`}
              <Tooltip.Arrow className="fill-[#1C1C1F]" />
            </Tooltip.Content>
          </Tooltip.Portal>
        </Tooltip.Root>
      );
    }

    return <div key={item.id}>{button}</div>;
  };

  // -----------------------------------------------
  // Render a section divider
  // -----------------------------------------------
  const renderDivider = (key: string) => (
    <div key={key} className="h-px bg-[rgba(255,255,255,0.08)] mx-3 my-1.5" />
  );

  // -----------------------------------------------
  // "More Apps" Popover
  // -----------------------------------------------
  const renderMorePopover = () => {
    if (!moreOpen) return null;

    // Position the popover to the right of the nav rail, aligned to the More button
    const btnRect = moreButtonRef.current?.getBoundingClientRect();
    const top = btnRect ? btnRect.top : 300;
    const left = width + 8;

    return (
      <div
        ref={popoverRef}
        className="fixed z-[200]"
        style={{
          top: Math.min(top, window.innerHeight - 420),
          left,
          animation: 'popoverScaleIn 150ms cubic-bezier(0.16,1,0.3,1)',
          transformOrigin: 'left center',
        }}
      >
        <div className="w-[320px] bg-[#161618] border border-[rgba(255,255,255,0.12)] rounded-lg shadow-md p-4">
          <div className="grid grid-cols-4 gap-1">
            {moreApps.map((app) => (
              <button
                key={app.id}
                onClick={() => {
                  setActiveModule(app.id as any);
                  setMoreOpen(false);
                }}
                className="flex flex-col items-center justify-center w-16 h-16 rounded-lg text-[rgba(255,255,255,0.40)] hover:bg-[rgba(255,255,255,0.04)] hover:text-white transition-colors"
              >
                <app.icon size={24} />
                <span className="text-[11px] mt-1 leading-tight truncate max-w-[56px] text-center">
                  {app.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // -----------------------------------------------
  // Main render
  // -----------------------------------------------
  return (
    <Tooltip.Provider delayDuration={300}>
      {/* Inject keyframe animation for popover */}
      <style>{`
        @keyframes popoverScaleIn {
          from { opacity: 0; transform: scale(0.95); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>

      <nav
        className="h-full bg-[#0C0C0E] border-r border-[rgba(255,255,255,0.08)] flex flex-col flex-shrink-0 z-[150] select-none"
        style={{
          width,
          minWidth: width,
          transition: 'width 200ms cubic-bezier(0.16,1,0.3,1), min-width 200ms cubic-bezier(0.16,1,0.3,1)',
        }}
        onDoubleClick={handleDoubleClick}
      >
        {/* Logo + collapse toggle row */}
        <div className={cn('flex items-center flex-shrink-0 pt-3 pb-2', collapsed ? 'flex-col gap-1 px-0' : 'px-3 gap-2')}>
          <img src={logoIcon} alt="Celestix" className="w-7 h-7 object-contain flex-shrink-0" />
          <AnimatePresence>
            {expanded && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.15 }}
                className="text-sm font-semibold text-white tracking-tight flex-1 overflow-hidden"
              >
                Celestix
              </motion.span>
            )}
          </AnimatePresence>
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="p-1 rounded-md text-[rgba(255,255,255,0.40)] hover:text-[rgba(255,255,255,0.60)] hover:bg-[rgba(255,255,255,0.04)] transition-colors flex-shrink-0"
            aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
          >
            {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        </div>

        {/* Scrollable nav area */}
        <div className="flex-1 flex flex-col gap-0.5 overflow-y-auto overflow-x-hidden scrollbar-thin py-1">
          {/* CORE */}
          {coreItems.map(renderNavItem)}

          {renderDivider('d-work')}

          {/* WORK */}
          {workItems.map(renderNavItem)}

          {renderDivider('d-team')}

          {/* TEAM */}
          {teamItems.map(renderNavItem)}
        </div>

        {/* Bottom section (separated by divider) */}
        <div className="flex-shrink-0 border-t border-[rgba(255,255,255,0.08)] pt-1.5 pb-3 flex flex-col gap-0.5">
          {/* AI Brain */}
          {(() => {
            const aiButton = (
              <button
                onClick={() => useUIStore.getState().setSearchOpen(true)}
                className={cn(
                  'relative flex items-center w-full rounded-lg transition-all duration-150 text-[rgba(255,255,255,0.40)] opacity-50 hover:opacity-100 hover:bg-[rgba(255,255,255,0.04)] hover:text-[rgba(255,255,255,0.65)]',
                  collapsed ? 'justify-center h-10' : 'gap-3 py-[9px] px-3',
                )}
                style={expanded ? { margin: '1px 8px', borderRadius: 8 } : undefined}
                aria-label="AI Brain"
              >
                <span className="relative flex-shrink-0">
                  <Sparkles size={collapsed ? 20 : 18} />
                  {/* Online/offline dot */}
                  <span
                    className={cn(
                      'absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-[#0C0C0E]',
                      aiBrainOnline ? 'bg-emerald-400' : 'bg-[rgba(255,255,255,0.25)]',
                    )}
                  />
                </span>
                <AnimatePresence>
                  {expanded && (
                    <motion.span
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: 'auto' }}
                      exit={{ opacity: 0, width: 0 }}
                      transition={{ duration: 0.15 }}
                      className="text-sm leading-tight overflow-hidden"
                    >
                      AI Brain
                    </motion.span>
                  )}
                </AnimatePresence>
              </button>
            );

            if (collapsed) {
              return (
                <Tooltip.Root>
                  <Tooltip.Trigger asChild>{aiButton}</Tooltip.Trigger>
                  <Tooltip.Portal>
                    <Tooltip.Content
                      side="right"
                      className="bg-[#1C1C1F] text-[rgba(255,255,255,0.95)] text-xs py-1.5 px-3 rounded-lg shadow-md border border-[rgba(255,255,255,0.08)] z-[200]"
                      sideOffset={8}
                    >
                      AI Brain {aiBrainOnline ? '(Online)' : '(Offline)'}
                      <Tooltip.Arrow className="fill-[#1C1C1F]" />
                    </Tooltip.Content>
                  </Tooltip.Portal>
                </Tooltip.Root>
              );
            }
            return aiButton;
          })()}

          {/* More button */}
          {(() => {
            const moreButton = (
              <button
                ref={moreButtonRef}
                onClick={() => setMoreOpen((v) => !v)}
                className={cn(
                  'relative flex items-center w-full rounded-lg transition-all duration-150 text-[rgba(255,255,255,0.40)] opacity-50 hover:opacity-100 hover:bg-[rgba(255,255,255,0.04)] hover:text-[rgba(255,255,255,0.65)]',
                  collapsed ? 'justify-center h-10' : 'gap-3 py-[9px] px-3',
                  moreOpen && 'opacity-100 bg-[rgba(255,255,255,0.04)] text-white',
                )}
                style={expanded ? { margin: '1px 8px', borderRadius: 8 } : undefined}
                aria-label="More apps"
              >
                <Grid3X3 size={collapsed ? 20 : 18} />
                <AnimatePresence>
                  {expanded && (
                    <motion.span
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: 'auto' }}
                      exit={{ opacity: 0, width: 0 }}
                      transition={{ duration: 0.15 }}
                      className="text-sm leading-tight overflow-hidden"
                    >
                      More
                    </motion.span>
                  )}
                </AnimatePresence>
              </button>
            );

            if (collapsed) {
              return (
                <Tooltip.Root>
                  <Tooltip.Trigger asChild>{moreButton}</Tooltip.Trigger>
                  <Tooltip.Portal>
                    <Tooltip.Content
                      side="right"
                      className="bg-[#1C1C1F] text-[rgba(255,255,255,0.95)] text-xs py-1.5 px-3 rounded-lg shadow-md border border-[rgba(255,255,255,0.08)] z-[200]"
                      sideOffset={8}
                    >
                      More apps
                      <Tooltip.Arrow className="fill-[#1C1C1F]" />
                    </Tooltip.Content>
                  </Tooltip.Portal>
                </Tooltip.Root>
              );
            }
            return moreButton;
          })()}

          {/* Divider before settings/avatar */}
          <div className="h-px bg-[rgba(255,255,255,0.08)] mx-3 my-1" />

          {/* Settings */}
          {(() => {
            const isActive = activeModule === 'settings';
            const settingsButton = (
              <button
                onClick={() => setActiveModule('settings')}
                className={cn(
                  'relative flex items-center w-full rounded-lg transition-all duration-150 focus-visible:outline-2 focus-visible:outline-accent-blue',
                  collapsed ? 'justify-center h-10' : 'gap-3 py-[9px] px-3',
                  isActive
                    ? expanded
                      ? 'bg-[rgba(255,255,255,0.08)] text-white font-medium'
                      : 'text-white opacity-100'
                    : 'text-[rgba(255,255,255,0.40)] opacity-50 hover:opacity-100 hover:bg-[rgba(255,255,255,0.04)] hover:text-[rgba(255,255,255,0.65)]',
                )}
                style={expanded ? { margin: '1px 8px', borderRadius: 8 } : undefined}
                aria-label="Settings"
              >
                {isActive && collapsed && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-accent-blue rounded-r" />
                )}
                <Settings size={collapsed ? 20 : 18} />
                <AnimatePresence>
                  {expanded && (
                    <motion.span
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: 'auto' }}
                      exit={{ opacity: 0, width: 0 }}
                      transition={{ duration: 0.15 }}
                      className="text-sm leading-tight overflow-hidden"
                    >
                      Settings
                    </motion.span>
                  )}
                </AnimatePresence>
              </button>
            );

            if (collapsed) {
              return (
                <Tooltip.Root>
                  <Tooltip.Trigger asChild>{settingsButton}</Tooltip.Trigger>
                  <Tooltip.Portal>
                    <Tooltip.Content
                      side="right"
                      className="bg-[#1C1C1F] text-[rgba(255,255,255,0.95)] text-xs py-1.5 px-3 rounded-lg shadow-md border border-[rgba(255,255,255,0.08)] z-[200]"
                      sideOffset={8}
                    >
                      Settings
                      <Tooltip.Arrow className="fill-[#1C1C1F]" />
                    </Tooltip.Content>
                  </Tooltip.Portal>
                </Tooltip.Root>
              );
            }
            return settingsButton;
          })()}

          {/* User avatar */}
          {user && (
            <div className={cn('flex items-center', collapsed ? 'justify-center mt-1' : 'gap-3 px-3 mt-1 mx-2')}>
              <button
                onClick={() => setActiveModule('settings')}
                className="rounded-full focus-visible:outline-2 focus-visible:outline-accent-blue flex-shrink-0 relative"
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
              <AnimatePresence>
                {expanded && (
                  <motion.span
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: 'auto' }}
                    exit={{ opacity: 0, width: 0 }}
                    transition={{ duration: 0.15 }}
                    className="text-xs text-[rgba(255,255,255,0.50)] truncate overflow-hidden"
                  >
                    {user.displayName}
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </nav>

      {/* More Apps Popover (rendered as portal-like fixed element) */}
      {renderMorePopover()}
    </Tooltip.Provider>
  );
}
