import { useState, useMemo } from 'react';
import { Target, Plus, LayoutGrid, List, Search } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { useGoals, useGoalFolders } from '@/hooks/useGoals';
import type { Goal } from '@/hooks/useGoals';
import { GoalFolderSidebar } from './GoalFolderSidebar';
import { GoalCard } from './GoalCard';
import { GoalDetail } from './GoalDetail';
import { CreateGoalModal } from './CreateGoalModal';

type ViewMode = 'grid' | 'list';

export function GoalsPage() {
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
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const { data: folders } = useGoalFolders(workspaceId);
  const { data: goals, isLoading } = useGoals(workspaceId, activeFolderId ?? undefined);

  // UI state
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);

  // Filter
  const filtered = useMemo(() => {
    let list = goals ?? [];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((g) => g.name.toLowerCase().includes(q) || g.description?.toLowerCase().includes(q));
    }
    return list;
  }, [goals, searchQuery]);

  const handleGoalClick = (goal: Goal) => {
    setSelectedGoalId(goal.id);
  };

  return (
    <div className="flex-1 flex h-full overflow-hidden">
      {/* Sidebar */}
      <GoalFolderSidebar
        workspaceId={workspaceId}
        folders={folders ?? []}
        activeFolderId={activeFolderId}
        onSelectFolder={setActiveFolderId}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-primary">
          <div className="flex items-center gap-3">
            <Target size={20} className="text-accent-blue" />
            <h1 className="text-lg font-semibold text-text-primary">Goals</h1>
            {goals && (
              <span className="text-xs text-text-tertiary bg-bg-tertiary px-2 py-0.5 rounded-full">
                {goals.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-tertiary" />
              <input
                type="text"
                placeholder="Search goals..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-48 h-8 pl-8 pr-3 rounded-lg bg-bg-tertiary border border-border-primary text-text-primary text-xs placeholder:text-text-tertiary focus:outline-none focus:border-accent-blue"
              />
            </div>

            {/* View toggle */}
            <div className="flex items-center gap-0.5 bg-bg-tertiary rounded-lg p-0.5">
              <button
                onClick={() => setViewMode('grid')}
                className={cn(
                  'p-1.5 rounded-md transition-colors',
                  viewMode === 'grid'
                    ? 'bg-bg-secondary text-text-primary shadow-sm'
                    : 'text-text-tertiary hover:text-text-secondary'
                )}
                aria-label="Grid view"
              >
                <LayoutGrid size={14} />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={cn(
                  'p-1.5 rounded-md transition-colors',
                  viewMode === 'list'
                    ? 'bg-bg-secondary text-text-primary shadow-sm'
                    : 'text-text-tertiary hover:text-text-secondary'
                )}
                aria-label="List view"
              >
                <List size={14} />
              </button>
            </div>

            {/* Create button */}
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-accent-blue text-white hover:bg-accent-blue/90 transition-colors"
            >
              <Plus size={14} />
              Create Goal
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-40">
              <div className="w-8 h-8 border-2 border-accent-blue/30 border-t-accent-blue rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-60 text-text-tertiary">
              <Target size={40} className="mb-3 opacity-30" />
              <p className="text-sm font-medium text-text-secondary">No goals yet</p>
              <p className="text-xs mt-1">Create a goal to start tracking progress.</p>
              <button
                onClick={() => setShowCreate(true)}
                className="mt-4 px-3 py-1.5 rounded-lg text-xs font-medium bg-accent-blue text-white hover:bg-accent-blue/90 transition-colors"
              >
                Create Goal
              </button>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((goal) => (
                <GoalCard key={goal.id} goal={goal} onClick={handleGoalClick} />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((goal) => (
                <button
                  key={goal.id}
                  onClick={() => handleGoalClick(goal)}
                  className="w-full flex items-center gap-4 p-3 rounded-xl bg-bg-secondary border border-border-primary hover:border-border-secondary hover:shadow-md transition-all text-left"
                >
                  <span
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: goal.color || 'var(--accent-blue)' }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">{goal.name}</p>
                    {goal.description && (
                      <p className="text-[11px] text-text-tertiary truncate">{goal.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-text-tertiary">
                      {goal.targets?.length ?? 0} target{(goal.targets?.length ?? 0) !== 1 ? 's' : ''}
                    </span>
                    <div className="w-24 h-2 bg-bg-tertiary rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${goal.progress ?? 0}%`,
                          backgroundColor: goal.color || 'var(--accent-blue)',
                        }}
                      />
                    </div>
                    <span className="text-xs font-medium text-text-primary w-8 text-right">
                      {goal.progress ?? 0}%
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create modal */}
      {showCreate && workspaceId && (
        <CreateGoalModal
          workspaceId={workspaceId}
          folders={folders ?? []}
          defaultFolderId={activeFolderId}
          onClose={() => setShowCreate(false)}
        />
      )}

      {/* Detail modal */}
      {selectedGoalId && (
        <GoalDetail
          goalId={selectedGoalId}
          onClose={() => setSelectedGoalId(null)}
          onDeleted={() => setSelectedGoalId(null)}
        />
      )}
    </div>
  );
}
