import { useState, useCallback, useMemo, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/toast';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Plus,
  PanelRightOpen,
  PanelRightClose,
  Flag,
  Circle,
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
  startDate?: string;
  taskTypeId?: string;
  customTaskId?: string;
  tags?: { id: string; name: string; color: string }[];
}

interface CalendarViewProps {
  tasks: any[];
  isLoading: boolean;
  listId?: string;
  spaceId?: string;
  onTaskClick: (taskId: string) => void;
  onRefresh: () => void;
}

type ViewMode = 'month' | 'week';
type ColorMode = 'priority' | 'status';

// -----------------------------------------------
// Constants
// -----------------------------------------------

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MAX_VISIBLE_TASKS = 3;

const PRIORITY_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  urgent: { bg: 'bg-red-500/20', border: 'border-red-500', text: 'text-red-300' },
  high: { bg: 'bg-orange-400/20', border: 'border-orange-400', text: 'text-orange-300' },
  medium: { bg: 'bg-yellow-400/20', border: 'border-yellow-400', text: 'text-yellow-300' },
  low: { bg: 'bg-blue-400/20', border: 'border-blue-400', text: 'text-blue-300' },
  none: { bg: 'bg-bg-tertiary', border: 'border-border-secondary', text: 'text-text-tertiary' },
};

const STATUS_GROUP_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  done: { bg: 'bg-green-500/20', border: 'border-green-500', text: 'text-green-300' },
  active: { bg: 'bg-blue-500/20', border: 'border-blue-500', text: 'text-blue-300' },
  not_started: { bg: 'bg-gray-400/20', border: 'border-gray-400', text: 'text-gray-300' },
  closed: { bg: 'bg-gray-600/20', border: 'border-gray-600', text: 'text-gray-400' },
};

const LEGEND_ITEMS_PRIORITY = [
  { label: 'Urgent', color: 'bg-red-500' },
  { label: 'High', color: 'bg-orange-400' },
  { label: 'Medium', color: 'bg-yellow-400' },
  { label: 'Low', color: 'bg-blue-400' },
  { label: 'None', color: 'bg-gray-400' },
];

const LEGEND_ITEMS_STATUS = [
  { label: 'Not Started', color: 'bg-gray-400' },
  { label: 'Active', color: 'bg-blue-500' },
  { label: 'Done', color: 'bg-green-500' },
  { label: 'Closed', color: 'bg-gray-600' },
];

// -----------------------------------------------
// Helpers
// -----------------------------------------------

