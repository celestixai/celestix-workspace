import { useState, useEffect, useRef } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  Sun,
  Star,
  Calendar,
  List,
  Plus,
  Check,
  Trash2,
  ChevronDown,
  ChevronRight,
  X,
  Bell,
  StickyNote,
  CirclePlus,
  GripVertical,
  MoreHorizontal,
  Search,
} from 'lucide-react';

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

interface Step {
  id: string;
  title: string;
  completed: boolean;
}

interface Task {
  id: string;
  title: string;
  completed: boolean;
  important: boolean;
  myDay: boolean;
  dueDate: string | null;
  reminder: string | null;
  notes: string;
  steps: Step[];
  listId: string;
  createdAt: string;
}

interface TaskList {
  id: string;
  name: string;
  icon?: string;
  isSmartList: boolean;
}

const SMART_LISTS: TaskList[] = [
  { id: 'my-day', name: 'My Day', isSmartList: true },
  { id: 'important', name: 'Important', isSmartList: true },
  { id: 'planned', name: 'Planned', isSmartList: true },
  { id: 'all', name: 'All Tasks', isSmartList: true },
];

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const taskDate = new Date(d);
  taskDate.setHours(0, 0, 0, 0);

  if (taskDate.getTime() === today.getTime()) return 'Today';
  if (taskDate.getTime() === tomorrow.getTime()) return 'Tomorrow';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getTodayString(): string {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

// ──────────────────────────────────────────────
// Sidebar
// ──────────────────────────────────────────────

function Sidebar({
  lists,
  activeListId,
  onSelect,
  onCreateList,
  onDeleteList,
  taskCounts,
}: {
  lists: TaskList[];
  activeListId: string;
  onSelect: (id: string) => void;
  onCreateList: (name: string) => void;
  onDeleteList: (id: string) => void;
  taskCounts: Record<string, number>;
}) {
  const [newListName, setNewListName] = useState('');
  const [showInput, setShowInput] = useState(false);

  const smartIcons: Record<string, React.ReactNode> = {
    'my-day': <Sun size={18} />,
    important: <Star size={18} />,
    planned: <Calendar size={18} />,
    all: <List size={18} />,
  };

  const customLists = lists.filter((l) => !l.isSmartList);

  const handleCreate = () => {
    const trimmed = newListName.trim();
    if (trimmed) {
      onCreateList(trimmed);
      setNewListName('');
      setShowInput(false);
    }
  };

  return (
    <aside className="w-64 min-w-[16rem] bg-cx-surface border-r border-[var(--cx-border-1)] flex flex-col h-full">
      <div className="p-4 text-lg font-semibold text-[var(--cx-text-1)]">Tasks</div>

      <nav className="flex-1 overflow-y-auto px-2">
        {/* Smart lists */}
        {SMART_LISTS.map((list) => (
          <button
            key={list.id}
            onClick={() => onSelect(list.id)}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
              activeListId === list.id
                ? 'bg-accent-blue/15 text-accent-blue'
                : 'text-[var(--cx-text-1)] hover:bg-cx-bg/50'
            )}
          >
            {smartIcons[list.id]}
            <span className="flex-1 text-left">{list.name}</span>
            {(taskCounts[list.id] ?? 0) > 0 && (
              <span className="text-xs text-[var(--cx-text-2)]">
                {taskCounts[list.id]}
              </span>
            )}
          </button>
        ))}

        {/* Separator */}
        <div className="my-3 mx-3 border-t border-[var(--cx-border-1)]" />

        {/* Custom lists */}
        {customLists.map((list) => (
          <div key={list.id} className="group flex items-center">
            <button
              onClick={() => onSelect(list.id)}
              className={cn(
                'flex-1 flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                activeListId === list.id
                  ? 'bg-accent-blue/15 text-accent-blue'
                  : 'text-[var(--cx-text-1)] hover:bg-cx-bg/50'
              )}
            >
              <List size={18} />
              <span className="flex-1 text-left truncate">{list.name}</span>
              {(taskCounts[list.id] ?? 0) > 0 && (
                <span className="text-xs text-[var(--cx-text-2)]">
                  {taskCounts[list.id]}
                </span>
              )}
            </button>
            <button
              onClick={() => onDeleteList(list.id)}
              className="opacity-0 group-hover:opacity-100 p-1 text-[var(--cx-text-2)] hover:text-cx-danger transition-opacity"
              title="Delete list"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}

        {/* Create list */}
        {showInput ? (
          <div className="flex items-center gap-2 px-3 py-2">
            <input
              autoFocus
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreate();
                if (e.key === 'Escape') setShowInput(false);
              }}
              placeholder="List name"
              className="flex-1 bg-cx-bg border border-[var(--cx-border-1)] rounded px-2 py-1 text-sm text-[var(--cx-text-1)] outline-none focus:border-accent-blue"
            />
            <button onClick={handleCreate} className="text-accent-blue">
              <Check size={16} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowInput(true)}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-accent-blue hover:bg-cx-bg/50 transition-colors"
          >
            <Plus size={18} />
            <span>New list</span>
          </button>
        )}
      </nav>
    </aside>
  );
}

