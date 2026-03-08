import {
  MessageCircle,
  Mail,
  CalendarDays,
  CheckSquare,
  LayoutDashboard,
  MoreHorizontal,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/stores/ui.store';
import { useState } from 'react';

const primaryItems = [
  { id: 'dashboard' as const, icon: LayoutDashboard, label: 'Home' },
  { id: 'messenger' as const, icon: MessageCircle, label: 'Chat' },
  { id: 'email' as const, icon: Mail, label: 'Email' },
  { id: 'calendar' as const, icon: CalendarDays, label: 'Calendar' },
  { id: 'tasks' as const, icon: CheckSquare, label: 'Tasks' },
];

const moreItems = [
  'workspace', 'files', 'notes', 'contacts', 'meetings',
  'forms', 'lists', 'bookings', 'loop', 'whiteboard', 'stream', 'workflows', 'settings',
] as const;

const moreLabels: Record<string, string> = {
  workspace: 'Workspace',
  files: 'Files',
  notes: 'Notes',
  contacts: 'Contacts',
  meetings: 'Meetings',
  forms: 'Forms',
  lists: 'Lists',
  bookings: 'Bookings',
  loop: 'Loop',
  whiteboard: 'Whiteboard',
  stream: 'Stream',
  workflows: 'Workflows',
  settings: 'Settings',
};

export function MobileNav() {
  const { activeModule, setActiveModule } = useUIStore();
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <>
      {/* More menu overlay */}
      {moreOpen && (
        <div className="fixed inset-0 z-30" onClick={() => setMoreOpen(false)}>
          <div className="absolute bottom-14 left-0 right-0 bg-bg-secondary border-t border-border-primary rounded-t-xl p-3 grid grid-cols-4 gap-2 animate-slide-in-up" onClick={(e) => e.stopPropagation()}>
            {moreItems.map((id) => (
              <button
                key={id}
                onClick={() => {
                  setActiveModule(id);
                  setMoreOpen(false);
                }}
                className={cn(
                  'flex flex-col items-center gap-1 p-2 rounded-xl text-xs transition-colors',
                  activeModule === id
                    ? 'bg-bg-active text-accent-blue'
                    : 'text-text-tertiary hover:text-text-secondary hover:bg-bg-hover'
                )}
              >
                <span className="text-sm font-medium">{moreLabels[id]}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Bottom nav */}
      <nav className="md:hidden mobile-bottom-nav items-center justify-around">
        {primaryItems.map((item) => {
          const isActive = activeModule === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveModule(item.id)}
              className={cn(
                'flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors',
                isActive ? 'text-accent-blue' : 'text-text-tertiary'
              )}
            >
              <item.icon size={20} />
              <span className="text-[10px] leading-tight font-medium">{item.label}</span>
            </button>
          );
        })}
        <button
          onClick={() => setMoreOpen(!moreOpen)}
          className={cn(
            'flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors',
            moreOpen ? 'text-accent-blue' : 'text-text-tertiary'
          )}
        >
          <MoreHorizontal size={20} />
          <span className="text-[10px] leading-tight font-medium">More</span>
        </button>
      </nav>
    </>
  );
}
