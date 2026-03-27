import { useState, useCallback, useRef, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/toast';
import {
  CheckSquare,
  Bug,
  Star,
  Circle,
  Flag,
  Link2,
  ChevronDown,
  ChevronRight,
  Plus,
  MessageSquare,
  AlertTriangle,
  Layers,
  LayoutGrid,
  LayoutList,
} from 'lucide-react';

// -----------------------------------------------
// Types
// -----------------------------------------------

interface Task {
  id: string;
  title: string;
  description?: string;
  status: string;
  statusName?: string;
  statusColor?: string;
  priority: string;
  assignees?: { id: string; displayName: string; avatarUrl?: string }[];
  dueDate?: string;
  taskTypeId?: string;
  taskTypeIcon?: string;
  taskTypeColor?: string;
  customTaskId?: string;
  tags?: { id: string; name: string; color: string }[];
  coverImage?: string;
  coverColor?: string;
  relationships?: {
    blocking: unknown[];
    waitingOn: unknown[];
    linkedTo: unknown[];
  };
  subtaskCount?: number;
  subtasksCompleted?: number;
  checklistTotal?: number;
  checklistCompleted?: number;
  commentCount?: number;
  dependencies?: { resolved: boolean }[];
}

interface TaskGroup {
  name: string;
  value: string;
  count: number;
  tasks: any[];
}

interface StatusDef {
  name: string;
  color: string;
  statusGroup: string;
}

interface BoardViewProps {
  tasks: any[];
  groups?: TaskGroup[];
  isLoading: boolean;
  listId?: string;
  spaceId?: string;
  statuses?: StatusDef[];
  onTaskClick: (taskId: string) => void;
  onRefresh: () => void;
}

type CardSize = 'compact' | 'normal';

// -----------------------------------------------
// Constants
// -----------------------------------------------

const STATUS_GROUP_ORDER: Record<string, number> = {
  NOT_STARTED: 0,
  ACTIVE: 1,
  DONE: 2,
  CLOSED: 3,
};

const TASK_TYPE_ICON_MAP: Record<string, React.ElementType> = {
  'check-square': CheckSquare,
  bug: Bug,
  star: Star,
  flag: Flag,
};

const PRIORITY_DOT_COLORS: Record<string, string> = {
  urgent: 'bg-accent-red',
  high: 'bg-orange-400',
  medium: 'bg-yellow-400',
  low: 'bg-blue-400',
  none: 'bg-text-tertiary',
};

const DEFAULT_STATUSES: StatusDef[] = [
  { name: 'To Do', color: '#6b7280', statusGroup: 'NOT_STARTED' },
  { name: 'In Progress', color: '#3b82f6', statusGroup: 'ACTIVE' },
  { name: 'In Review', color: '#a855f7', statusGroup: 'ACTIVE' },
  { name: 'Done', color: '#22c55e', statusGroup: 'DONE' },
  { name: 'Closed', color: '#6b7280', statusGroup: 'CLOSED' },
];

// -----------------------------------------------
// Helpers
// -----------------------------------------------

function formatDate(dateStr: string | undefined): { label: string; className: string } {
  if (!dateStr) return { label: '', className: '' };
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const diffDays = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    if (diffDays < 0) return { label, className: 'text-accent-red' };
    if (diffDays === 0) return { label: 'Today', className: 'text-orange-400' };
    if (diffDays === 1) return { label: 'Tomorrow', className: 'text-yellow-400' };
    return { label, className: 'text-text-tertiary' };
  } catch {
    return { label: String(dateStr), className: 'text-text-tertiary' };
  }
}

function getFirstLine(text: string | undefined): string {
  if (!text) return '';
  const line = text.split('\n')[0].trim();
  return line.length > 80 ? line.slice(0, 80) + '...' : line;
}

// -----------------------------------------------
// Sub-components
// -----------------------------------------------

