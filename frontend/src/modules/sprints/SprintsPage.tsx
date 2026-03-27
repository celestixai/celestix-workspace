import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  Repeat,
  Plus,
  Folder,
  Play,
  CheckCircle2,
  ChevronRight,
  BarChart3,
  FileText,
  Clock,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useSprintFolders,
  useCreateSprintFolder,
  useDeleteSprintFolder,
  useSprints,
  useSprint,
  useCreateSprint,
  useStartSprint,
  useCompleteSprint,
} from '@/hooks/useSprints';
import type { SprintFolder, Sprint, SprintStatus } from '@/hooks/useSprints';
import { SprintBoard } from './SprintBoard';
import { BurndownChart } from './BurndownChart';
import { VelocityChart } from './VelocityChart';
import { SprintReport } from './SprintReport';
import { useSpaces } from '@/hooks/useSpaces';

type Tab = 'board' | 'burndown' | 'velocity' | 'report';

const statusBadge: Record<SprintStatus, { label: string; className: string }> = {
  PLANNING: { label: 'Planning', className: 'bg-gray-500/10 text-gray-400' },
  ACTIVE: { label: 'Active', className: 'bg-green-500/10 text-green-400' },
  COMPLETE: { label: 'Complete', className: 'bg-blue-500/10 text-blue-400' },
  CLOSED: { label: 'Closed', className: 'bg-gray-500/10 text-gray-500' },
};