function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseDate(dateStr: string | undefined): Date | null {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    return d;
  } catch {
    return null;
  }
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function getMonthGrid(year: number, month: number): Date[][] {
  // month is 0-indexed
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  // Adjust to start on Monday (0=Mon ... 6=Sun)
  let startDow = firstDay.getDay(); // 0=Sun
  startDow = startDow === 0 ? 6 : startDow - 1; // Convert to Mon-based

  const grid: Date[][] = [];
  let current = new Date(firstDay);
  current.setDate(current.getDate() - startDow);

  // Build 6 weeks max
  for (let week = 0; week < 6; week++) {
    const row: Date[] = [];
    for (let day = 0; day < 7; day++) {
      row.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    grid.push(row);
    // Stop if we've passed the last day and completed the week
    if (current > lastDay && week >= 3) {
      // Check if all dates in this row are outside the current month
      const allOutside = row.every((d) => d.getMonth() !== month);
      if (allOutside) {
        grid.pop();
        break;
      }
    }
  }

  return grid;
}

function getWeekGrid(referenceDate: Date): Date[] {
  const d = new Date(referenceDate);
  let dow = d.getDay();
  dow = dow === 0 ? 6 : dow - 1; // Mon=0
  d.setDate(d.getDate() - dow);
  const week: Date[] = [];
  for (let i = 0; i < 7; i++) {
    week.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return week;
}

function getTaskColor(task: Task, colorMode: ColorMode): { bg: string; border: string; text: string } {
  if (colorMode === 'priority') {
    const key = (task.priority ?? 'none').toLowerCase();
    return PRIORITY_COLORS[key] ?? PRIORITY_COLORS.none;
  }
  // status-based
  const sn = (task.statusName ?? task.status ?? '').toLowerCase();
  if (sn.includes('done') || sn.includes('complete')) return STATUS_GROUP_COLORS.done;
  if (sn.includes('progress') || sn.includes('review') || sn.includes('active')) return STATUS_GROUP_COLORS.active;
  if (sn.includes('closed')) return STATUS_GROUP_COLORS.closed;
  return STATUS_GROUP_COLORS.not_started;
}

function isOverdue(task: Task): boolean {
  if (!task.dueDate) return false;
  const sn = (task.statusName ?? task.status ?? '').toLowerCase();
  if (sn.includes('done') || sn.includes('complete') || sn.includes('closed')) return false;
  const d = parseDate(task.dueDate);
  if (!d) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d < today;
}

function isCompleted(task: Task): boolean {
  const sn = (task.statusName ?? task.status ?? '').toLowerCase();
  return sn.includes('done') || sn.includes('complete') || sn.includes('closed');
}

function formatMonthYear(year: number, month: number): string {
  const d = new Date(year, month, 1);
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

// -----------------------------------------------
// Draggable Task Pill
// -----------------------------------------------

function DraggableTaskPill({
  task,
  colorMode,
  onClick,
}: {
  task: Task;
  colorMode: ColorMode;
  onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    data: { task },
  });

  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)` }
    : undefined;

  const colors = getTaskColor(task, colorMode);
  const overdue = isOverdue(task);
  const completed = isCompleted(task);

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        'text-[10px] leading-tight px-1.5 py-0.5 rounded border cursor-grab truncate transition-all',
        colors.bg,
        colors.border,
        colors.text,
        overdue && '!border-red-500 ring-1 ring-red-500/40',
        completed && 'line-through opacity-50',
        isDragging && 'opacity-30',
      )}
      title={task.title}
    >
      {task.title}
    </div>
  );
}

// -----------------------------------------------
// Droppable Day Cell
// -----------------------------------------------

function DroppableDayCell({
  date,
  isCurrentMonth,
  isToday,
  tasks,
  colorMode,
  expandedDay,
  onToggleExpand,
  onTaskClick,
  onQuickAdd,
}: {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  tasks: Task[];
  colorMode: ColorMode;
  expandedDay: string | null;
  onToggleExpand: (dateKey: string) => void;
  onTaskClick: (taskId: string) => void;
  onQuickAdd: (date: Date) => void;
}) {
  const dateKey = toDateKey(date);
  const { isOver, setNodeRef } = useDroppable({ id: `day-${dateKey}`, data: { date: dateKey } });
  const isExpanded = expandedDay === dateKey;
  const visibleTasks = isExpanded ? tasks : tasks.slice(0, MAX_VISIBLE_TASKS);
  const hiddenCount = tasks.length - MAX_VISIBLE_TASKS;

  return (
    <div
      ref={setNodeRef}
      onClick={(e) => {
        // Only trigger quick-add if clicking empty space
        if ((e.target as HTMLElement).closest('[data-task-pill]')) return;
        onQuickAdd(date);
      }}
      className={cn(
        'min-h-[90px] border border-border-secondary/50 p-1 flex flex-col gap-0.5 cursor-pointer transition-colors group/cell',
        !isCurrentMonth && 'bg-bg-primary/30',
        isCurrentMonth && 'bg-bg-secondary/50',
        isToday && 'ring-1 ring-accent-blue bg-accent-blue/5',
        isOver && 'bg-accent-blue/10 ring-1 ring-accent-blue/50',
      )}
    >
      {/* Day number */}
      <div className="flex items-center justify-between">
        <span
          className={cn(
            'text-[11px] font-medium w-5 h-5 flex items-center justify-center rounded-full',
            !isCurrentMonth && 'text-text-tertiary/50',
            isCurrentMonth && 'text-text-secondary',
            isToday && 'bg-accent-blue text-white font-bold',
          )}
        >
          {date.getDate()}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onQuickAdd(date);
          }}
          className="opacity-0 group-hover/cell:opacity-100 text-text-tertiary hover:text-accent-blue transition-opacity"
        >
          <Plus size={12} />
        </button>
      </div>

      {/* Task pills */}
      <div className="flex flex-col gap-0.5">
        {visibleTasks.map((task) => (
          <div key={task.id} data-task-pill>
            <DraggableTaskPill
              task={task}
              colorMode={colorMode}
              onClick={() => onTaskClick(task.id)}
            />
          </div>
        ))}
      </div>

      {/* +N more */}
      {!isExpanded && hiddenCount > 0 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleExpand(dateKey);
          }}
          className="text-[9px] text-accent-blue hover:text-accent-blue/80 mt-auto"
        >
          +{hiddenCount} more
        </button>
      )}
      {isExpanded && tasks.length > MAX_VISIBLE_TASKS && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleExpand(dateKey);
          }}
          className="text-[9px] text-accent-blue hover:text-accent-blue/80 mt-auto"
        >
          show less
        </button>
      )}
    </div>
  );
}

// -----------------------------------------------
// Unscheduled Sidebar
// -----------------------------------------------

function UnscheduledSidebar({
  tasks,
  colorMode,
  isOpen,
  onToggle,
  onTaskClick,
}: {
  tasks: Task[];
  colorMode: ColorMode;
  isOpen: boolean;
  onToggle: () => void;
  onTaskClick: (taskId: string) => void;
}) {
  const priorityOrder: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3, none: 4 };

  const sortedTasks = useMemo(
    () =>
      [...tasks].sort(
        (a, b) =>
          (priorityOrder[(a.priority ?? 'none').toLowerCase()] ?? 4) -
          (priorityOrder[(b.priority ?? 'none').toLowerCase()] ?? 4),
      ),
    [tasks],
  );

  return (
    <div
      className={cn(
        'border-l border-border-secondary flex flex-col transition-all bg-bg-primary',
        isOpen ? 'w-[220px]' : 'w-10',
      )}
    >
      {/* Toggle header */}
      <div
        className={cn(
          'flex items-center border-b border-border-secondary/50 px-2 py-2',
          isOpen ? 'justify-between' : 'justify-center',
        )}
      >
        {isOpen && (
          <span className="text-xs font-semibold text-text-secondary">
            Unscheduled ({tasks.length})
          </span>
        )}
        <button
          onClick={onToggle}
          className="text-text-tertiary hover:text-text-primary transition-colors"
          title={isOpen ? 'Collapse sidebar' : 'Show unscheduled tasks'}
        >
          {isOpen ? <PanelRightClose size={14} /> : <PanelRightOpen size={14} />}
        </button>
      </div>

      {/* Task list */}
      {isOpen && (
        <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
          {sortedTasks.length === 0 ? (
            <p className="text-[11px] text-text-tertiary text-center py-4">All tasks scheduled</p>
          ) : (
            sortedTasks.map((task) => (
              <DraggableUnscheduledTask
                key={task.id}
                task={task}
                colorMode={colorMode}
                onClick={() => onTaskClick(task.id)}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

function DraggableUnscheduledTask({
  task,
  colorMode,
  onClick,
}: {
  task: Task;
  colorMode: ColorMode;
  onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    data: { task },
  });

  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)` }
    : undefined;

  const priorityKey = (task.priority ?? 'none').toLowerCase();
  const priorityDot =
    priorityKey === 'urgent'
      ? 'bg-red-500'
      : priorityKey === 'high'
        ? 'bg-orange-400'
        : priorityKey === 'medium'
          ? 'bg-yellow-400'
          : priorityKey === 'low'
            ? 'bg-blue-400'
            : 'bg-gray-400';

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        'p-2 bg-bg-secondary border border-border-secondary rounded-lg cursor-grab text-xs text-text-primary hover:border-border-primary transition-colors',
        isDragging && 'opacity-30',
      )}
    >
      <div className="flex items-center gap-1.5">
        <span className={cn('w-2 h-2 rounded-full flex-shrink-0', priorityDot)} />
        <span className="truncate">{task.title}</span>
      </div>
    </div>
  );
}