/** A single sortable task card */
function SortableTaskCard({
  task,
  cardSize,
  onTaskClick,
}: {
  task: Task;
  cardSize: CardSize;
  onTaskClick: (taskId: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id, data: { type: 'task', task } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        'transition-shadow',
        isDragging && 'opacity-40',
      )}
    >
      <TaskCard task={task} cardSize={cardSize} onClick={() => onTaskClick(task.id)} />
    </div>
  );
}

/** Task card content */
function TaskCard({
  task,
  cardSize,
  onClick,
  isDragOverlay,
}: {
  task: Task;
  cardSize: CardSize;
  onClick?: () => void;
  isDragOverlay?: boolean;
}) {
  const dateInfo = formatDate(task.dueDate);
  const hasUnresolvedDeps = task.dependencies?.some((d) => !d.resolved);
  const hasRelationships =
    task.relationships &&
    ((task.relationships.blocking?.length ?? 0) > 0 ||
      (task.relationships.waitingOn?.length ?? 0) > 0);
  const subtaskTotal = task.subtaskCount ?? 0;
  const subtasksDone = task.subtasksCompleted ?? 0;
  const subtaskPct = subtaskTotal > 0 ? Math.round((subtasksDone / subtaskTotal) * 100) : 0;

  const IconComp = task.taskTypeIcon ? TASK_TYPE_ICON_MAP[task.taskTypeIcon] : null;
  const priorityKey = (task.priority ?? 'none').toLowerCase();

  return (
    <div
      onClick={onClick}
      className={cn(
        'bg-bg-secondary border border-border-secondary rounded-lg cursor-pointer hover:border-border-primary hover:shadow-md transition-all group/card',
        isDragOverlay && 'shadow-xl ring-2 ring-accent-blue/30',
      )}
    >
      {/* Cover strip */}
      {cardSize === 'normal' && (task.coverImage || task.coverColor) && (
        <div
          className="h-1.5 rounded-t-lg"
          style={{
            backgroundColor: task.coverColor || undefined,
            backgroundImage: task.coverImage ? `url(${task.coverImage})` : undefined,
            backgroundSize: 'cover',
          }}
        />
      )}

      <div className="p-2.5 space-y-1.5">
        {/* Row 1: type icon + custom ID */}
        <div className="flex items-center gap-1.5">
          {IconComp ? (
            <IconComp size={12} style={{ color: task.taskTypeColor || undefined }} className="flex-shrink-0" />
          ) : (
            <Circle size={12} className="text-text-tertiary flex-shrink-0" />
          )}
          {task.customTaskId && (
            <span className="text-[9px] font-mono text-text-tertiary bg-bg-tertiary px-1 py-0.5 rounded">
              {task.customTaskId}
            </span>
          )}
          {/* Priority dot */}
          {priorityKey !== 'none' && (
            <span
              className={cn('w-2 h-2 rounded-full flex-shrink-0 ml-auto', PRIORITY_DOT_COLORS[priorityKey] ?? 'bg-text-tertiary')}
              title={`Priority: ${task.priority}`}
            />
          )}
        </div>

        {/* Title */}
        <p className="text-sm font-medium text-text-primary leading-snug line-clamp-2">
          {task.title}
        </p>

        {/* Description preview (normal only) */}
        {cardSize === 'normal' && task.description && (
          <p className="text-[11px] text-text-tertiary leading-tight truncate">
            {getFirstLine(task.description)}
          </p>
        )}

        {/* Tags (normal only) */}
        {cardSize === 'normal' && task.tags && task.tags.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap">
            {task.tags.slice(0, 2).map((tag) => (
              <span
                key={tag.id}
                className="text-[9px] px-1.5 py-0.5 rounded-full font-medium"
                style={{ backgroundColor: tag.color + '20', color: tag.color }}
              >
                {tag.name}
              </span>
            ))}
            {task.tags.length > 2 && (
              <span className="text-[9px] text-text-tertiary">+{task.tags.length - 2}</span>
            )}
          </div>
        )}

        {/* Subtask progress bar (normal only) */}
        {cardSize === 'normal' && subtaskTotal > 0 && (
          <div className="flex items-center gap-1.5">
            <div className="flex-1 h-1 bg-bg-tertiary rounded-full overflow-hidden">
              <div
                className="h-full bg-accent-blue rounded-full transition-all"
                style={{ width: `${subtaskPct}%` }}
              />
            </div>
            <span className="text-[9px] text-text-tertiary">{subtasksDone}/{subtaskTotal}</span>
          </div>
        )}

        {/* Bottom row: assignees, date, metadata */}
        <div className="flex items-center justify-between gap-1 pt-0.5">
          {/* Assignees */}
          <div className="flex items-center -space-x-1.5">
            {(task.assignees ?? []).slice(0, 3).map((a) => (
              <div
                key={a.id}
                className="w-5 h-5 rounded-full bg-accent-blue/20 border border-bg-secondary flex items-center justify-center text-[8px] font-medium text-accent-blue"
                title={a.displayName}
              >
                {a.avatarUrl ? (
                  <img src={a.avatarUrl} alt={a.displayName} className="w-full h-full rounded-full object-cover" />
                ) : (
                  a.displayName?.charAt(0).toUpperCase() ?? '?'
                )}
              </div>
            ))}
            {(task.assignees?.length ?? 0) > 3 && (
              <div className="w-5 h-5 rounded-full bg-bg-tertiary border border-bg-secondary flex items-center justify-center text-[8px] text-text-tertiary">
                +{(task.assignees?.length ?? 0) - 3}
              </div>
            )}
          </div>

          {/* Right side metadata */}
          <div className="flex items-center gap-1.5">
            {/* Checklist progress */}
            {cardSize === 'normal' && (task.checklistTotal ?? 0) > 0 && (
              <span className="text-[9px] text-text-tertiary">
                {task.checklistCompleted ?? 0}/{task.checklistTotal}
              </span>
            )}

            {/* Dependency warning */}
            {cardSize === 'normal' && (hasUnresolvedDeps || hasRelationships) && (
              <AlertTriangle size={10} className="text-orange-400" />
            )}

            {/* Comment count */}
            {cardSize === 'normal' && (task.commentCount ?? 0) > 0 && (
              <span className="flex items-center gap-0.5 text-[9px] text-text-tertiary">
                <MessageSquare size={9} />
                {task.commentCount}
              </span>
            )}

            {/* Due date */}
            {dateInfo.label && (
              <span className={cn('text-[10px]', dateInfo.className)}>
                {dateInfo.label}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Quick-add input at column bottom */
function QuickAddCard({
  listId,
  statusName,
  onCreated,
}: {
  listId?: string;
  statusName: string;
  onCreated: () => void;
}) {
  const [value, setValue] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const createMutation = useMutation({
    mutationFn: async (title: string) => {
      const payload: Record<string, unknown> = { title, statusName };
      if (listId) payload.listId = listId;
      const { data } = await api.post('/tasks', payload);
      return data.data ?? data;
    },
    onSuccess: () => {
      setValue('');
      onCreated();
      toast('Task created', 'success');
    },
    onError: () => {
      toast('Failed to create task', 'error');
    },
  });

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    createMutation.mutate(trimmed);
  };

  if (!isAdding) {
    return (
      <button
        onClick={() => {
          setIsAdding(true);
          setTimeout(() => inputRef.current?.focus(), 50);
        }}
        className="flex items-center gap-1.5 w-full px-2.5 py-2 text-xs text-text-tertiary hover:text-text-secondary hover:bg-bg-hover/50 rounded-lg transition-colors"
      >
        <Plus size={14} />
        Add task
      </button>
    );
  }

  return (
    <div className="px-1">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSubmit();
          if (e.key === 'Escape') {
            setIsAdding(false);
            setValue('');
          }
        }}
        onBlur={() => {
          if (!value.trim()) setIsAdding(false);
        }}
        placeholder="Task name... Enter to save"
        className="w-full text-xs bg-bg-secondary border border-border-secondary focus:border-accent-blue rounded-lg px-2.5 py-2 outline-none text-text-primary placeholder:text-text-tertiary"
        disabled={createMutation.isPending}
      />
    </div>
  );
}

