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
  ClipboardList,
  Table2,
  CalendarClock,
  Puzzle,
  PenTool,
  PlayCircle,
  Workflow,
  FileType,
  Sheet,
  Presentation,
  FileSearch,
  GitFork,
  BarChart3,
  ListTodo,
  Film,
  Palette,
  Globe,
  Heart,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/stores/ui.store';
import { useAuthStore } from '@/stores/auth.store';
import { Avatar } from '@/components/shared/avatar';
import { Badge } from '@/components/shared/badge';
import * as Tooltip from '@radix-ui/react-tooltip';
import logoIcon from '@/assets/logo-icon-blue.png';

const navItems = [
  { id: 'dashboard' as const, icon: LayoutDashboard, label: 'Home' },
  { id: 'messenger' as const, icon: MessageCircle, label: 'Messenger' },
  { id: 'workspace' as const, icon: Hash, label: 'Workspace' },
  { id: 'email' as const, icon: Mail, label: 'Email' },
  { id: 'calendar' as const, icon: CalendarDays, label: 'Calendar' },
  { id: 'tasks' as const, icon: CheckSquare, label: 'Tasks' },
  { id: 'files' as const, icon: FolderOpen, label: 'Files' },
  { id: 'notes' as const, icon: FileText, label: 'Notes' },
  { id: 'contacts' as const, icon: Users, label: 'Contacts' },
  { id: 'meetings' as const, icon: Video, label: 'Meetings' },
  { id: 'forms' as const, icon: ClipboardList, label: 'Forms' },
  { id: 'lists' as const, icon: Table2, label: 'Lists' },
  { id: 'bookings' as const, icon: CalendarClock, label: 'Bookings' },
  { id: 'loop' as const, icon: Puzzle, label: 'Loop' },
  { id: 'whiteboard' as const, icon: PenTool, label: 'Whiteboard' },
  { id: 'stream' as const, icon: PlayCircle, label: 'Stream' },
  { id: 'workflows' as const, icon: Workflow, label: 'Workflows' },
  { id: 'documents' as const, icon: FileType, label: 'Docs' },
  { id: 'spreadsheets' as const, icon: Sheet, label: 'Sheets' },
  { id: 'presentations' as const, icon: Presentation, label: 'Slides' },
  { id: 'pdf' as const, icon: FileSearch, label: 'PDF' },
  { id: 'diagrams' as const, icon: GitFork, label: 'Diagrams' },
  { id: 'analytics' as const, icon: BarChart3, label: 'Analytics' },
  { id: 'todo' as const, icon: ListTodo, label: 'To Do' },
  { id: 'video-editor' as const, icon: Film, label: 'Editor' },
  { id: 'designer' as const, icon: Palette, label: 'Designer' },
  { id: 'sites' as const, icon: Globe, label: 'Sites' },
  { id: 'social' as const, icon: Heart, label: 'Social' },
];

export function NavRail() {
  const { activeModule, setActiveModule } = useUIStore();
  const user = useAuthStore((s) => s.user);

  return (
    <Tooltip.Provider delayDuration={300}>
      <nav className="w-[72px] h-full bg-bg-secondary border-r border-border-primary flex flex-col items-center py-3 flex-shrink-0">
        {/* Logo */}
        <div className="mb-4 p-1.5">
          <img src={logoIcon} alt="Celestix" className="w-10 h-10 object-contain" />
        </div>

        {/* Nav Items */}
        <div className="flex-1 flex flex-col items-center gap-0.5 overflow-y-auto px-1">
          {navItems.map((item) => {
            const isActive = activeModule === item.id;
            return (
              <Tooltip.Root key={item.id}>
                <Tooltip.Trigger asChild>
                  <button
                    onClick={() => setActiveModule(item.id)}
                    aria-label={item.label}
                    aria-current={isActive ? 'page' : undefined}
                    className={cn(
                      'relative w-14 py-1.5 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all duration-150 focus-visible:outline-2 focus-visible:outline-accent-blue',
                      isActive
                        ? 'bg-bg-active text-accent-blue'
                        : 'text-text-tertiary hover:text-text-secondary hover:bg-bg-hover'
                    )}
                  >
                    {isActive && (
                      <span className="absolute -left-1 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-accent-blue rounded-r" />
                    )}
                    <item.icon size={20} />
                    <span className="text-[9px] leading-tight font-medium w-full text-center px-0.5">{item.label}</span>
                  </button>
                </Tooltip.Trigger>
                <Tooltip.Portal>
                  <Tooltip.Content
                    side="right"
                    className="bg-bg-tertiary text-text-primary text-xs py-1.5 px-3 rounded-lg shadow-md border border-border-secondary z-50"
                    sideOffset={8}
                  >
                    {item.label}
                    <Tooltip.Arrow className="fill-bg-tertiary" />
                  </Tooltip.Content>
                </Tooltip.Portal>
              </Tooltip.Root>
            );
          })}
        </div>

        {/* Bottom section */}
        <div className="flex flex-col items-center gap-2 mt-2">
          <button
            onClick={() => setActiveModule('settings')}
            aria-label="Settings"
            className={cn(
              'w-10 h-10 rounded-xl flex items-center justify-center transition-colors focus-visible:outline-2 focus-visible:outline-accent-blue',
              activeModule === 'settings'
                ? 'text-accent-blue bg-bg-active'
                : 'text-text-tertiary hover:text-text-secondary hover:bg-bg-hover'
            )}
          >
            <Settings size={18} />
          </button>

          {user && (
            <button
              onClick={() => setActiveModule('settings')}
              className="mt-1 rounded-full focus-visible:outline-2 focus-visible:outline-accent-blue"
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
