import { useState, useCallback, useRef, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useList, useListStatuses } from '@/hooks/useLists';
import { useCustomFieldsAtLocation } from '@/hooks/useCustomFields';
import { useTaskTypes } from '@/hooks/useTaskTypes';
import { cn } from '@/lib/utils';
import {
  List,
  CheckCircle2,
  CheckSquare,
  Bug,
  Star,
  Circle,
  Clock,
  Flag,
  Settings,
  Columns3,
  Link2,
  AlertTriangle,
  Repeat,
  Eye,
} from 'lucide-react';
import { TaskFieldValues } from '@/modules/custom-fields/TaskFieldValues';
import { BulkActionToolbar } from '@/components/shared/BulkActionToolbar';

interface ListViewPageProps {
  listId: string;
  onOpenSettings?: (listId: string) => void;
}

interface Task {
  id: string;
  title: string;
  status: string;
  priority: string;
  assignees?: { id: string; displayName: string; avatarUrl?: string }[];
  dueDate?: string;
  taskTypeId?: string;
  customTaskId?: string;
  isRecurring?: boolean;
  relationships?: {
    blocking: unknown[];
    waitingOn: unknown[];
    linkedTo: unknown[];
  };
  dependencyWarnings?: { severity: string; message: string }[];
  isWatching?: boolean;
  tags?: { id: string; name: string; color: string }[];
  timeEstimate?: number | null;
  estimatedMinutes?: number | null;
  totalMinutes?: number;
}

const TASK_TYPE_ICON_MAP: Record<string, React.ElementType> = {
  'check-square': CheckSquare,
  bug: Bug,
  star: Star,
  flag: Flag,
};

const priorityColors: Record<string, string> = {
  urgent: 'text-accent-red',
  high: 'text-orange-400',
  medium: 'text-yellow-400',
  low: 'text-blue-400',
  none: 'text-text-tertiary',
};

const priorityIcons: Record<string, number> = {
  urgent: 4,
  high: 3,
  medium: 2,
  low: 1,
  none: 0,
};