// -----------------------------------------------
// Board Column
// -----------------------------------------------

function BoardColumn({
  statusDef,
  tasks,
  isCollapsed,
  onToggleCollapse,
  cardSize,
  listId,
  onTaskClick,
  onRefresh,
}: {
  statusDef: StatusDef;
  tasks: Task[];
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  cardSize: CardSize;
  listId?: string;
  onTaskClick: (taskId: string) => void;
  onRefresh: () => void;
}) {
  const taskIds = useMemo(() => tasks.map((t) => t.id), [tasks]);

  // Collapsed column: thin vertical bar
  if (isCollapsed) {
    return (
      <div
        onClick={onToggleCollapse}
        className="flex-shrink-0 w-10 bg-bg-secondary border border-border-secondary rounded-xl cursor-pointer hover:bg-bg-hover transition-colors flex flex-col items-center py-3 gap-2 self-stretch"
      >
        <span
          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: statusDef.color }}
        />
        <span className="text-[10px] font-medium text-text-tertiary [writing-mode:vertical-lr] rotate-180">
          {statusDef.name}
        </span>
        <span className="text-[10px] text-text-tertiary bg-bg-tertiary px-1 py-0.5 rounded-full">
          {tasks.length}
        </span>
      </div>
    );
  }

  return (
    <div className="flex-shrink-0 w-[280px] flex flex-col max-h-full bg-bg-primary rounded-xl border border-border-secondary/50">
      {/* Column header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border-secondary/50">
        <button
          onClick={onToggleCollapse}
          className="text-text-tertiary hover:text-text-primary transition-colors"
          title="Collapse column"
        >
          <ChevronDown size={14} />
        </button>
        <span
          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: statusDef.color }}
        />
        <span className="text-xs font-semibold text-text-primary truncate">
          {statusDef.name}
        </span>
        <span className="text-[10px] text-text-tertiary bg-bg-tertiary px-1.5 py-0.5 rounded-full ml-auto">
          {tasks.length}
        </span>
      </div>

      {/* Task list — scrollable */}
      <div className="flex-1 overflow-y-auto min-h-0 p-1.5 space-y-1.5">
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          {tasks.length === 0 ? (
            <div className="py-8 text-center text-[11px] text-text-tertiary">No tasks</div>
          ) : (
            tasks.map((task) => (
              <SortableTaskCard
                key={task.id}
                task={task}
                cardSize={cardSize}
                onTaskClick={onTaskClick}
              />
            ))
          )}
        </SortableContext>
      </div>

      {/* Quick add */}
      <div className="border-t border-border-secondary/50 p-1.5">
        <QuickAddCard listId={listId} statusName={statusDef.name} onCreated={onRefresh} />
      </div>
    </div>
  );
}

