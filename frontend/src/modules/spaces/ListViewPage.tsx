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
  Check,
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

const PRIORITY_DOT_COLORS: Record<string, string> = {
  urgent: '#EF4444',
  high: '#F97316',
  medium: '#EAB308',
  low: '#3B82F6',
  none: 'rgba(255,255,255,0.20)',
};

function formatDate(dateStr: string | undefined): { label: string; color: string } {
  if (!dateStr) return { label: '', color: '' };
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const diffDays = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    if (diffDays < 0) return { label, color: '#EF4444' };
    if (diffDays === 0) return { label: 'Today', color: '#F59E0B' };
    if (diffDays === 1) return { label: 'Tomorrow', color: '#F59E0B' };
    return { label, color: 'rgba(255,255,255,0.40)' };
  } catch {
    return { label: String(dateStr), color: 'rgba(255,255,255,0.40)' };
  }
}

// Custom checkbox
function TaskCheckbox({ checked, onChange, indeterminate }: { checked: boolean; onChange: () => void; indeterminate?: boolean }) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onChange();
      }}
      className="flex items-center justify-center flex-shrink-0 transition-all duration-100"
      style={{
        width: 14,
        height: 14,
        borderRadius: 3,
        border: checked ? 'none' : '1px solid rgba(255,255,255,0.20)',
        background: checked ? '#2563EB' : 'transparent',
        cursor: 'pointer',
      }}
    >
      {checked && <Check size={10} style={{ color: '#ffffff' }} strokeWidth={3} />}
      {indeterminate && !checked && (
        <span style={{ width: 8, height: 2, background: 'rgba(255,255,255,0.40)', borderRadius: 1, display: 'block' }} />
      )}
    </button>
  );
}