export function ListViewPage({ listId, onOpenSettings }: ListViewPageProps) {
  const queryClient = useQueryClient();
  const { data: list, isLoading: loadingList } = useList(listId);
  const { data: statuses } = useListStatuses(listId);
  const { data: customFields } = useCustomFieldsAtLocation('LIST', listId);
  const spaceId = (list as any)?.spaceId as string | undefined;
  const { data: taskTypes } = useTaskTypes(spaceId);
  const [showFields, setShowFields] = useState(true);

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const lastClickedIndex = useRef<number | null>(null);

  const { data: tasks, isLoading: loadingTasks } = useQuery<Task[]>({
    queryKey: ['tasks', 'list', listId],
    queryFn: async () => {
      const { data } = await api.get(`/task-lists/${listId}/tasks`);
      return data.data ?? data;
    },
    enabled: !!listId,
  });

  // Clear selection when list changes
  useEffect(() => {
    setSelectedIds(new Set());
    lastClickedIndex.current = null;
  }, [listId]);

  // Escape key deselects all
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedIds.size > 0) {
        setSelectedIds(new Set());
        lastClickedIndex.current = null;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedIds.size]);

  const toggleSelect = useCallback(
    (taskId: string, index: number, shiftKey: boolean) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);

        if (shiftKey && lastClickedIndex.current !== null && tasks) {
          // Range selection
          const start = Math.min(lastClickedIndex.current, index);
          const end = Math.max(lastClickedIndex.current, index);
          for (let i = start; i <= end; i++) {
            next.add(tasks[i].id);
          }
        } else {
          if (next.has(taskId)) {
            next.delete(taskId);
          } else {
            next.add(taskId);
          }
        }

        lastClickedIndex.current = index;
        return next;
      });
    },
    [tasks],
  );

  const toggleSelectAll = useCallback(() => {
    if (!tasks) return;
    setSelectedIds((prev) => {
      if (prev.size === tasks.length) {
        return new Set();
      }
      return new Set(tasks.map((t) => t.id));
    });
  }, [tasks]);

  const handleClearSelection = useCallback(() => {
    setSelectedIds(new Set());
    lastClickedIndex.current = null;
  }, []);

  const handleActionComplete = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['tasks', 'list', listId] });
  }, [queryClient, listId]);

  if (loadingList) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-accent-blue/30 border-t-accent-blue rounded-full animate-spin" />
      </div>
    );
  }

  if (!list) {
    return (
      <div className="flex-1 flex items-center justify-center text-text-tertiary text-sm">
        List not found
      </div>
    );
  }

  const allSelected = tasks ? selectedIds.size === tasks.length && tasks.length > 0 : false;
  const someSelected = selectedIds.size > 0 && !allSelected;

  return (
    <div className="flex-1 overflow-auto p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <List size={18} className="text-text-tertiary" />
        <h2 className="text-xl font-semibold text-text-primary">{list.name}</h2>
        {tasks && (
          <span className="text-xs text-text-tertiary">{tasks.length} tasks</span>
        )}
        {customFields && customFields.length > 0 && (
          <button
            onClick={() => setShowFields((prev) => !prev)}
            className={cn(
              'flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border transition-colors',
              showFields
                ? 'text-accent-blue border-accent-blue/30 bg-accent-blue/10'
                : 'text-text-tertiary border-border-secondary hover:text-text-primary hover:bg-bg-hover'
            )}
          >
            <Columns3 size={12} />
            Fields
            <span className="text-[10px] opacity-70">{customFields.length}</span>
          </button>
        )}
        {onOpenSettings && (
          <button
            onClick={() => onOpenSettings(listId)}
            className="ml-auto p-1.5 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-colors"
            aria-label="List settings"
          >
            <Settings size={16} />
          </button>
        )}
      </div>

      {/* Status bar */}
      {statuses && statuses.length > 0 && (
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          {statuses.map((s) => (
            <span
              key={s.id}
              className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border border-border-secondary"
              style={{ color: s.color }}
            >
              <Circle size={6} style={{ fill: s.color }} />
              {s.name}
            </span>
          ))}
        </div>
      )}

      {/* Tasks list */}
      {loadingTasks ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-10 bg-bg-tertiary rounded-lg animate-pulse" />
          ))}
        </div>
      ) : !tasks || tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-text-tertiary">
          <CheckCircle2 size={32} className="mb-3 opacity-40" />
          <p className="text-sm">No tasks in this list</p>
          <p className="text-xs mt-1 opacity-70">Add tasks to start tracking your work</p>
        </div>
      ) : (
        <div className="space-y-1">
          {/* Select All header row */}
          <div className="flex items-center gap-3 px-3 py-1.5 text-xs text-text-tertiary border-b border-border-secondary mb-1">
            <input
              type="checkbox"
              checked={allSelected}
              ref={(el) => {
                if (el) el.indeterminate = someSelected;
              }}
              onChange={toggleSelectAll}
              className="w-3.5 h-3.5 rounded border-border-secondary accent-accent-blue cursor-pointer"
            />
            <span className="flex-1">Title</span>
            <span className="w-16 text-center">Priority</span>
            <span className="w-20 text-center">Status</span>
          </div>
          {tasks.map((task, index) => {
            const isSelected = selectedIds.has(task.id);
            return (
              <div
                key={task.id}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-bg-hover transition-colors group',
                  isSelected && 'bg-accent-blue/5 ring-1 ring-accent-blue/20',
                )}
              >
                {/* Checkbox */}
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={(e) => {
                    // The native event has shiftKey
                    toggleSelect(task.id, index, (e.nativeEvent as MouseEvent).shiftKey);
                  }}
                  className="w-3.5 h-3.5 rounded border-border-secondary accent-accent-blue cursor-pointer flex-shrink-0"
                />
                {(() => {
                  const tt = taskTypes?.find((t) => t.id === task.taskTypeId);
                  const IconComp = tt?.icon ? TASK_TYPE_ICON_MAP[tt.icon] : null;
                  if (IconComp) {
                    return <IconComp size={14} style={{ color: tt?.color || undefined }} className="flex-shrink-0" />;
                  }
                  return <Circle size={16} className="text-text-tertiary flex-shrink-0" />;
                })()}
                {task.customTaskId && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigator.clipboard.writeText(task.customTaskId!);
                      const el = e.currentTarget;
                      const original = el.textContent;
                      el.textContent = 'Copied!';
                      setTimeout(() => { el.textContent = original; }, 1200);
                    }}
                    className="text-[10px] font-mono text-text-tertiary bg-bg-tertiary px-1.5 py-0.5 rounded hover:text-accent-blue hover:bg-accent-blue/10 transition-colors flex-shrink-0"
                    title="Click to copy"
                  >
                    {task.customTaskId}
                  </button>
                )}
                <span className="text-sm text-text-primary flex-1 truncate">{task.title}</span>
                {/* Tag chips */}
                {task.tags && task.tags.length > 0 && (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {task.tags.slice(0, 3).map((tag) => (
                      <span
                        key={tag.id}
                        className="text-[9px] px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap"
                        style={{ backgroundColor: tag.color + '20', color: tag.color }}
                      >
                        {tag.name}
                      </span>
                    ))}
                    {task.tags.length > 3 && (
                      <span className="text-[9px] text-text-tertiary">+{task.tags.length - 3}</span>
                    )}
                  </div>
                )}
                {/* Watching indicator */}
                {task.isWatching && (
                  <span title="You are watching this task">
                    <Eye size={12} className="text-accent-blue flex-shrink-0" />
                  </span>
                )}
                {/* Recurring indicator */}
                {task.isRecurring && (
                  <span title="Recurring task">
                    <Repeat size={12} className="text-accent-blue flex-shrink-0" />
                  </span>
                )}
                {/* Relationship indicator */}
                {task.relationships && (
                  (task.relationships.blocking?.length > 0 ||
                   task.relationships.waitingOn?.length > 0 ||
                   task.relationships.linkedTo?.length > 0) && (
                    <span title="Has relationships">
                      <Link2 size={12} className="text-accent-blue flex-shrink-0" />
                    </span>
                  )
                )}
                {/* Dependency warning indicator */}
                {task.dependencyWarnings && task.dependencyWarnings.length > 0 && (
                  <span title={task.dependencyWarnings.map((w) => w.message).join(', ')}>
                    <AlertTriangle size={12} className="text-orange-400 flex-shrink-0" />
                  </span>
                )}
                {/* Time estimate indicator */}
                {(task.timeEstimate || task.estimatedMinutes) && (
                  <span className="flex items-center gap-1 text-[10px] text-text-tertiary flex-shrink-0" title="Time estimate">
                    <Clock size={10} />
                    {(() => {
                      const est = task.timeEstimate ?? task.estimatedMinutes ?? 0;
                      const tracked = task.totalMinutes ?? 0;
                      const h = Math.floor(est / 60);
                      const m = est % 60;
                      const label = h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ''}` : `${m}m`;
                      if (tracked > 0 && est > 0) {
                        const pct = Math.round((tracked / est) * 100);
                        return <>{label} <span className={pct >= 100 ? 'text-accent-red' : 'text-accent-green'}>{pct}%</span></>;
                      }
                      return label;
                    })()}
                  </span>
                )}
                {showFields && customFields && customFields.length > 0 && (
                  <TaskFieldValues taskId={task.id} fields={customFields} />
                )}
                {task.priority && task.priority !== 'none' && (
                  <Flag
                    size={12}
                    className={cn('flex-shrink-0', priorityColors[task.priority] || 'text-text-tertiary')}
                  />
                )}
                {task.status && (
                  <span className="text-[10px] text-text-tertiary px-1.5 py-0.5 rounded bg-bg-tertiary">
                    {task.status}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Bulk Action Toolbar */}
      <BulkActionToolbar
        selectedTaskIds={Array.from(selectedIds)}
        onClearSelection={handleClearSelection}
        listId={listId}
        spaceId={spaceId}
        onActionComplete={handleActionComplete}
      />
    </div>
  );
}