// -----------------------------------------------
// Main Component
// -----------------------------------------------

export function BoardView({
  tasks,
  groups,
  isLoading,
  listId,
  spaceId: _spaceId,
  statuses,
  onTaskClick,
  onRefresh,
}: BoardViewProps) {
  const queryClient = useQueryClient();
  const [collapsedCols, setCollapsedCols] = useState<Set<string>>(new Set());
  const [cardSize, setCardSize] = useState<CardSize>('normal');
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  // Build columns from statuses or groups
  const statusList = useMemo(() => {
    if (statuses && statuses.length > 0) {
      return [...statuses].sort(
        (a, b) => (STATUS_GROUP_ORDER[a.statusGroup] ?? 9) - (STATUS_GROUP_ORDER[b.statusGroup] ?? 9),
      );
    }
    return DEFAULT_STATUSES;
  }, [statuses]);

  // Map tasks into columns by status/statusName
  const [columns, setColumns] = useState<Record<string, Task[]>>({});

  // Rebuild columns whenever tasks or groups change
  useMemo(() => {
    const cols: Record<string, Task[]> = {};
    for (const s of statusList) {
      cols[s.name] = [];
    }

    // If pre-grouped, use groups
    if (groups && groups.length > 0) {
      for (const g of groups) {
        const key = statusList.find(
          (s) => s.name.toLowerCase() === g.name.toLowerCase() || s.name.toLowerCase() === g.value.toLowerCase(),
        )?.name;
        if (key) {
          cols[key] = (g.tasks as Task[]) ?? [];
        } else {
          // Unknown status — put into first column
          const fallback = statusList[0]?.name;
          if (fallback) {
            cols[fallback] = [...(cols[fallback] || []), ...(g.tasks as Task[])];
          }
        }
      }
    } else {
      // Build from flat tasks array
      for (const task of tasks as Task[]) {
        const statusKey = task.statusName || task.status;
        const matchedStatus = statusList.find(
          (s) => s.name.toLowerCase() === (statusKey ?? '').toLowerCase(),
        );
        const colName = matchedStatus?.name ?? statusList[0]?.name ?? 'To Do';
        if (!cols[colName]) cols[colName] = [];
        cols[colName].push(task);
      }
    }
    setColumns(cols);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, groups, statusList]);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  // Update task status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ taskId, statusName }: { taskId: string; statusName: string }) => {
      const { data } = await api.patch(`/tasks/${taskId}`, { statusName });
      return data.data ?? data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['viewQuery'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      onRefresh();
    },
    onError: () => {
      toast('Failed to update task status', 'error');
    },
  });

  // Find which column a task belongs to
  const findColumn = useCallback(
    (taskId: string): string | null => {
      for (const [colName, colTasks] of Object.entries(columns)) {
        if (colTasks.some((t) => t.id === taskId)) return colName;
      }
      return null;
    },
    [columns],
  );

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const { active } = event;
      const taskId = active.id as string;
      // Find the task in columns
      for (const colTasks of Object.values(columns)) {
        const found = colTasks.find((t) => t.id === taskId);
        if (found) {
          setActiveTask(found);
          break;
        }
      }
    },
    [columns],
  );

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { active, over } = event;
      if (!over) return;

      const activeId = active.id as string;
      const overId = over.id as string;

      const activeCol = findColumn(activeId);
      // overId could be a task ID or a column-droppable ID
      let overCol = findColumn(overId);
      // If not found as task, check if it's a column name itself (from SortableContext)
      if (!overCol) {
        // Check if overId is a status name
        if (columns[overId] !== undefined) {
          overCol = overId;
        }
      }

      if (!activeCol || !overCol || activeCol === overCol) return;

      // Move task between columns (optimistic)
      setColumns((prev) => {
        const newCols = { ...prev };
        const sourceItems = [...(newCols[activeCol] || [])];
        const destItems = [...(newCols[overCol!] || [])];

        const activeIndex = sourceItems.findIndex((t) => t.id === activeId);
        if (activeIndex === -1) return prev;

        const [movedTask] = sourceItems.splice(activeIndex, 1);

        // Find insertion index in destination
        const overIndex = destItems.findIndex((t) => t.id === overId);
        if (overIndex >= 0) {
          destItems.splice(overIndex, 0, movedTask);
        } else {
          destItems.push(movedTask);
        }

        newCols[activeCol] = sourceItems;
        newCols[overCol!] = destItems;
        return newCols;
      });
    },
    [findColumn, columns],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveTask(null);

      if (!over) return;

      const activeId = active.id as string;
      const overId = over.id as string;

      const activeCol = findColumn(activeId);
      if (!activeCol) return;

      // Reorder within same column
      if (activeId !== overId) {
        const overCol = findColumn(overId) ?? activeCol;
        if (activeCol === overCol) {
          setColumns((prev) => {
            const newCols = { ...prev };
            const items = [...(newCols[activeCol] || [])];
            const oldIndex = items.findIndex((t) => t.id === activeId);
            const newIndex = items.findIndex((t) => t.id === overId);
            if (oldIndex !== -1 && newIndex !== -1) {
              newCols[activeCol] = arrayMove(items, oldIndex, newIndex);
            }
            return newCols;
          });
        }
      }

      // If task moved to a different column, fire API call
      // We compare the task's original status with the current column
      const currentCol = findColumn(activeId);
      if (currentCol) {
        const task = columns[currentCol]?.find((t) => t.id === activeId);
        const originalStatus = task?.statusName || task?.status;
        if (originalStatus?.toLowerCase() !== currentCol.toLowerCase()) {
          updateStatusMutation.mutate({ taskId: activeId, statusName: currentCol });
        }
      }
    },
    [findColumn, columns, updateStatusMutation],
  );

  const toggleCollapse = useCallback((colName: string) => {
    setCollapsedCols((prev) => {
      const next = new Set(prev);
      if (next.has(colName)) next.delete(colName);
      else next.add(colName);
      return next;
    });
  }, []);

  // ---- Loading ----
  if (isLoading) {
    return (
      <div className="flex-1 flex gap-4 p-4 overflow-x-auto">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="w-[280px] flex-shrink-0 space-y-2">
            <div className="h-10 bg-bg-tertiary rounded-lg animate-pulse" />
            <div className="h-24 bg-bg-tertiary rounded-lg animate-pulse" />
            <div className="h-24 bg-bg-tertiary rounded-lg animate-pulse" />
            <div className="h-24 bg-bg-tertiary rounded-lg animate-pulse opacity-50" />
          </div>
        ))}
      </div>
    );
  }

  // ---- Empty ----
  if ((tasks as Task[]).length === 0 && (!groups || groups.every((g) => g.tasks.length === 0))) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-20 text-text-tertiary">
        <Layers size={40} className="mb-4 opacity-30" />
        <p className="text-sm font-medium text-text-secondary">No tasks</p>
        <p className="text-xs mt-1 opacity-70">Create a task to get started</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Card size toggle */}
      <div className="flex items-center gap-1 px-4 py-1.5 border-b border-border-secondary/50">
        <span className="text-[10px] text-text-tertiary uppercase tracking-wider mr-1">Cards:</span>
        <button
          onClick={() => setCardSize('compact')}
          className={cn(
            'p-1 rounded transition-colors',
            cardSize === 'compact' ? 'bg-bg-tertiary text-text-primary' : 'text-text-tertiary hover:text-text-secondary',
          )}
          title="Compact cards"
        >
          <LayoutList size={14} />
        </button>
        <button
          onClick={() => setCardSize('normal')}
          className={cn(
            'p-1 rounded transition-colors',
            cardSize === 'normal' ? 'bg-bg-tertiary text-text-primary' : 'text-text-tertiary hover:text-text-secondary',
          )}
          title="Normal cards"
        >
          <LayoutGrid size={14} />
        </button>
      </div>

      {/* Kanban columns */}
      <div className="flex-1 flex gap-3 p-4 overflow-x-auto overflow-y-hidden min-h-0">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          {statusList.map((statusDef) => (
            <BoardColumn
              key={statusDef.name}
              statusDef={statusDef}
              tasks={columns[statusDef.name] ?? []}
              isCollapsed={collapsedCols.has(statusDef.name)}
              onToggleCollapse={() => toggleCollapse(statusDef.name)}
              cardSize={cardSize}
              listId={listId}
              onTaskClick={onTaskClick}
              onRefresh={onRefresh}
            />
          ))}

          {/* Drag overlay — the floating card that follows the cursor */}
          <DragOverlay>
            {activeTask ? (
              <div className="w-[260px]">
                <TaskCard task={activeTask} cardSize={cardSize} isDragOverlay />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  );
}