// Status pill (same design as ListView)
const STATUS_PILL_STYLES: Record<string, { bg: string; color: string }> = {
  BACKLOG: { bg: 'rgba(161,161,170,0.10)', color: '#A1A1AA' },
  TODO: { bg: 'rgba(161,161,170,0.10)', color: '#A1A1AA' },
  IN_PROGRESS: { bg: 'rgba(59,130,246,0.12)', color: '#60A5FA' },
  REVIEW: { bg: 'rgba(139,92,246,0.12)', color: '#8B5CF6' },
  DONE: { bg: 'rgba(34,197,94,0.12)', color: '#22C55E' },
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
        <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'rgba(37,99,235,0.3)', borderTopColor: '#2563EB' }} />
      </div>
    );
  }

  if (!list) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ color: 'rgba(255,255,255,0.40)', fontSize: 14 }}>
        List not found
      </div>
    );
  }

  const allSelected = tasks ? selectedIds.size === tasks.length && tasks.length > 0 : false;
  const someSelected = selectedIds.size > 0 && !allSelected;

  return (
    <div className="flex-1 overflow-auto" style={{ padding: 24 }}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <List size={18} style={{ color: 'rgba(255,255,255,0.40)' }} />
        <h2 style={{ fontSize: 20, fontWeight: 600, color: '#ffffff' }}>{list.name}</h2>
        {tasks && (
          <span style={{ fontSize: 12, fontFamily: 'monospace', color: 'rgba(255,255,255,0.40)' }}>
            {tasks.length} tasks
          </span>
        )}
        {customFields && customFields.length > 0 && (
          <button
            onClick={() => setShowFields((prev) => !prev)}
            className="flex items-center gap-1.5"
            style={{
              fontSize: 12,
              padding: '4px 10px',
              borderRadius: 8,
              border: showFields ? '1px solid rgba(37,99,235,0.30)' : '1px solid rgba(255,255,255,0.08)',
              color: showFields ? '#60A5FA' : 'rgba(255,255,255,0.40)',
              background: showFields ? 'rgba(37,99,235,0.10)' : 'transparent',
              transition: 'all 100ms',
            }}
          >
            <Columns3 size={12} />
            Fields
            <span style={{ fontSize: 10, opacity: 0.7 }}>{customFields.length}</span>
          </button>
        )}
        {onOpenSettings && (
          <button
            onClick={() => onOpenSettings(listId)}
            className="ml-auto flex items-center justify-center transition-colors"
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              color: 'rgba(255,255,255,0.40)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
              e.currentTarget.style.color = 'rgba(255,255,255,0.65)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'rgba(255,255,255,0.40)';
            }}
            aria-label="List settings"
          >
            <Settings size={16} />
          </button>
        )}
      </div>

      {/* Status bar */}
      {statuses && statuses.length > 0 && (
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          {statuses.map((s) => {
            const presetStyle = STATUS_PILL_STYLES[s.name?.toUpperCase()];
            return (
              <span
                key={s.id}
                className="inline-flex items-center gap-1"
                style={{
                  fontSize: 10,
                  padding: '1px 8px',
                  borderRadius: 9999,
                  color: presetStyle?.color ?? s.color,
                  background: presetStyle?.bg ?? `${s.color}18`,
                }}
              >
                <Circle size={6} style={{ fill: s.color }} />
                {s.name}
              </span>
            );
          })}
        </div>
      )}

      {/* Tasks list */}
      {loadingTasks ? (
        <div className="space-y-px">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="animate-pulse" style={{ height: 36, background: 'rgba(255,255,255,0.02)' }} />
          ))}
        </div>
      ) : !tasks || tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <CheckCircle2 size={32} className="mb-3" style={{ color: 'rgba(255,255,255,0.15)' }} />
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.40)' }}>No tasks in this list</p>
          <p style={{ fontSize: 12, marginTop: 4, color: 'rgba(255,255,255,0.25)' }}>Add tasks to start tracking your work</p>
        </div>
      ) : (
        <div>
          {/* Column Header Row */}
          <div
            className="flex items-center sticky top-0 z-10"
            style={{
              height: 28,
              borderBottom: '1px solid rgba(255,255,255,0.04)',
              background: '#09090B',
              marginBottom: 1,
            }}
          >
            <div className="flex items-center justify-center flex-shrink-0" style={{ width: 32 }}>
              <TaskCheckbox
                checked={allSelected}
                indeterminate={someSelected}
                onChange={toggleSelectAll}
              />
            </div>
            <span
              className="flex-1"
              style={{
                fontSize: 11,
                fontWeight: 500,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: 'rgba(255,255,255,0.20)',
              }}
            >
              Title
            </span>
            <span
              className="text-center flex-shrink-0"
              style={{
                width: 80,
                fontSize: 11,
                fontWeight: 500,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: 'rgba(255,255,255,0.20)',
              }}
            >
              Priority
            </span>
            <span
              className="text-center flex-shrink-0"
              style={{
                width: 100,
                fontSize: 11,
                fontWeight: 500,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: 'rgba(255,255,255,0.20)',
              }}
            >
              Status
            </span>
          </div>

          {tasks.map((task, index) => {
            const isSelected = selectedIds.has(task.id);
            const dateInfo = formatDate(task.dueDate);

            return (
              <div
                key={task.id}
                className="flex items-center transition-colors duration-100 group"
                style={{
                  height: 36,
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                  background: isSelected ? 'rgba(37,99,235,0.06)' : 'transparent',
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) e.currentTarget.style.background = 'transparent';
                }}
              >
                {/* Checkbox */}
                <div className="flex items-center justify-center flex-shrink-0" style={{ width: 32 }}>
                  <TaskCheckbox
                    checked={isSelected}
                    onChange={() => toggleSelect(task.id, index, false)}
                  />
                </div>

                {/* Task type icon */}
                {(() => {
                  const tt = taskTypes?.find((t) => t.id === task.taskTypeId);
                  const IconComp = tt?.icon ? TASK_TYPE_ICON_MAP[tt.icon] : null;
                  if (IconComp) {
                    return <IconComp size={14} style={{ color: tt?.color || undefined }} className="flex-shrink-0 mr-2" />;
                  }
                  return <Circle size={14} style={{ color: 'rgba(255,255,255,0.20)' }} className="flex-shrink-0 mr-2" />;
                })()}

                {/* Custom task ID */}
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
                    className="flex-shrink-0 mr-2 transition-colors"
                    style={{
                      fontFamily: 'monospace',
                      fontSize: 12,
                      color: 'rgba(255,255,255,0.40)',
                      padding: '1px 6px',
                      borderRadius: 3,
                      background: 'rgba(255,255,255,0.04)',
                    }}
                    title="Click to copy"
                  >
                    {task.customTaskId}
                  </button>
                )}

                {/* Title */}
                <span
                  className="flex-1 truncate"
                  style={{ fontSize: 14, fontFamily: 'Inter, sans-serif', color: '#ffffff' }}
                >
                  {task.title}
                </span>

                {/* Tag chips */}
                {task.tags && task.tags.length > 0 && (
                  <div className="flex items-center gap-1 flex-shrink-0 mr-2">
                    {task.tags.slice(0, 3).map((tag) => (
                      <span
                        key={tag.id}
                        className="whitespace-nowrap"
                        style={{
                          fontSize: 9,
                          padding: '1px 6px',
                          borderRadius: 9999,
                          fontWeight: 500,
                          backgroundColor: tag.color + '20',
                          color: tag.color,
                        }}
                      >
                        {tag.name}
                      </span>
                    ))}
                    {task.tags.length > 3 && (
                      <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.40)' }}>+{task.tags.length - 3}</span>
                    )}
                  </div>
                )}

                {/* Watching indicator */}
                {task.isWatching && (
                  <span title="You are watching this task" className="flex-shrink-0 mr-1">
                    <Eye size={12} style={{ color: '#3B82F6' }} />
                  </span>
                )}

                {/* Recurring indicator */}
                {task.isRecurring && (
                  <span title="Recurring task" className="flex-shrink-0 mr-1">
                    <Repeat size={12} style={{ color: '#3B82F6' }} />
                  </span>
                )}

                {/* Relationship indicator */}
                {task.relationships && (
                  (task.relationships.blocking?.length > 0 ||
                   task.relationships.waitingOn?.length > 0 ||
                   task.relationships.linkedTo?.length > 0) && (
                    <span title="Has relationships" className="flex-shrink-0 mr-1">
                      <Link2 size={12} style={{ color: '#3B82F6' }} />
                    </span>
                  )
                )}

                {/* Dependency warning indicator */}
                {task.dependencyWarnings && task.dependencyWarnings.length > 0 && (
                  <span title={task.dependencyWarnings.map((w) => w.message).join(', ')} className="flex-shrink-0 mr-1">
                    <AlertTriangle size={12} style={{ color: '#F97316' }} />
                  </span>
                )}

                {/* Time estimate indicator */}
                {(task.timeEstimate || task.estimatedMinutes) && (
                  <span
                    className="flex items-center gap-1 flex-shrink-0 mr-2"
                    style={{ fontSize: 10, fontFamily: 'monospace', color: 'rgba(255,255,255,0.40)' }}
                    title="Time estimate"
                  >
                    <Clock size={10} />
                    {(() => {
                      const est = task.timeEstimate ?? task.estimatedMinutes ?? 0;
                      const tracked = task.totalMinutes ?? 0;
                      const h = Math.floor(est / 60);
                      const m = est % 60;
                      const label = h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ''}` : `${m}m`;
                      if (tracked > 0 && est > 0) {
                        const pct = Math.round((tracked / est) * 100);
                        return <>{label} <span style={{ color: pct >= 100 ? '#EF4444' : '#22C55E' }}>{pct}%</span></>;
                      }
                      return label;
                    })()}
                  </span>
                )}

                {showFields && customFields && customFields.length > 0 && (
                  <TaskFieldValues taskId={task.id} fields={customFields} />
                )}

                {/* Priority dot */}
                <div className="flex items-center justify-center flex-shrink-0" style={{ width: 80 }}>
                  {task.priority && task.priority !== 'none' ? (
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: PRIORITY_DOT_COLORS[task.priority] || 'rgba(255,255,255,0.20)',
                        display: 'inline-block',
                      }}
                      title={task.priority}
                    />
                  ) : (
                    <span style={{ color: 'rgba(255,255,255,0.20)', fontSize: 11 }}>--</span>
                  )}
                </div>

                {/* Status pill */}
                {task.status && (
                  <div className="flex items-center justify-center flex-shrink-0" style={{ width: 100 }}>
                    {(() => {
                      const key = task.status.toUpperCase().replace(/\s+/g, '_');
                      const presetStyle = STATUS_PILL_STYLES[key];
                      return (
                        <span
                          style={{
                            height: 20,
                            borderRadius: 9999,
                            padding: '0 8px',
                            fontSize: 11,
                            fontWeight: 500,
                            color: presetStyle?.color ?? '#A1A1AA',
                            background: presetStyle?.bg ?? 'rgba(161,161,170,0.10)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {task.status.replace('_', ' ')}
                        </span>
                      );
                    })()}
                  </div>
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