export function SprintsPage() {
  // Workspace / spaces
  const { data: workspaces } = useQuery({
    queryKey: ['workspaces'],
    queryFn: async () => {
      const { data } = await api.get('/workspace');
      return data.data;
    },
  });
  const workspaceId: string | undefined = workspaces?.[0]?.id;
  const { data: spaces } = useSpaces(workspaceId);
  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(null);
  const spaceId = selectedSpaceId || spaces?.[0]?.id;

  // Folders
  const { data: folders } = useSprintFolders(spaceId);
  const createFolder = useCreateSprintFolder(spaceId);
  const deleteFolder = useDeleteSprintFolder();
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);

  // Sprints
  const { data: sprints } = useSprints(activeFolderId ?? undefined);
  const [selectedSprintId, setSelectedSprintId] = useState<string | null>(null);
  const { data: sprintDetail } = useSprint(selectedSprintId ?? undefined);
  const startSprint = useStartSprint(selectedSprintId ?? undefined);
  const completeSprint = useCompleteSprint(selectedSprintId ?? undefined);

  // Create sprint modal
  const [showCreateSprint, setShowCreateSprint] = useState(false);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newSprintName, setNewSprintName] = useState('');
  const [newSprintGoal, setNewSprintGoal] = useState('');
  const [newSprintStart, setNewSprintStart] = useState('');
  const [newSprintEnd, setNewSprintEnd] = useState('');
  const createSprint = useCreateSprint(activeFolderId ?? undefined);

  // Tab
  const [activeTab, setActiveTab] = useState<Tab>('board');
  const [showReport, setShowReport] = useState(false);

  // Auto-select first folder
  const effectiveFolder = activeFolderId || folders?.[0]?.id || null;
  if (folders && folders.length > 0 && !activeFolderId) {
    // Will be set on next render
  }

  const currentFolder = folders?.find((f) => f.id === (activeFolderId || folders?.[0]?.id));

  const handleCreateFolder = () => {
    if (!newFolderName.trim()) return;
    createFolder.mutate({ name: newFolderName.trim() }, {
      onSuccess: (folder) => {
        setNewFolderName('');
        setShowCreateFolder(false);
        setActiveFolderId(folder.id);
      },
    });
  };

  const handleCreateSprint = () => {
    if (!newSprintName.trim() || !newSprintStart || !newSprintEnd) return;
    createSprint.mutate({
      name: newSprintName.trim(),
      goal: newSprintGoal || undefined,
      startDate: new Date(newSprintStart).toISOString(),
      endDate: new Date(newSprintEnd).toISOString(),
    }, {
      onSuccess: (sprint) => {
        setNewSprintName('');
        setNewSprintGoal('');
        setNewSprintStart('');
        setNewSprintEnd('');
        setShowCreateSprint(false);
        setSelectedSprintId(sprint.id);
      },
    });
  };

  const handleStartSprint = () => {
    if (confirm('Start this sprint? Only one sprint can be active per folder.')) {
      startSprint.mutate();
    }
  };

  const handleCompleteSprint = () => {
    if (confirm('Complete this sprint? Incomplete tasks can be moved to the next sprint.')) {
      completeSprint.mutate({});
    }
  };

  const progressPercent = sprintDetail
    ? sprintDetail.totalTasks > 0
      ? Math.round((sprintDetail.completedTasks / sprintDetail.totalTasks) * 100)
      : 0
    : 0;

  return (
    <div className="flex h-full">
      {/* Left sidebar */}
      <div className="w-64 border-r border-border flex flex-col bg-bg-secondary">
        {/* Space selector */}
        <div className="p-3 border-b border-border">
          <select
            value={spaceId || ''}
            onChange={(e) => {
              setSelectedSpaceId(e.target.value);
              setActiveFolderId(null);
              setSelectedSprintId(null);
            }}
            className="w-full px-2 py-1.5 text-sm bg-bg-primary border border-border rounded-lg text-text-primary"
          >
            {spaces?.map((s: any) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        {/* Folders */}
        <div className="flex-1 overflow-y-auto p-2">
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="text-xs font-medium text-text-secondary uppercase tracking-wide">Sprint Folders</span>
            <button
              onClick={() => setShowCreateFolder(true)}
              className="p-1 rounded hover:bg-bg-tertiary text-text-secondary"
            >
              <Plus size={14} />
            </button>
          </div>

          {showCreateFolder && (
            <div className="mb-2 px-1">
              <input
                autoFocus
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Folder name"
                className="w-full px-2 py-1 text-sm bg-bg-primary border border-border rounded text-text-primary placeholder:text-text-tertiary mb-1"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateFolder();
                  if (e.key === 'Escape') { setShowCreateFolder(false); setNewFolderName(''); }
                }}
              />
              <div className="flex gap-1">
                <button onClick={handleCreateFolder} className="text-xs px-2 py-0.5 bg-accent-blue text-white rounded">
                  Create
                </button>
                <button onClick={() => { setShowCreateFolder(false); setNewFolderName(''); }} className="text-xs px-2 py-0.5 text-text-secondary hover:bg-bg-tertiary rounded">
                  Cancel
                </button>
              </div>
            </div>
          )}

          {folders?.map((folder) => (
            <FolderItem
              key={folder.id}
              folder={folder}
              isActive={folder.id === (activeFolderId || folders?.[0]?.id)}
              onClick={() => {
                setActiveFolderId(folder.id);
                setSelectedSprintId(null);
              }}
              sprints={(activeFolderId || folders?.[0]?.id) === folder.id ? sprints : undefined}
              selectedSprintId={selectedSprintId}
              onSelectSprint={setSelectedSprintId}
              onDelete={() => {
                if (confirm('Delete this folder and unlink all sprints?')) {
                  deleteFolder.mutate(folder.id);
                }
              }}
            />
          ))}

          {(!folders || folders.length === 0) && (
            <div className="text-xs text-text-tertiary text-center py-4">
              No sprint folders yet.
              <br />Create one to get started.
            </div>
          )}
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {sprintDetail ? (
          <>
            {/* Sprint header */}
            <div className="border-b border-border p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-semibold text-text-primary">{sprintDetail.name}</h2>
                  <span className={cn('px-2 py-0.5 text-xs font-medium rounded-full', statusBadge[sprintDetail.status].className)}>
                    {statusBadge[sprintDetail.status].label}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {sprintDetail.status === 'PLANNING' && (
                    <button
                      onClick={handleStartSprint}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
                    >
                      <Play size={14} />
                      Start Sprint
                    </button>
                  )}
                  {sprintDetail.status === 'ACTIVE' && (
                    <button
                      onClick={handleCompleteSprint}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      <CheckCircle2 size={14} />
                      Complete Sprint
                    </button>
                  )}
                  <button
                    onClick={() => setShowReport(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-text-secondary hover:bg-bg-secondary rounded-lg border border-border"
                  >
                    <FileText size={14} />
                    Report
                  </button>
                </div>
              </div>

              {/* Meta row */}
              <div className="flex items-center gap-4 text-xs text-text-secondary mb-2">
                <span className="flex items-center gap-1">
                  <Clock size={12} />
                  {new Date(sprintDetail.startDate).toLocaleDateString()} - {new Date(sprintDetail.endDate).toLocaleDateString()}
                </span>
                {sprintDetail.velocity != null && (
                  <span>Velocity: {Math.round(sprintDetail.velocity * 10) / 10} pts</span>
                )}
                <span>{sprintDetail.totalTasks} tasks</span>
                <span>{sprintDetail.totalPoints} pts committed</span>
              </div>

              {/* Progress bar */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-2 bg-bg-tertiary rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 rounded-full transition-all"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <span className="text-xs font-medium text-text-primary">{progressPercent}%</span>
              </div>

              {sprintDetail.goal && (
                <div className="text-xs text-text-tertiary mt-1.5">Goal: {sprintDetail.goal}</div>
              )}
            </div>

            {/* Tabs */}
            <div className="border-b border-border px-4 flex gap-1">
              {([
                { key: 'board', label: 'Board', icon: Repeat },
                { key: 'burndown', label: 'Burndown', icon: BarChart3 },
                { key: 'velocity', label: 'Velocity', icon: BarChart3 },
              ] as const).map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-2 text-sm border-b-2 -mb-px transition-colors',
                    activeTab === tab.key
                      ? 'border-accent-blue text-accent-blue'
                      : 'border-transparent text-text-secondary hover:text-text-primary'
                  )}
                >
                  <tab.icon size={14} />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-auto p-4">
              {activeTab === 'board' && (
                <SprintBoard sprintId={sprintDetail.id} sprintStatus={sprintDetail.status} />
              )}
              {activeTab === 'burndown' && <BurndownChart sprintId={sprintDetail.id} />}
              {activeTab === 'velocity' && activeFolderId && <VelocityChart folderId={activeFolderId} />}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-text-secondary">
            <Repeat size={48} strokeWidth={1} className="mb-3 text-text-tertiary" />
            <p className="text-sm mb-4">Select a sprint or create one to get started</p>
            {(activeFolderId || folders?.[0]?.id) && (
              <button
                onClick={() => setShowCreateSprint(true)}
                className="flex items-center gap-1.5 px-4 py-2 text-sm bg-accent-blue text-white rounded-lg hover:bg-accent-blue/90"
              >
                <Plus size={14} />
                New Sprint
              </button>
            )}
          </div>
        )}
      </div>

      {/* Create sprint modal */}
      {showCreateSprint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowCreateSprint(false)}>
          <div className="bg-bg-primary rounded-xl shadow-xl w-full max-w-md p-5 border border-border" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-text-primary mb-4">New Sprint</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-text-secondary mb-1">Name</label>
                <input
                  autoFocus
                  value={newSprintName}
                  onChange={(e) => setNewSprintName(e.target.value)}
                  placeholder="Sprint 1"
                  className="w-full px-3 py-1.5 text-sm bg-bg-secondary border border-border rounded-lg text-text-primary"
                />
              </div>
              <div>
                <label className="block text-xs text-text-secondary mb-1">Goal (optional)</label>
                <input
                  value={newSprintGoal}
                  onChange={(e) => setNewSprintGoal(e.target.value)}
                  placeholder="What should this sprint achieve?"
                  className="w-full px-3 py-1.5 text-sm bg-bg-secondary border border-border rounded-lg text-text-primary"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-text-secondary mb-1">Start Date</label>
                  <input
                    type="date"
                    value={newSprintStart}
                    onChange={(e) => {
                      setNewSprintStart(e.target.value);
                      if (!newSprintEnd && e.target.value) {
                        const d = new Date(e.target.value);
                        d.setDate(d.getDate() + (currentFolder?.defaultDuration ?? 14));
                        setNewSprintEnd(d.toISOString().split('T')[0]);
                      }
                    }}
                    className="w-full px-3 py-1.5 text-sm bg-bg-secondary border border-border rounded-lg text-text-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-secondary mb-1">End Date</label>
                  <input
                    type="date"
                    value={newSprintEnd}
                    onChange={(e) => setNewSprintEnd(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm bg-bg-secondary border border-border rounded-lg text-text-primary"
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => setShowCreateSprint(false)}
                className="px-3 py-1.5 text-sm text-text-secondary hover:bg-bg-secondary rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateSprint}
                disabled={!newSprintName.trim() || !newSprintStart || !newSprintEnd}
                className="px-4 py-1.5 text-sm bg-accent-blue text-white rounded-lg hover:bg-accent-blue/90 disabled:opacity-50"
              >
                Create Sprint
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Report modal */}
      {showReport && selectedSprintId && (
        <SprintReport sprintId={selectedSprintId} onClose={() => setShowReport(false)} />
      )}
    </div>
  );
}

// ==========================================
// Folder item with sprint list
// ==========================================

function FolderItem({
  folder,
  isActive,
  onClick,
  sprints,
  selectedSprintId,
  onSelectSprint,
  onDelete,
}: {
  folder: SprintFolder;
  isActive: boolean;
  onClick: () => void;
  sprints?: Sprint[];
  selectedSprintId: string | null;
  onSelectSprint: (id: string) => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(isActive);

  return (
    <div className="mb-1">
      <div
        className={cn(
          'flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer group text-sm',
          isActive ? 'bg-bg-tertiary text-text-primary' : 'text-text-secondary hover:bg-bg-tertiary/50'
        )}
        onClick={() => {
          onClick();
          setExpanded(true);
        }}
      >
        <ChevronRight
          size={14}
          className={cn('transition-transform flex-shrink-0', expanded && 'rotate-90')}
          onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
        />
        <Folder size={14} className="flex-shrink-0" />
        <span className="truncate flex-1">{folder.name}</span>
        <span className="text-[10px] text-text-tertiary">{folder._count.sprints}</span>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-bg-primary text-text-tertiary"
        >
          <Trash2 size={12} />
        </button>
      </div>

      {expanded && sprints && (
        <div className="ml-5 mt-0.5 space-y-0.5">
          {sprints.map((sprint) => (
            <div
              key={sprint.id}
              onClick={() => onSelectSprint(sprint.id)}
              className={cn(
                'flex items-center gap-2 px-2 py-1 rounded cursor-pointer text-xs',
                selectedSprintId === sprint.id
                  ? 'bg-accent-blue/10 text-accent-blue'
                  : 'text-text-secondary hover:bg-bg-tertiary/50'
              )}
            >
              <div className={cn(
                'w-1.5 h-1.5 rounded-full flex-shrink-0',
                sprint.status === 'ACTIVE' ? 'bg-green-400' :
                sprint.status === 'COMPLETE' ? 'bg-blue-400' :
                sprint.status === 'CLOSED' ? 'bg-gray-400' : 'bg-gray-300'
              )} />
              <span className="truncate">{sprint.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
