import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useViewsAtLocation } from '@/hooks/useViews';
import { AddViewModal } from '@/components/views/AddViewModal';
import {
  List,
  LayoutGrid,
  Table2,
  Calendar,
  GanttChart,
  Clock,
  BarChart3,
  Activity,
  Users,
  Globe,
  FileText,
  Plus,
  Pin,
} from 'lucide-react';

const VIEW_TYPE_ICONS: Record<string, React.ElementType> = {
  list: List,
  board: LayoutGrid,
  table: Table2,
  calendar: Calendar,
  gantt: GanttChart,
  timeline: Clock,
  workload: BarChart3,
  activity: Activity,
  team: Users,
  embed: Globe,
  form: FileText,
};

interface ViewsBarProps {
  locationType: string;
  locationId: string;
  activeViewId?: string;
  onSelectView: (viewId: string) => void;
  onAddView: () => void;
}

const DEFAULT_TABS = [
  { id: '__default_list', name: 'List', viewType: 'list', isPinned: false },
  { id: '__default_board', name: 'Board', viewType: 'board', isPinned: false },
];

export function ViewsBar({ locationType, locationId, activeViewId, onSelectView, onAddView }: ViewsBarProps) {
  const { data: views } = useViewsAtLocation(locationType, locationId);
  const [showAddModal, setShowAddModal] = useState(false);

  const displayViews = views && views.length > 0 ? views : DEFAULT_TABS;

  // Sort: pinned first, then by position
  const sorted = [...displayViews].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return 0;
  });

  const effectiveActive = activeViewId || sorted[0]?.id;

  return (
    <>
      <div className="flex items-center gap-0.5 border-b border-border-secondary px-4 bg-bg-secondary overflow-x-auto scrollbar-none">
        {sorted.map((view) => {
          const Icon = VIEW_TYPE_ICONS[view.viewType] || List;
          const isActive = view.id === effectiveActive;
          return (
            <button
              key={view.id}
              onClick={() => onSelectView(view.id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 text-xs font-medium whitespace-nowrap transition-colors relative',
                'hover:text-text-primary',
                isActive
                  ? 'text-accent-blue'
                  : 'text-text-tertiary',
              )}
            >
              {view.isPinned && <Pin size={10} className="text-text-tertiary" />}
              <Icon size={14} />
              <span>{view.name}</span>
              {isActive && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent-blue rounded-t" />
              )}
            </button>
          );
        })}

        <button
          onClick={() => {
            setShowAddModal(true);
            onAddView();
          }}
          className="flex items-center gap-1 px-2 py-2 text-xs text-text-tertiary hover:text-text-primary transition-colors"
          aria-label="Add view"
        >
          <Plus size={14} />
        </button>
      </div>

      <AddViewModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        locationType={locationType}
        locationId={locationId}
        onCreated={(viewId) => {
          setShowAddModal(false);
          onSelectView(viewId);
        }}
      />
    </>
  );
}