// -----------------------------------------------
// Quick Add Popover (inline)
// -----------------------------------------------

function QuickAddInput({
  date,
  listId,
  onCreated,
  onCancel,
}: {
  date: Date;
  listId?: string;
  onCreated: () => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const createMutation = useMutation({
    mutationFn: async (title: string) => {
      const payload: Record<string, unknown> = {
        title,
        dueDate: toDateKey(date),
      };
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
    if (!trimmed) {
      onCancel();
      return;
    }
    createMutation.mutate(trimmed);
  };

  // Auto-focus
  useMemo(() => {
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  return (
    <div className="fixed inset-0 z-50" onClick={onCancel}>
      <div
        className="absolute z-50 bg-bg-secondary border border-border-primary rounded-lg shadow-xl p-2"
        style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)', minWidth: 260 }}
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-[10px] text-text-tertiary mb-1.5">
          New task for{' '}
          {date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
        </p>
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSubmit();
            if (e.key === 'Escape') onCancel();
          }}
          placeholder="Task name... Enter to save"
          className="w-full text-xs bg-bg-primary border border-border-secondary focus:border-accent-blue rounded px-2.5 py-2 outline-none text-text-primary placeholder:text-text-tertiary"
          disabled={createMutation.isPending}
        />
      </div>
    </div>
  );
}

// -----------------------------------------------
// Main Component
// -----------------------------------------------

export function CalendarView({
  tasks,
  isLoading,
  listId,
  spaceId: _spaceId,
  onTaskClick,
  onRefresh,
}: CalendarViewProps) {
  const queryClient = useQueryClient();
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [colorMode, setColorMode] = useState<ColorMode>('priority');
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [quickAddDate, setQuickAddDate] = useState<Date | null>(null);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [weekRef, setWeekRef] = useState<Date>(today);

  // Build task map by date key
  const { tasksByDate, unscheduledTasks } = useMemo(() => {
    const map: Record<string, Task[]> = {};
    const unscheduled: Task[] = [];

    for (const task of tasks as Task[]) {
      const due = parseDate(task.dueDate);
      if (!due) {
        unscheduled.push(task);
        continue;
      }

      // For multi-day tasks (startDate to dueDate), add to each day
      const start = parseDate(task.startDate) ?? due;
      const end = due;
      const cursor = new Date(start);
      while (cursor <= end) {
        const key = toDateKey(cursor);
        if (!map[key]) map[key] = [];
        map[key].push(task);
        cursor.setDate(cursor.getDate() + 1);
      }
    }

    return { tasksByDate: map, unscheduledTasks: unscheduled };
  }, [tasks]);

  // Grid data
  const monthGrid = useMemo(() => getMonthGrid(currentYear, currentMonth), [currentYear, currentMonth]);
  const weekGrid = useMemo(() => getWeekGrid(weekRef), [weekRef]);

  // Navigation
  const goToPrevMonth = useCallback(() => {
    setCurrentMonth((m) => {
      if (m === 0) {
        setCurrentYear((y) => y - 1);
        return 11;
      }
      return m - 1;
    });
  }, []);

  const goToNextMonth = useCallback(() => {
    setCurrentMonth((m) => {
      if (m === 11) {
        setCurrentYear((y) => y + 1);
        return 0;
      }
      return m + 1;
    });
  }, []);

  const goToPrevWeek = useCallback(() => {
    setWeekRef((d) => {
      const n = new Date(d);
      n.setDate(n.getDate() - 7);
      return n;
    });
  }, []);

  const goToNextWeek = useCallback(() => {
    setWeekRef((d) => {
      const n = new Date(d);
      n.setDate(n.getDate() + 7);
      return n;
    });
  }, []);

  const goToToday = useCallback(() => {
    const now = new Date();
    setCurrentYear(now.getFullYear());
    setCurrentMonth(now.getMonth());
    setWeekRef(now);
  }, []);

  const handleToggleExpand = useCallback(
    (dateKey: string) => {
      setExpandedDay((prev) => (prev === dateKey ? null : dateKey));
    },
    [],
  );

  const handleQuickAdd = useCallback((date: Date) => {
    setQuickAddDate(date);
  }, []);

  // DnD
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const updateDueDateMutation = useMutation({
    mutationFn: async ({ taskId, dueDate }: { taskId: string; dueDate: string }) => {
      const { data } = await api.patch(`/tasks/${taskId}`, { dueDate });
      return data.data ?? data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['viewQuery'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      onRefresh();
      toast('Task rescheduled', 'success');
    },
    onError: () => {
      toast('Failed to update task date', 'error');
    },
  });

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const taskData = event.active.data.current?.task;
      if (taskData) setActiveTask(taskData);
    },
    [],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveTask(null);
      const { active, over } = event;
      if (!over) return;

      const overId = over.id as string;
      if (!overId.startsWith('day-')) return;

      const dateKey = overId.replace('day-', '');
      const taskId = active.id as string;

      // Find the task
      const task = (tasks as Task[]).find((t) => t.id === taskId);
      if (!task) return;

      // Only update if date actually changed
      const existingDate = task.dueDate ? toDateKey(new Date(task.dueDate)) : null;
      if (existingDate === dateKey) return;

      updateDueDateMutation.mutate({ taskId, dueDate: dateKey });
    },
    [tasks, updateDueDateMutation],
  );

  // ---- Loading ----
  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col p-4 gap-2">
        <div className="h-10 bg-bg-tertiary rounded-lg animate-pulse w-80" />
        <div className="flex-1 grid grid-cols-7 gap-px">
          {Array.from({ length: 35 }).map((_, i) => (
            <div key={i} className="h-20 bg-bg-tertiary rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const legend = colorMode === 'priority' ? LEGEND_ITEMS_PRIORITY : LEGEND_ITEMS_STATUS;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex-1 flex flex-col min-h-0">
        {/* Top toolbar */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-border-secondary/50">
          <div className="flex items-center gap-2">
            {/* Navigation */}
            <button
              onClick={viewMode === 'month' ? goToPrevMonth : goToPrevWeek}
              className="p-1 rounded hover:bg-bg-hover text-text-tertiary hover:text-text-primary transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <h2 className="text-sm font-semibold text-text-primary min-w-[160px] text-center">
              {viewMode === 'month'
                ? formatMonthYear(currentYear, currentMonth)
                : `Week of ${weekGrid[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekGrid[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}
            </h2>
            <button
              onClick={viewMode === 'month' ? goToNextMonth : goToNextWeek}
              className="p-1 rounded hover:bg-bg-hover text-text-tertiary hover:text-text-primary transition-colors"
            >
              <ChevronRight size={16} />
            </button>

            {/* Today button */}
            <button
              onClick={goToToday}
              className="ml-2 px-2.5 py-1 text-[11px] font-medium rounded bg-accent-blue/10 text-accent-blue hover:bg-accent-blue/20 transition-colors"
            >
              Today
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* Color mode toggle */}
            <div className="flex items-center gap-1 mr-2">
              <span className="text-[10px] text-text-tertiary uppercase tracking-wider">Color:</span>
              <button
                onClick={() => setColorMode('priority')}
                className={cn(
                  'px-2 py-0.5 text-[10px] rounded transition-colors',
                  colorMode === 'priority'
                    ? 'bg-bg-tertiary text-text-primary'
                    : 'text-text-tertiary hover:text-text-secondary',
                )}
              >
                Priority
              </button>
              <button
                onClick={() => setColorMode('status')}
                className={cn(
                  'px-2 py-0.5 text-[10px] rounded transition-colors',
                  colorMode === 'status'
                    ? 'bg-bg-tertiary text-text-primary'
                    : 'text-text-tertiary hover:text-text-secondary',
                )}
              >
                Status
              </button>
            </div>

            {/* View mode toggle */}
            <div className="flex items-center border border-border-secondary rounded overflow-hidden">
              <button
                onClick={() => setViewMode('month')}
                className={cn(
                  'px-2.5 py-1 text-[11px] font-medium transition-colors',
                  viewMode === 'month'
                    ? 'bg-accent-blue text-white'
                    : 'text-text-tertiary hover:text-text-primary hover:bg-bg-hover',
                )}
              >
                Month
              </button>
              <button
                onClick={() => setViewMode('week')}
                className={cn(
                  'px-2.5 py-1 text-[11px] font-medium transition-colors',
                  viewMode === 'week'
                    ? 'bg-accent-blue text-white'
                    : 'text-text-tertiary hover:text-text-primary hover:bg-bg-hover',
                )}
              >
                Week
              </button>
            </div>
          </div>
        </div>

        {/* Calendar body + sidebar */}
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* Calendar grid area */}
          <div className="flex-1 flex flex-col min-w-0 overflow-auto p-2">
            {/* Weekday headers */}
            <div className="grid grid-cols-7 gap-px mb-px">
              {WEEKDAY_LABELS.map((label) => (
                <div
                  key={label}
                  className="text-center text-[10px] font-semibold text-text-tertiary uppercase tracking-wider py-1.5"
                >
                  {label}
                </div>
              ))}
            </div>

            {/* Month grid */}
            {viewMode === 'month' && (
              <div className="flex-1 grid grid-cols-7 gap-px auto-rows-fr">
                {monthGrid.flat().map((date) => {
                  const dateKey = toDateKey(date);
                  const isCurrentMonth = date.getMonth() === currentMonth;
                  const todayMatch = isSameDay(date, today);
                  const dayTasks = tasksByDate[dateKey] ?? [];

                  return (
                    <DroppableDayCell
                      key={dateKey}
                      date={date}
                      isCurrentMonth={isCurrentMonth}
                      isToday={todayMatch}
                      tasks={dayTasks}
                      colorMode={colorMode}
                      expandedDay={expandedDay}
                      onToggleExpand={handleToggleExpand}
                      onTaskClick={onTaskClick}
                      onQuickAdd={handleQuickAdd}
                    />
                  );
                })}
              </div>
            )}

            {/* Week grid */}
            {viewMode === 'week' && (
              <div className="flex-1 grid grid-cols-7 gap-px">
                {weekGrid.map((date) => {
                  const dateKey = toDateKey(date);
                  const todayMatch = isSameDay(date, today);
                  const dayTasks = tasksByDate[dateKey] ?? [];

                  return (
                    <DroppableDayCell
                      key={dateKey}
                      date={date}
                      isCurrentMonth={true}
                      isToday={todayMatch}
                      tasks={dayTasks}
                      colorMode={colorMode}
                      expandedDay={expandedDay}
                      onToggleExpand={handleToggleExpand}
                      onTaskClick={onTaskClick}
                      onQuickAdd={handleQuickAdd}
                    />
                  );
                })}
              </div>
            )}

            {/* Color legend */}
            <div className="flex items-center gap-3 px-2 py-1.5 border-t border-border-secondary/50 mt-1">
              {legend.map((item) => (
                <div key={item.label} className="flex items-center gap-1">
                  <span className={cn('w-2.5 h-2.5 rounded-sm', item.color)} />
                  <span className="text-[9px] text-text-tertiary">{item.label}</span>
                </div>
              ))}
              <div className="flex items-center gap-1 ml-2 pl-2 border-l border-border-secondary/50">
                <span className="w-2.5 h-2.5 rounded-sm border-2 border-red-500 bg-transparent" />
                <span className="text-[9px] text-text-tertiary">Overdue</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[9px] text-text-tertiary line-through">Completed</span>
              </div>
            </div>
          </div>

          {/* Unscheduled sidebar */}
          <UnscheduledSidebar
            tasks={unscheduledTasks}
            colorMode={colorMode}
            isOpen={sidebarOpen}
            onToggle={() => setSidebarOpen((p) => !p)}
            onTaskClick={onTaskClick}
          />
        </div>

        {/* Quick add modal */}
        {quickAddDate && (
          <QuickAddInput
            date={quickAddDate}
            listId={listId}
            onCreated={() => {
              setQuickAddDate(null);
              onRefresh();
            }}
            onCancel={() => setQuickAddDate(null)}
          />
        )}

        {/* Drag overlay */}
        <DragOverlay>
          {activeTask ? (
            <div className="px-2 py-1 bg-bg-secondary border border-accent-blue rounded shadow-lg text-xs text-text-primary max-w-[200px] truncate">
              {activeTask.title}
            </div>
          ) : null}
        </DragOverlay>
      </div>
    </DndContext>
  );
}
