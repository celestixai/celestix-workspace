import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  LayoutDashboard,
  Plus,
  Search,
  Star,
  MoreHorizontal,
  Copy,
  Trash2,
  Pencil,
} from 'lucide-react';
import { cn, formatRelativeTime } from '@/lib/utils';
import { api } from '@/lib/api';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useDashboards,
  useCreateDashboard,
  useDeleteDashboard,
  useDuplicateDashboard,
} from '@/hooks/useDashboards';
import type { CustomDashboard } from '@/hooks/useDashboards';
import { DashboardView } from './DashboardView';

export function DashboardsPage() {
  // Workspace
  const { data: workspaces } = useQuery({
    queryKey: ['workspaces'],
    queryFn: async () => {
      const { data } = await api.get('/workspace');
      return data.data;
    },
  });
  const workspaceId: string | undefined = workspaces?.[0]?.id;

  // Data
  const { data: dashboards, isLoading } = useDashboards(workspaceId);
  const createDashboard = useCreateDashboard(workspaceId);

  // UI
  const [searchQuery, setSearchQuery] = useState('');
  const [activeDashboardId, setActiveDashboardId] = useState<string | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  // Filter
  const filtered = useMemo(() => {
    let list = dashboards ?? [];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (d) =>
          d.name.toLowerCase().includes(q) ||
          d.description?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [dashboards, searchQuery]);

  const handleCreate = () => {
    createDashboard.mutate(
      { name: 'Untitled Dashboard' },
      {
        onSuccess: (dashboard) => {
          setActiveDashboardId(dashboard.id);
        },
      }
    );
  };

  // If viewing a specific dashboard
  if (activeDashboardId) {
    return (
      <DashboardView
        dashboardId={activeDashboardId}
        onBack={() => setActiveDashboardId(null)}
      />
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border-primary">
        <div className="flex items-center gap-3">
          <LayoutDashboard size={20} className="text-accent-blue" />
          <h1 className="text-lg font-semibold text-text-primary">Dashboards</h1>
          {dashboards && (
            <span className="text-xs text-text-tertiary bg-bg-tertiary px-2 py-0.5 rounded-full">
              {dashboards.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search
              size={14}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-tertiary"
            />
            <input
              type="text"
              placeholder="Search dashboards..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-48 h-8 pl-8 pr-3 rounded-lg bg-bg-tertiary border border-border-primary text-text-primary text-xs placeholder:text-text-tertiary focus:outline-none focus:border-accent-blue"
            />
          </div>

          {/* Create */}
          <button
            onClick={handleCreate}
            disabled={createDashboard.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-accent-blue text-white hover:bg-accent-blue/90 transition-colors disabled:opacity-50"
          >
            <Plus size={14} />
            Create Dashboard
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <DashboardListSkeleton />
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-60 text-text-tertiary">
            <LayoutDashboard size={40} className="mb-3 opacity-30" />
            <p className="text-sm font-medium text-text-secondary">
              No dashboards yet
            </p>
            <p className="text-xs mt-1">
              Create a dashboard to visualize your workspace data.
            </p>
            <button
              onClick={handleCreate}
              className="mt-4 px-3 py-1.5 rounded-lg text-xs font-medium bg-accent-blue text-white hover:bg-accent-blue/90 transition-colors"
            >
              Create Dashboard
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((dashboard) => (
              <DashboardGridCard
                key={dashboard.id}
                dashboard={dashboard}
                menuOpen={menuOpenId === dashboard.id}
                onToggleMenu={() =>
                  setMenuOpenId(menuOpenId === dashboard.id ? null : dashboard.id)
                }
                onCloseMenu={() => setMenuOpenId(null)}
                onClick={() => setActiveDashboardId(dashboard.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ==========================================
// Dashboard Grid Card
// ==========================================

function DashboardGridCard({
  dashboard,
  menuOpen,
  onToggleMenu,
  onCloseMenu,
  onClick,
}: {
  dashboard: CustomDashboard;
  menuOpen: boolean;
  onToggleMenu: () => void;
  onCloseMenu: () => void;
  onClick: () => void;
}) {
  const deleteDashboard = useDeleteDashboard(dashboard.id);
  const duplicateDashboard = useDuplicateDashboard(dashboard.id);

  return (
    <button
      onClick={onClick}
      className="relative flex flex-col p-4 rounded-xl bg-bg-secondary border border-border-primary hover:border-border-secondary hover:shadow-md transition-all text-left group"
    >
      {/* Preview area */}
      <div className="w-full h-24 rounded-lg bg-bg-tertiary mb-3 flex items-center justify-center">
        <LayoutDashboard size={24} className="text-text-tertiary/40" />
      </div>

      {/* Info */}
      <div className="flex items-start justify-between gap-2 w-full">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-medium text-text-primary truncate">
              {dashboard.name}
            </p>
            {dashboard.isDefault && (
              <Star size={12} className="text-accent-amber flex-shrink-0 fill-accent-amber" />
            )}
          </div>
          {dashboard.description && (
            <p className="text-[11px] text-text-tertiary truncate mt-0.5">
              {dashboard.description}
            </p>
          )}
        </div>

        {/* Menu button */}
        <div
          className="relative flex-shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleMenu();
            }}
            className="p-1 rounded-md text-text-tertiary hover:text-text-secondary hover:bg-bg-tertiary opacity-0 group-hover:opacity-100 transition-all"
          >
            <MoreHorizontal size={14} />
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={onCloseMenu} />
              <div className="absolute right-0 top-full mt-1 z-50 w-40 rounded-lg bg-bg-tertiary border border-border-primary shadow-lg py-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    duplicateDashboard.mutate();
                    onCloseMenu();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-text-secondary hover:bg-bg-hover transition-colors"
                >
                  <Copy size={12} />
                  Duplicate
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteDashboard.mutate();
                    onCloseMenu();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-accent-red hover:bg-bg-hover transition-colors"
                >
                  <Trash2 size={12} />
                  Delete
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center gap-2 mt-2 text-[11px] text-text-tertiary">
        <span>{dashboard.cards?.length ?? 0} cards</span>
        <span>-</span>
        <span>{formatRelativeTime(dashboard.updatedAt)}</span>
      </div>

      {/* Creator avatar */}
      {dashboard.createdBy && (
        <div className="absolute top-3 right-3">
          {dashboard.createdBy.avatarUrl ? (
            <img
              src={dashboard.createdBy.avatarUrl}
              alt={dashboard.createdBy.displayName}
              className="w-6 h-6 rounded-full border border-border-primary"
            />
          ) : (
            <div className="w-6 h-6 rounded-full bg-accent-blue/20 flex items-center justify-center text-[10px] font-medium text-accent-blue border border-border-primary">
              {dashboard.createdBy.displayName?.charAt(0)?.toUpperCase() ?? '?'}
            </div>
          )}
        </div>
      )}
    </button>
  );
}

// ==========================================
// Skeleton
// ==========================================

function DashboardListSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="flex flex-col p-4 rounded-xl bg-bg-secondary border border-border-primary"
        >
          <Skeleton className="w-full h-24 rounded-lg mb-3" />
          <Skeleton className="h-4 w-3/4 mb-1" />
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-3 w-1/3 mt-2" />
        </div>
      ))}
    </div>
  );
}
