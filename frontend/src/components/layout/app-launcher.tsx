import { useState } from 'react';
import {
  LayoutDashboard, MessageCircle, Hash, Mail, CalendarDays, CheckSquare,
  FolderOpen, FileText, Users, Video, ClipboardList, Table2, CalendarClock,
  Puzzle, PenTool, PlayCircle, Workflow, Settings, Grid3x3, X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/stores/ui.store';

const apps = [
  { id: 'dashboard' as const, icon: LayoutDashboard, label: 'Home', color: 'text-accent-blue' },
  { id: 'messenger' as const, icon: MessageCircle, label: 'Messenger', color: 'text-accent-violet' },
  { id: 'workspace' as const, icon: Hash, label: 'Workspace', color: 'text-accent-cyan' },
  { id: 'email' as const, icon: Mail, label: 'Email', color: 'text-accent-blue' },
  { id: 'calendar' as const, icon: CalendarDays, label: 'Calendar', color: 'text-accent-emerald' },
  { id: 'tasks' as const, icon: CheckSquare, label: 'Tasks', color: 'text-accent-amber' },
  { id: 'files' as const, icon: FolderOpen, label: 'Files', color: 'text-accent-blue' },
  { id: 'notes' as const, icon: FileText, label: 'Notes', color: 'text-accent-violet' },
  { id: 'contacts' as const, icon: Users, label: 'Contacts', color: 'text-accent-cyan' },
  { id: 'meetings' as const, icon: Video, label: 'Meetings', color: 'text-accent-emerald' },
  { id: 'forms' as const, icon: ClipboardList, label: 'Forms', color: 'text-accent-amber' },
  { id: 'lists' as const, icon: Table2, label: 'Lists', color: 'text-accent-blue' },
  { id: 'bookings' as const, icon: CalendarClock, label: 'Bookings', color: 'text-accent-violet' },
  { id: 'loop' as const, icon: Puzzle, label: 'Loop', color: 'text-accent-cyan' },
  { id: 'whiteboard' as const, icon: PenTool, label: 'Whiteboard', color: 'text-accent-emerald' },
  { id: 'stream' as const, icon: PlayCircle, label: 'Stream', color: 'text-accent-red' },
  { id: 'workflows' as const, icon: Workflow, label: 'Workflows', color: 'text-accent-amber' },
  { id: 'settings' as const, icon: Settings, label: 'Settings', color: 'text-text-secondary' },
];

export function AppLauncher() {
  const [open, setOpen] = useState(false);
  const { activeModule, setActiveModule } = useUIStore();

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="p-2 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-colors flex-shrink-0 focus-visible:outline-2 focus-visible:outline-accent-blue"
        aria-label="App launcher"
      >
        <Grid3x3 size={16} />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh]" role="dialog" aria-modal="true" aria-label="App launcher">
          <div className="fixed inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <div className="relative w-[calc(100%-2rem)] max-w-lg bg-bg-secondary border border-border-primary rounded-xl shadow-lg overflow-hidden animate-scale-in">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border-primary">
              <h2 className="text-sm font-semibold text-text-primary">Apps</h2>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-colors focus-visible:outline-2 focus-visible:outline-accent-blue"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-1 p-3 max-h-[60vh] overflow-y-auto">
              {apps.map((app) => {
                const isActive = activeModule === app.id;
                return (
                  <button
                    key={app.id}
                    onClick={() => {
                      setActiveModule(app.id);
                      setOpen(false);
                    }}
                    className={cn(
                      'flex flex-col items-center gap-1.5 p-3 rounded-xl transition-colors',
                      isActive ? 'bg-bg-active' : 'hover:bg-bg-hover'
                    )}
                  >
                    <app.icon size={24} className={app.color} />
                    <span className="text-[11px] text-text-secondary font-medium text-center leading-tight">{app.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