// ──────────────────────────────────────────────
// Task Detail Panel
// ──────────────────────────────────────────────

function TaskDetailPanel({
  task,
  onUpdate,
  onClose,
}: {
  task: Task;
  onUpdate: (updates: Partial<Task>) => void;
  onClose: () => void;
}) {
  const [newStepTitle, setNewStepTitle] = useState('');
  const notesRef = useRef<HTMLTextAreaElement>(null);

  const addStep = () => {
    const trimmed = newStepTitle.trim();
    if (!trimmed) return;
    const step: Step = { id: generateId(), title: trimmed, completed: false };
    onUpdate({ steps: [...task.steps, step] });
    setNewStepTitle('');
  };

  const toggleStep = (stepId: string) => {
    onUpdate({
      steps: task.steps.map((s) =>
        s.id === stepId ? { ...s, completed: !s.completed } : s
      ),
    });
  };

  const deleteStep = (stepId: string) => {
    onUpdate({ steps: task.steps.filter((s) => s.id !== stepId) });
  };

  return (
    <aside className="w-80 min-w-[20rem] bg-cx-surface border-l border-[var(--cx-border-1)] flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[var(--cx-border-1)]">
        <h3 className="text-sm font-semibold text-[var(--cx-text-1)]">
          Task Details
        </h3>
        <button
          onClick={onClose}
          className="text-[var(--cx-text-2)] hover:text-[var(--cx-text-1)]"
        >
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Title */}
        <input
          value={task.title}
          onChange={(e) => onUpdate({ title: e.target.value })}
          className="w-full bg-cx-bg border border-[var(--cx-border-1)] rounded-lg px-3 py-2 text-[var(--cx-text-1)] text-sm outline-none focus:border-accent-blue"
        />

        {/* Toggles */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => onUpdate({ important: !task.important })}
            className={cn(
              'flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg border transition-colors',
              task.important
                ? 'border-yellow-500 text-cx-warning bg-cx-warning/10'
                : 'border-[var(--cx-border-1)] text-[var(--cx-text-2)] hover:text-[var(--cx-text-1)]'
            )}
          >
            <Star size={14} fill={task.important ? 'currentColor' : 'none'} />
            Important
          </button>
          <button
            onClick={() => onUpdate({ myDay: !task.myDay })}
            className={cn(
              'flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg border transition-colors',
              task.myDay
                ? 'border-accent-blue text-accent-blue bg-accent-blue/10'
                : 'border-[var(--cx-border-1)] text-[var(--cx-text-2)] hover:text-[var(--cx-text-1)]'
            )}
          >
            <Sun size={14} />
            My Day
          </button>
        </div>

        {/* Steps (sub-tasks) */}
        <div>
          <h4 className="text-xs font-semibold text-[var(--cx-text-2)] uppercase tracking-wider mb-2">
            Steps
          </h4>
          <div className="space-y-1">
            {task.steps.map((step) => (
              <div
                key={step.id}
                className="flex items-center gap-2 group px-2 py-1 rounded hover:bg-cx-bg/50"
              >
                <button
                  onClick={() => toggleStep(step.id)}
                  className={cn(
                    'w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors',
                    step.completed
                      ? 'bg-accent-blue border-accent-blue'
                      : 'border-[var(--cx-border-1)]'
                  )}
                >
                  {step.completed && <Check size={10} className="text-white" />}
                </button>
                <span
                  className={cn(
                    'flex-1 text-sm',
                    step.completed
                      ? 'line-through text-[var(--cx-text-2)]'
                      : 'text-[var(--cx-text-1)]'
                  )}
                >
                  {step.title}
                </span>
                <button
                  onClick={() => deleteStep(step.id)}
                  className="opacity-0 group-hover:opacity-100 text-[var(--cx-text-2)] hover:text-cx-danger"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 mt-2">
            <CirclePlus size={16} className="text-accent-blue flex-shrink-0" />
            <input
              value={newStepTitle}
              onChange={(e) => setNewStepTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') addStep();
              }}
              placeholder="Add step"
              className="flex-1 bg-transparent text-sm text-[var(--cx-text-1)] placeholder:text-[var(--cx-text-3)] outline-none"
            />
          </div>
        </div>

        {/* Due Date */}
        <div>
          <h4 className="text-xs font-semibold text-[var(--cx-text-2)] uppercase tracking-wider mb-2">
            Due Date
          </h4>
          <div className="flex items-center gap-2">
            <Calendar size={16} className="text-[var(--cx-text-2)]" />
            <input
              type="date"
              value={task.dueDate ?? ''}
              onChange={(e) =>
                onUpdate({ dueDate: e.target.value || null })
              }
              className="bg-cx-bg border border-[var(--cx-border-1)] rounded px-2 py-1 text-sm text-[var(--cx-text-1)] outline-none focus:border-accent-blue"
            />
            {task.dueDate && (
              <button
                onClick={() => onUpdate({ dueDate: null })}
                className="text-[var(--cx-text-2)] hover:text-cx-danger"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Reminder */}
        <div>
          <h4 className="text-xs font-semibold text-[var(--cx-text-2)] uppercase tracking-wider mb-2">
            Reminder
          </h4>
          <div className="flex items-center gap-2">
            <Bell size={16} className="text-[var(--cx-text-2)]" />
            <input
              type="datetime-local"
              value={task.reminder ?? ''}
              onChange={(e) =>
                onUpdate({ reminder: e.target.value || null })
              }
              className="bg-cx-bg border border-[var(--cx-border-1)] rounded px-2 py-1 text-sm text-[var(--cx-text-1)] outline-none focus:border-accent-blue"
            />
            {task.reminder && (
              <button
                onClick={() => onUpdate({ reminder: null })}
                className="text-[var(--cx-text-2)] hover:text-cx-danger"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Notes */}
        <div>
          <h4 className="text-xs font-semibold text-[var(--cx-text-2)] uppercase tracking-wider mb-2">
            Notes
          </h4>
          <textarea
            ref={notesRef}
            value={task.notes}
            onChange={(e) => onUpdate({ notes: e.target.value })}
            placeholder="Add notes..."
            rows={5}
            className="w-full bg-cx-bg border border-[var(--cx-border-1)] rounded-lg px-3 py-2 text-sm text-[var(--cx-text-1)] placeholder:text-[var(--cx-text-3)] outline-none resize-none focus:border-accent-blue"
          />
        </div>
      </div>

      {/* Footer actions */}
      <div className="p-4 border-t border-[var(--cx-border-1)] text-xs text-[var(--cx-text-2)]">
        Created {new Date(task.createdAt).toLocaleDateString()}
      </div>
    </aside>
  );
}

// ──────────────────────────────────────────────
// Task Item Row
// ──────────────────────────────────────────────

function TaskItem({
  task,
  onToggle,
  onToggleImportant,
  onSelect,
  isSelected,
}: {
  task: Task;
  onToggle: () => void;
  onToggleImportant: () => void;
  onSelect: () => void;
  isSelected: boolean;
}) {
  const stepsTotal = task.steps.length;
  const stepsDone = task.steps.filter((s) => s.completed).length;

  return (
    <div
      onClick={onSelect}
      className={cn(
        'flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer transition-colors group',
        isSelected
          ? 'bg-accent-blue/10 border border-accent-blue/30'
          : 'hover:bg-cx-surface border border-transparent'
      )}
    >
      {/* Checkbox */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        className={cn(
          'w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors',
          task.completed
            ? 'bg-accent-blue border-accent-blue'
            : 'border-text-secondary hover:border-accent-blue'
        )}
      >
        {task.completed && <Check size={12} className="text-white" />}
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p
          className={cn(
            'text-sm truncate',
            task.completed
              ? 'line-through text-[var(--cx-text-2)]'
              : 'text-[var(--cx-text-1)]'
          )}
        >
          {task.title}
        </p>
        <div className="flex items-center gap-3 mt-0.5">
          {task.dueDate && (
            <span className="text-xs text-accent-blue flex items-center gap-1">
              <Calendar size={10} />
              {formatDate(task.dueDate)}
            </span>
          )}
          {task.myDay && (
            <span className="text-xs text-cx-warning flex items-center gap-1">
              <Sun size={10} />
              My Day
            </span>
          )}
          {stepsTotal > 0 && (
            <span className="text-xs text-[var(--cx-text-2)]">
              {stepsDone}/{stepsTotal} steps
            </span>
          )}
        </div>
      </div>

      {/* Star */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleImportant();
        }}
        className={cn(
          'flex-shrink-0 transition-colors',
          task.important
            ? 'text-cx-warning'
            : 'text-[var(--cx-text-2)] opacity-0 group-hover:opacity-100'
        )}
      >
        <Star size={16} fill={task.important ? 'currentColor' : 'none'} />
      </button>
    </div>
  );
}

// ──────────────────────────────────────────────
// Main: TodoPage
// ──────────────────────────────────────────────

export function TodoPage() {
  const [lists, setLists] = useState<TaskList[]>([
    ...SMART_LISTS,
    { id: 'default', name: 'Tasks', isSmartList: false },
  ]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activeListId, setActiveListId] = useState('my-day');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [showCompleted, setShowCompleted] = useState(false);

  // Load tasks from API on mount
  useEffect(() => {
    api.get('/tasks').then((res) => {
      const data = res.data?.data ?? res.data;
      if (Array.isArray(data)) setTasks(data);
    }).catch(() => {});
    api.get('/task-lists').then((res) => {
      const data = res.data?.data ?? res.data;
      if (Array.isArray(data) && data.length > 0) {
        setLists([...SMART_LISTS, ...data]);
      }
    }).catch(() => {});
  }, []);

  // Persist tasks when they change
  useEffect(() => {
    if (tasks.length > 0) {
      api.put('/tasks', { tasks }).catch(() => {});
    }
  }, [tasks]);

  // Derived data
  const todayISO = new Date().toISOString().split('T')[0];

  const getFilteredTasks = (): Task[] => {
    switch (activeListId) {
      case 'my-day':
        return tasks.filter((t) => t.myDay);
      case 'important':
        return tasks.filter((t) => t.important);
      case 'planned':
        return tasks.filter((t) => t.dueDate !== null);
      case 'all':
        return tasks;
      default:
        return tasks.filter((t) => t.listId === activeListId);
    }
  };

  const filteredTasks = getFilteredTasks();
  const activeTasks = filteredTasks.filter((t) => !t.completed);
  const completedTasks = filteredTasks.filter((t) => t.completed);

  const taskCounts: Record<string, number> = {
    'my-day': tasks.filter((t) => t.myDay && !t.completed).length,
    important: tasks.filter((t) => t.important && !t.completed).length,
    planned: tasks.filter((t) => t.dueDate && !t.completed).length,
    all: tasks.filter((t) => !t.completed).length,
  };
  lists
    .filter((l) => !l.isSmartList)
    .forEach((l) => {
      taskCounts[l.id] = tasks.filter(
        (t) => t.listId === l.id && !t.completed
      ).length;
    });

  const selectedTask = tasks.find((t) => t.id === selectedTaskId) ?? null;

  // Handlers
  const addTask = () => {
    const trimmed = newTaskTitle.trim();
    if (!trimmed) return;
    const targetList =
      activeListId === 'my-day' ||
      activeListId === 'important' ||
      activeListId === 'planned' ||
      activeListId === 'all'
        ? 'default'
        : activeListId;
    const task: Task = {
      id: generateId(),
      title: trimmed,
      completed: false,
      important: activeListId === 'important',
      myDay: activeListId === 'my-day',
      dueDate: activeListId === 'planned' ? todayISO : null,
      reminder: null,
      notes: '',
      steps: [],
      listId: targetList,
      createdAt: new Date().toISOString(),
    };
    setTasks((prev) => [task, ...prev]);
    setNewTaskTitle('');
  };

  const toggleTask = (id: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t))
    );
  };

  const toggleImportant = (id: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, important: !t.important } : t))
    );
  };

  const updateTask = (id: string, updates: Partial<Task>) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...updates } : t))
    );
  };

  const createList = (name: string) => {
    const newList: TaskList = { id: generateId(), name, isSmartList: false };
    setLists((prev) => [...prev, newList]);
    setActiveListId(newList.id);
  };

  const deleteList = (id: string) => {
    setLists((prev) => prev.filter((l) => l.id !== id));
    setTasks((prev) => prev.filter((t) => t.listId !== id));
    if (activeListId === id) setActiveListId('my-day');
  };

  const activeList = lists.find((l) => l.id === activeListId);

  // Motivational headers for My Day
  const greetings = [
    'Focus on what matters today.',
    'One step at a time.',
    'Make today count.',
    'You have got this.',
  ];
  const greetingIndex = new Date().getDate() % greetings.length;

  return (
    <div className="flex h-full bg-cx-bg text-[var(--cx-text-1)]">
      {/* Sidebar */}
      <Sidebar
        lists={lists}
        activeListId={activeListId}
        onSelect={setActiveListId}
        onCreateList={createList}
        onDeleteList={deleteList}
        taskCounts={taskCounts}
      />

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="px-6 pt-6 pb-4">
          {activeListId === 'my-day' ? (
            <div>
              <h1 className="text-2xl font-display text-[var(--cx-text-1)] flex items-center gap-3">
                <Sun size={28} className="text-cx-warning" />
                My Day
              </h1>
              <p className="text-sm text-[var(--cx-text-2)] mt-1">
                {getTodayString()} &mdash; {greetings[greetingIndex]}
              </p>
            </div>
          ) : (
            <h1 className="text-2xl font-display text-[var(--cx-text-1)]">
              {activeList?.name ?? 'Tasks'}
            </h1>
          )}
        </header>

        {/* Add task input */}
        <div className="px-6 pb-4">
          <div className="flex items-center gap-3 bg-cx-surface border border-[var(--cx-border-1)] rounded-lg px-4 py-3">
            <Plus size={18} className="text-accent-blue" />
            <input
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') addTask();
              }}
              placeholder="Add a task"
              className="flex-1 bg-transparent text-sm text-[var(--cx-text-1)] placeholder:text-[var(--cx-text-3)] outline-none"
            />
            {newTaskTitle.trim() && (
              <button
                onClick={addTask}
                className="text-xs font-medium text-accent-blue hover:underline"
              >
                Add
              </button>
            )}
          </div>
        </div>

        {/* Task list */}
        <div className="flex-1 overflow-y-auto px-6 pb-6">
          {activeTasks.length === 0 && completedTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-[var(--cx-text-2)]">
              <List size={48} className="mb-3 opacity-30" />
              <p className="text-sm">No tasks yet. Add one above.</p>
            </div>
          ) : (
            <>
              {/* Active tasks */}
              <div className="space-y-1">
                {activeTasks.map((task) => (
                  <TaskItem
                    key={task.id}
                    task={task}
                    onToggle={() => toggleTask(task.id)}
                    onToggleImportant={() => toggleImportant(task.id)}
                    onSelect={() =>
                      setSelectedTaskId(
                        selectedTaskId === task.id ? null : task.id
                      )
                    }
                    isSelected={selectedTaskId === task.id}
                  />
                ))}
              </div>

              {/* Completed tasks */}
              {completedTasks.length > 0 && (
                <div className="mt-6">
                  <button
                    onClick={() => setShowCompleted(!showCompleted)}
                    className="flex items-center gap-2 text-sm text-[var(--cx-text-2)] hover:text-[var(--cx-text-1)] mb-2"
                  >
                    {showCompleted ? (
                      <ChevronDown size={16} />
                    ) : (
                      <ChevronRight size={16} />
                    )}
                    Completed ({completedTasks.length})
                  </button>
                  {showCompleted && (
                    <div className="space-y-1">
                      {completedTasks.map((task) => (
                        <TaskItem
                          key={task.id}
                          task={task}
                          onToggle={() => toggleTask(task.id)}
                          onToggleImportant={() => toggleImportant(task.id)}
                          onSelect={() =>
                            setSelectedTaskId(
                              selectedTaskId === task.id ? null : task.id
                            )
                          }
                          isSelected={selectedTaskId === task.id}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* Detail panel */}
      {selectedTask && (
        <TaskDetailPanel
          task={selectedTask}
          onUpdate={(updates) => updateTask(selectedTask.id, updates)}
          onClose={() => setSelectedTaskId(null)}
        />
      )}
    </div>
  );
}
