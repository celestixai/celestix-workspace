import { useState, useEffect } from 'react';
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
  Filter,
  ArrowUpDown,
  Layers,
  Search,
  MoreHorizontal,
  Monitor,
} from 'lucide-react';

/** View types that are too complex for mobile */
const DESKTOP_ONLY_VIEWS = new Set(['gantt', 'timeline', 'workload']);

function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 768 : false,
  );
  useEffect(() => {
    const mql = window.matchMedia('(max-width: 767px)');
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);
  return isMobile;
}

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
  const isMobile = useIsMobile();

  const displayViews = views && views.length > 0 ? views : DEFAULT_TABS;

  // Sort: pinned first, then by position
  const sorted = [...displayViews].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return 0;
  });

  // D7.8: On mobile, hide Gantt / Timeline / Workload tabs
  const visibleTabs = isMobile
    ? sorted.filter((v) => !DESKTOP_ONLY_VIEWS.has(v.viewType))
    : sorted;

  // Check if user navigated to a desktop-only view on mobile
  const activeView = sorted.find((v) => v.id === activeViewId);
  const isDesktopOnlyActive = isMobile && activeView && DESKTOP_ONLY_VIEWS.has(activeView.viewType);

  const effectiveActive = activeViewId || visibleTabs[0]?.id;

  return (
    <>
      <div
        className="flex items-center overflow-x-auto scrollbar-none"
        style={{
          height: 36,
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          background: '#09090B',
          padding: '0 16px',
          gap: 2,
        }}
      >
        {/* View tabs */}
        {visibleTabs.map((view) => {
          const Icon = VIEW_TYPE_ICONS[view.viewType] || List;
          const isActive = view.id === effectiveActive;
          return (
            <button
              key={view.id}
              onClick={() => onSelectView(view.id)}
              className={cn(
                'flex items-center gap-1.5 whitespace-nowrap',
                'transition-all duration-100',
              )}
              style={{
                padding: '4px 12px',
                fontSize: 13,
                borderRadius: 6,
                fontWeight: isActive ? 500 : 400,
                color: isActive ? '#ffffff' : 'rgba(255,255,255,0.40)',
                background: isActive ? '#2563EB' : 'transparent',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                  e.currentTarget.style.color = 'rgba(255,255,255,0.65)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'rgba(255,255,255,0.40)';
                }
              }}
            >
              {view.isPinned && <Pin size={10} style={{ color: 'rgba(255,255,255,0.40)' }} />}
              <Icon size={14} />
              <span>{view.name}</span>
            </button>
          );
        })}

        {/* + Add view button */}
        <button
          onClick={() => {
            setShowAddModal(true);
            onAddView();
          }}
          className="flex items-center justify-center flex-shrink-0 transition-all duration-100"
          style={{
            width: 28,
            height: 28,
            borderRadius: 6,
            color: 'rgba(255,255,255,0.40)',
            background: 'transparent',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
            e.currentTarget.style.color = 'rgba(255,255,255,0.65)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = 'rgba(255,255,255,0.40)';
          }}
          aria-label="Add view"
        >
          <Plus size={14} />
        </button>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Right side controls */}
        <div className="flex items-center" style={{ gap: 2 }}>
          {[
            { icon: Filter, label: 'Filter' },
            { icon: ArrowUpDown, label: 'Sort' },
            { icon: Layers, label: 'Group' },
          ].map(({ icon: BtnIcon, label }) => (
            <button
              key={label}
              className="flex items-center gap-1 whitespace-nowrap transition-all duration-100"
              style={{
                padding: '4px 10px',
                fontSize: 12,
                borderRadius: 6,
                color: 'rgba(255,255,255,0.40)',
                background: 'transparent',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                e.currentTarget.style.color = 'rgba(255,255,255,0.65)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'rgba(255,255,255,0.40)';
              }}
            >
              <BtnIcon size={12} />
              <span>{label}</span>
            </button>
          ))}

          {/* Search icon */}
          <button
            className="flex items-center justify-center transition-all duration-100"
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              color: 'rgba(255,255,255,0.40)',
              background: 'transparent',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
              e.currentTarget.style.color = 'rgba(255,255,255,0.65)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'rgba(255,255,255,0.40)';
            }}
            aria-label="Search"
          >
            <Search size={14} />
          </button>

          {/* More button */}
          <button
            className="flex items-center justify-center transition-all duration-100"
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              color: 'rgba(255,255,255,0.40)',
              background: 'transparent',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
              e.currentTarget.style.color = 'rgba(255,255,255,0.65)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'rgba(255,255,255,0.40)';
            }}
            aria-label="More options"
          >
            <MoreHorizontal size={14} />
          </button>
        </div>
      </div>

      {/* D7.8: Desktop-only view message */}
      {isDesktopOnlyActive && (
        <div
          className="flex items-center justify-center gap-2 text-sm text-text-tertiary"
          style={{
            padding: '48px 24px',
            textAlign: 'center',
          }}
        >
          <Monitor size={18} style={{ opacity: 0.5 }} />
          <span>This view is available on desktop</span>
        </div>
      )}

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
