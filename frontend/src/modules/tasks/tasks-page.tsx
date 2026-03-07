import { useState, useMemo, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { cn, formatRelativeTime } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Skeleton, CardSkeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/empty-state';
import { Avatar } from '@/components/shared/avatar';
import { Badge } from '@/components/shared/badge';
import { toast } from '@/components/ui/toast';
import {
  Plus,
  LayoutGrid,
  List,
  Search,
  Filter,
  ChevronDown,
  MoreHorizontal,
  Calendar,
  Flag,
  User,
  Tag,
  CheckSquare,
  Circle,
  Clock,
  CheckCircle2,
  XCircle,
  GripVertical,
  X,
  AlertTriangle,
  ArrowUp,
  ArrowDown,
  Minus,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Task {
  id: string;
  title: string;
  descriptionHtml?: string;
  status: TaskStatus;
  priority: Priority;
  assignees: { id: string; displayName: string; avatarUrl?: string }[];
  labels?: string[];
  dueDate?: string;
  projectId: string;
  order: number;
  subtasks?: { id: string; title: string; done: boolean }[];
  createdAt: string;
  updatedAt: string;
}

interface Project {
  id: string;
  name: string;
  color: string;
  taskCounts: Record<TaskStatus, number>;
}

type TaskStatus = 'BACKLOG' | 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE';
type Priority = 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
type ViewMode = 'board' | 'list';

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const STATUS_CONFIG: Record<TaskStatus, { label: string; icon: React.ReactNode; color: string }> = {
  BACKLOG: { label: 'Backlog', icon: <Circle size={14} />, color: 'var(--text-tertiary)' },
  TODO: { label: 'To Do', icon: <Circle size={14} />, color: 'var(--accent-blue)' },
  IN_PROGRESS: { label: 'In Progress', icon: <Clock size={14} />, color: 'var(--accent-amber)' },
  REVIEW: { label: 'Review', icon: <CheckSquare size={14} />, color: 'var(--accent-violet)' },
  DONE: { label: 'Done', icon: <CheckCircle2 size={14} />, color: 'var(--accent-emerald)' },
};

const BOARD_STATUSES: TaskStatus[] = ['BACKLOG', 'TODO', 'IN_PROGRESS', 'REVIEW', 'DONE'];
const ALL_STATUSES: TaskStatus[] = ['BACKLOG', 'TODO', 'IN_PROGRESS', 'REVIEW', 'DONE'];

const PRIORITY_CONFIG: Record<Priority, { label: string; icon: React.ReactNode; color: string }> = {
  URGENT: { label: 'Urgent', icon: <AlertTriangle size={12} />, color: 'var(--accent-red)' },
  HIGH: { label: 'High', icon: <ArrowUp size={12} />, color: 'var(--accent-amber)' },
  MEDIUM: { label: 'Medium', icon: <Minus size={12} />, color: 'var(--accent-blue)' },
  LOW: { label: 'Low', icon: <ArrowDown size={12} />, color: 'var(--text-tertiary)' },
  NONE: { label: 'None', icon: <Minus size={12} />, color: 'var(--text-tertiary)' },
};

const PRIORITY_OPTIONS: Priority[] = ['URGENT', 'HIGH', 'MEDIUM', 'LOW', 'NONE'];

/* ------------------------------------------------------------------ */
/*  Tasks Page                                                         */
/* ------------------------------------------------------------------ */

export function TasksPage() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  const [viewMode, setViewMode] = useState<ViewMode>('board');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPriority, setFilterPriority] = useState<Priority | null>(null);
  const [filterAssignee, setFilterAssignee] = useState<string | null>(null);
  const [filterLabel, setFilterLabel] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [createInStatus, setCreateInStatus] = useState<TaskStatus>('TODO');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);

  /* -- Queries -- */

  const { data: projects = [], isLoading: projectsLoading } = useQuery({
    queryKey: ['task-projects'],
    queryFn: async () => {
      const { data } = await api.get('/tasks/projects');
      return data.data as Project[];
    },
  });

  const activeProjectId = selectedProjectId || projects[0]?.id;
  const activeProject = projects.find((p) => p.id === activeProjectId);

  const { data: tasks = [], isLoading: tasksLoading } = useQuery({
    queryKey: ['tasks', activeProjectId],
    queryFn: async () => {
      const { data } = await api.get(`/tasks/projects/${activeProjectId}/tasks`);
      return data.data as Task[];
    },
    enabled: !!activeProjectId,
  });

  /* -- Filtered tasks -- */

  const allAssignees = useMemo(() => {
    const map = new Map<string, { id: string; displayName: string; avatarUrl?: string }>();
    tasks.forEach((t) =>
      t.assignees?.forEach((a) => {
        if (!map.has(a.id)) map.set(a.id, a);
      })
    );
    return Array.from(map.values());
  }, [tasks]);

  const allLabels = useMemo(() => {
    const set = new Set<string>();
    tasks.forEach((t) => t.labels?.forEach((l) => set.add(l)));
    return Array.from(set).sort();
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    let result = tasks;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.descriptionHtml?.toLowerCase().includes(q)
      );
    }
    if (filterPriority) {
      result = result.filter((t) => t.priority === filterPriority);
    }
    if (filterAssignee) {
      result = result.filter((t) => t.assignees?.some((a) => a.id === filterAssignee));
    }
    if (filterLabel) {
      result = result.filter((t) => t.labels?.includes(filterLabel));
    }
    return result;
  }, [tasks, searchQuery, filterPriority, filterAssignee, filterLabel]);

  const tasksByStatus = useMemo(() => {
    const map: Record<TaskStatus, Task[]> = {
      BACKLOG: [],
      TODO: [],
      IN_PROGRESS: [],
      REVIEW: [],
      DONE: [],
    };
    filteredTasks.forEach((t) => {
      if (map[t.status]) map[t.status].push(t);
    });
    Object.values(map).forEach((arr) => arr.sort((a, b) => a.order - b.order));
    return map;
  }, [filteredTasks]);

  const activeFilterCount =
    (filterPriority ? 1 : 0) + (filterAssignee ? 1 : 0) + (filterLabel ? 1 : 0);

  /* -- Mutations -- */

  const createProject = useMutation({
    mutationFn: async (payload: { name: string; color: string }) => {
      const { data } = await api.post('/tasks/projects', payload);
      return data.data as Project;
    },
    onSuccess: (project) => {
      queryClient.invalidateQueries({ queryKey: ['task-projects'] });
      setSelectedProjectId(project.id);
      setShowCreateProject(false);
      toast('Project created', 'success');
    },
    onError: () => toast('Failed to create project', 'error'),
  });

  const createTask = useMutation({
    mutationFn: async (payload: Partial<Task>) => {
      const { data } = await api.post(`/tasks/projects/${activeProjectId}/tasks`, payload);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['task-projects'] });
      setShowCreateTask(false);
      toast('Task created', 'success');
    },
    onError: () => toast('Failed to create task', 'error'),
  });

  const updateTask = useMutation({
    mutationFn: async ({ id, ...payload }: Partial<Task> & { id: string }) => {
      const { data } = await api.patch(`/tasks/${id}`, payload);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['task-projects'] });
    },
    onError: () => toast('Failed to update task', 'error'),
  });

  const deleteTask = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/tasks/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['task-projects'] });
      setSelectedTask(null);
      toast('Task deleted', 'success');
    },
    onError: () => toast('Failed to delete task', 'error'),
  });

  /* -- Drag and drop -- */

  const handleDragStart = (taskId: string) => setDraggedTaskId(taskId);
  const handleDragOver = (e: React.DragEvent) => e.preventDefault();
  const handleDrop = (status: TaskStatus) => {
    if (!draggedTaskId) return;
    const task = tasks.find((t) => t.id === draggedTaskId);
    if (task && task.status !== status) {
      updateTask.mutate({ id: draggedTaskId, status });
    }
    setDraggedTaskId(null);
  };

  const handleCreateInColumn = (status: TaskStatus) => {
    setCreateInStatus(status);
    setShowCreateTask(true);
  };

  const clearFilters = () => {
    setFilterPriority(null);
    setFilterAssignee(null);
    setFilterLabel(null);
  };

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <div className="flex h-full overflow-hidden">
      {/* ===== Project Sidebar (220px) ===== */}
      <aside className="w-[220px] flex-shrink-0 bg-bg-secondary border-r border-border-primary flex flex-col">
        <div className="h-12 flex items-center justify-between px-4 border-b border-border-primary flex-shrink-0">
          <span className="text-sm font-semibold text-text-primary">Projects</span>
          <button
            onClick={() => setShowCreateProject(true)}
            className="p-1 rounded-lg hover:bg-bg-hover text-text-tertiary hover:text-text-primary transition-colors focus-visible:outline-2 focus-visible:outline-accent-blue"
            aria-label="Create project"
          >
            <Plus size={16} />
          </button>
        </div>

        {/* Project list */}
        <div className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
          {projectsLoading ? (
            <div className="space-y-2 px-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Skeleton className="h-3 w-3 rounded-lg" />
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-3 w-5 ml-auto" />
                </div>
              ))}
            </div>
          ) : projects.length === 0 ? (
            <EmptyState
              icon={<CheckSquare size={28} />}
              title="No projects"
              description="Create your first project"
              className="py-8"
            />
          ) : (
            projects.map((project) => {
              const totalTasks = Object.values(project.taskCounts || {}).reduce(
                (a, b) => a + b,
                0
              );
              return (
                <button
                  key={project.id}
                  onClick={() => setSelectedProjectId(project.id)}
                  className={cn(
                    'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors focus-visible:outline-2 focus-visible:outline-accent-blue',
                    activeProjectId === project.id
                      ? 'bg-bg-active text-text-primary font-medium'
                      : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
                  )}
                >
                  <span
                    className="h-3 w-3 rounded-lg flex-shrink-0"
                    style={{ backgroundColor: project.color }}
                  />
                  <span className="truncate flex-1 text-left">{project.name}</span>
                  <span className="text-xs text-text-tertiary">{totalTasks}</span>
                </button>
              );
            })
          )}
        </div>

        {/* Create project button */}
        <div className="p-3 border-t border-border-primary flex-shrink-0">
          <Button
            variant="secondary"
            size="sm"
            className="w-full"
            onClick={() => setShowCreateProject(true)}
          >
            <Plus size={14} />
            New Project
          </Button>
        </div>
      </aside>

      {/* ===== Main Area ===== */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Toolbar */}
        <div className="h-12 flex items-center gap-3 px-4 border-b border-border-primary flex-shrink-0">
          {/* Search */}
          <div className="relative flex-1 max-w-xs">
            <Search
              size={14}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-tertiary"
            />
            <input
              type="text"
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-8 pl-8 pr-3 rounded-lg bg-bg-tertiary border border-border-primary text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent-blue"
            />
          </div>

          {/* Filters button */}
          <div className="relative">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                'flex items-center gap-1.5 h-8 px-3 rounded-lg border text-sm transition-colors focus-visible:outline-2 focus-visible:outline-accent-blue',
                activeFilterCount > 0
                  ? 'border-accent-blue bg-accent-blue/10 text-accent-blue'
                  : 'border-border-primary text-text-secondary hover:bg-bg-hover'
              )}
            >
              <Filter size={14} />
              Filters
              {activeFilterCount > 0 && (
                <span className="text-[10px] bg-accent-blue text-white px-1.5 py-0.5 rounded-full">
                  {activeFilterCount}
                </span>
              )}
            </button>

            {/* Filter dropdown */}
            {showFilters && (
              <div className="absolute left-0 top-full mt-1 w-64 bg-bg-secondary border border-border-primary rounded-xl shadow-lg z-50 p-3 space-y-3">
                {/* Priority */}
                <div>
                  <label className="text-[11px] font-semibold text-text-tertiary uppercase mb-1.5 block">
                    Priority
                  </label>
                  <select
                    value={filterPriority || ''}
                    onChange={(e) =>
                      setFilterPriority((e.target.value as Priority) || null)
                    }
                    className="w-full h-8 px-2 rounded-lg bg-bg-tertiary border border-border-secondary text-sm text-text-primary focus:outline-none focus:border-accent-blue"
                  >
                    <option value="">All</option>
                    {PRIORITY_OPTIONS.map((p) => (
                      <option key={p} value={p}>
                        {PRIORITY_CONFIG[p].label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Assignee */}
                <div>
                  <label className="text-[11px] font-semibold text-text-tertiary uppercase mb-1.5 block">
                    Assignee
                  </label>
                  <select
                    value={filterAssignee || ''}
                    onChange={(e) => setFilterAssignee(e.target.value || null)}
                    className="w-full h-8 px-2 rounded-lg bg-bg-tertiary border border-border-secondary text-sm text-text-primary focus:outline-none focus:border-accent-blue"
                  >
                    <option value="">All</option>
                    {allAssignees.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.displayName}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Label */}
                {allLabels.length > 0 && (
                  <div>
                    <label className="text-[11px] font-semibold text-text-tertiary uppercase mb-1.5 block">
                      Label
                    </label>
                    <select
                      value={filterLabel || ''}
                      onChange={(e) => setFilterLabel(e.target.value || null)}
                      className="w-full h-8 px-2 rounded-lg bg-bg-tertiary border border-border-secondary text-sm text-text-primary focus:outline-none focus:border-accent-blue"
                    >
                      <option value="">All</option>
                      {allLabels.map((l) => (
                        <option key={l} value={l}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="flex items-center justify-between pt-1">
                  <button
                    onClick={clearFilters}
                    className="text-xs text-accent-blue hover:underline focus-visible:outline-2 focus-visible:outline-accent-blue rounded-lg"
                  >
                    Reset
                  </button>
                  <Button variant="ghost" size="sm" onClick={() => setShowFilters(false)}>
                    Done
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div className="flex-1" />

          {/* View toggle: Board / List */}
          <div className="flex items-center bg-bg-tertiary rounded-lg border border-border-primary p-0.5 flex-shrink-0">
            <button
              onClick={() => setViewMode('board')}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-sm transition-colors focus-visible:outline-2 focus-visible:outline-accent-blue',
                viewMode === 'board'
                  ? 'bg-bg-active text-text-primary shadow-sm'
                  : 'text-text-tertiary hover:text-text-secondary'
              )}
            >
              <LayoutGrid size={14} />
              Board
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-sm transition-colors focus-visible:outline-2 focus-visible:outline-accent-blue',
                viewMode === 'list'
                  ? 'bg-bg-active text-text-primary shadow-sm'
                  : 'text-text-tertiary hover:text-text-secondary'
              )}
            >
              <List size={14} />
              List
            </button>
          </div>

          {/* Create task button */}
          <Button size="sm" onClick={() => handleCreateInColumn('TODO')} disabled={!activeProjectId}>
            <Plus size={14} />
            New Task
          </Button>
        </div>

        {/* Content */}
        {tasksLoading ? (
          <TasksSkeleton viewMode={viewMode} />
        ) : !activeProjectId ? (
          <EmptyState
            icon={<CheckSquare size={48} />}
            title="No project selected"
            description="Create a project to start managing tasks"
            action={
              <Button onClick={() => setShowCreateProject(true)}>
                <Plus size={14} />
                Create Project
              </Button>
            }
            className="flex-1"
          />
        ) : filteredTasks.length === 0 && !searchQuery && !activeFilterCount ? (
          <EmptyState
            icon={<CheckSquare size={48} />}
            title="No tasks yet"
            description="Create your first task to get started"
            action={
              <Button onClick={() => handleCreateInColumn('TODO')}>
                <Plus size={14} />
                Create Task
              </Button>
            }
            className="flex-1"
          />
        ) : viewMode === 'board' ? (
          <BoardView
            tasksByStatus={tasksByStatus}
            onTaskClick={setSelectedTask}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onCreateInColumn={handleCreateInColumn}
          />
        ) : (
          <ListView
            tasks={filteredTasks}
            onTaskClick={setSelectedTask}
            onStatusChange={(id, status) => updateTask.mutate({ id, status })}
          />
        )}
      </main>

      {/* ===== Task Detail Panel (right) ===== */}
      {selectedTask && (
        <TaskDetailPanel
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onUpdate={(updates) => {
            updateTask.mutate({ id: selectedTask.id, ...updates });
            setSelectedTask({ ...selectedTask, ...updates });
          }}
          onDelete={() => deleteTask.mutate(selectedTask.id)}
        />
      )}

      {/* ===== Create Task Modal ===== */}
      <CreateTaskModal
        open={showCreateTask}
        onClose={() => setShowCreateTask(false)}
        onCreate={(payload) => createTask.mutate({ ...payload, status: createInStatus })}
        loading={createTask.isPending}
        defaultStatus={createInStatus}
      />

      {/* ===== Create Project Modal ===== */}
      <CreateProjectModal
        open={showCreateProject}
        onClose={() => setShowCreateProject(false)}
        onCreate={(payload) => createProject.mutate(payload)}
        loading={createProject.isPending}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Board View (Kanban)                                                */
/* ------------------------------------------------------------------ */

function BoardView({
  tasksByStatus,
  onTaskClick,
  onDragStart,
  onDragOver,
  onDrop,
  onCreateInColumn,
}: {
  tasksByStatus: Record<TaskStatus, Task[]>;
  onTaskClick: (task: Task) => void;
  onDragStart: (taskId: string) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (status: TaskStatus) => void;
  onCreateInColumn: (status: TaskStatus) => void;
}) {
  return (
    <div className="flex-1 overflow-x-auto p-4">
      <div className="flex gap-4 h-full min-w-max">
        {BOARD_STATUSES.map((status) => {
          const config = STATUS_CONFIG[status];
          const statusTasks = tasksByStatus[status];
          return (
            <div
              key={status}
              className="w-[280px] flex flex-col bg-bg-secondary/50 rounded-xl border border-border-primary"
              onDragOver={onDragOver}
              onDrop={() => onDrop(status)}
            >
              {/* Column header */}
              <div className="flex items-center gap-2 px-3 py-2.5 flex-shrink-0">
                <span className="flex-shrink-0" style={{ color: config.color }}>{config.icon}</span>
                <span className="text-sm font-medium text-text-primary truncate">{config.label}</span>
                <span className="text-xs text-text-tertiary bg-bg-tertiary px-1.5 py-0.5 rounded-full flex-shrink-0">
                  {statusTasks.length}
                </span>
                <div className="flex-1" />
                <button
                  onClick={() => onCreateInColumn(status)}
                  className="p-1 rounded-lg hover:bg-bg-hover text-text-tertiary hover:text-text-primary transition-colors focus-visible:outline-2 focus-visible:outline-accent-blue"
                  aria-label={`Add task to ${config.label}`}
                >
                  <Plus size={14} />
                </button>
              </div>

              {/* Task cards */}
              <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-2">
                {statusTasks.length === 0 ? (
                  <div className="flex items-center justify-center h-20 text-xs text-text-tertiary">
                    No tasks
                  </div>
                ) : (
                  statusTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onClick={() => onTaskClick(task)}
                      onDragStart={() => onDragStart(task.id)}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Task Card                                                          */
/* ------------------------------------------------------------------ */

function TaskCard({
  task,
  onClick,
  onDragStart,
}: {
  task: Task;
  onClick: () => void;
  onDragStart: () => void;
}) {
  const priorityConf = PRIORITY_CONFIG[task.priority];

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={onClick}
      className="bg-bg-primary border border-border-primary rounded-lg p-3 cursor-pointer hover:border-border-secondary hover:shadow-sm transition-all group"
    >
      {/* Labels */}
      {task.labels && task.labels.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {task.labels.map((label) => (
            <span
              key={label}
              className="px-1.5 py-0.5 rounded-lg text-[10px] font-medium bg-accent-blue/10 text-accent-blue"
            >
              {label}
            </span>
          ))}
        </div>
      )}

      {/* Title */}
      <p className="text-sm font-medium text-text-primary mb-2 line-clamp-2">{task.title}</p>

      {/* Footer: priority badge, due date, assignee avatars */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {task.priority !== 'NONE' && (
            <span
              className="flex items-center gap-0.5 text-[11px] font-medium"
              style={{ color: priorityConf.color }}
            >
              {priorityConf.icon}
              {priorityConf.label}
            </span>
          )}
          {task.dueDate && (
            <span
              className={cn(
                'flex items-center gap-0.5 text-[11px]',
                new Date(task.dueDate) < new Date() && task.status !== 'DONE'
                  ? 'text-accent-red'
                  : 'text-text-tertiary'
              )}
            >
              <Calendar size={10} />
              {new Date(task.dueDate).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
              })}
            </span>
          )}
        </div>

        {task.assignees.length > 0 && (
          <div className="flex -space-x-1.5 flex-shrink-0">
            {task.assignees.slice(0, 3).map((a) => (
              <Avatar key={a.id} src={a.avatarUrl} name={a.displayName} size="xs" />
            ))}
            {task.assignees.length > 3 && (
              <span className="h-6 w-6 rounded-full bg-bg-tertiary text-[10px] text-text-tertiary flex items-center justify-center border border-border-primary">
                +{task.assignees.length - 3}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  List View                                                          */
/* ------------------------------------------------------------------ */

function ListView({
  tasks,
  onTaskClick,
  onStatusChange,
}: {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onStatusChange: (id: string, status: TaskStatus) => void;
}) {
  if (tasks.length === 0) {
    return (
      <EmptyState
        icon={<CheckSquare size={40} />}
        title="No tasks match"
        description="Adjust your search or filters"
        className="flex-1"
      />
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Table header */}
      <div className="grid grid-cols-[1fr_120px_100px_100px_120px] gap-3 px-4 py-2 border-b border-border-primary text-[11px] font-semibold uppercase tracking-wider text-text-tertiary sticky top-0 bg-bg-primary z-10">
        <span>Task</span>
        <span>Status</span>
        <span>Priority</span>
        <span>Assignee</span>
        <span>Due Date</span>
      </div>

      <div className="divide-y divide-border-primary">
        {tasks.map((task) => {
          const statusConf = STATUS_CONFIG[task.status];
          const priorityConf = PRIORITY_CONFIG[task.priority];
          return (
            <div
              key={task.id}
              onClick={() => onTaskClick(task)}
              className="grid grid-cols-[1fr_120px_100px_100px_120px] gap-3 px-4 py-3 hover:bg-bg-hover cursor-pointer transition-colors items-center"
            >
              <div className="min-w-0">
                <span className="text-sm text-text-primary truncate block">{task.title}</span>
                {task.labels && task.labels.length > 0 && (
                  <div className="flex gap-1 mt-0.5">
                    {task.labels.slice(0, 3).map((l) => (
                      <span
                        key={l}
                        className="text-[10px] px-1.5 py-0.5 rounded-lg bg-bg-tertiary text-text-secondary"
                      >
                        {l}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <span
                className="flex items-center gap-1.5 text-xs font-medium min-w-0"
                style={{ color: statusConf.color }}
              >
                <span className="flex-shrink-0">{statusConf.icon}</span>
                <span className="truncate">{statusConf.label}</span>
              </span>
              <span
                className="flex items-center gap-1 text-xs min-w-0"
                style={{ color: priorityConf.color }}
              >
                <span className="flex-shrink-0">{priorityConf.icon}</span>
                <span className="truncate">{priorityConf.label}</span>
              </span>
              <div className="flex -space-x-1">
                {task.assignees.slice(0, 2).map((a) => (
                  <Avatar key={a.id} src={a.avatarUrl} name={a.displayName} size="xs" />
                ))}
                {task.assignees.length > 2 && (
                  <span className="text-[10px] text-text-tertiary ml-1">
                    +{task.assignees.length - 2}
                  </span>
                )}
              </div>
              <span className="text-xs text-text-tertiary">
                {task.dueDate
                  ? new Date(task.dueDate).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })
                  : '--'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Task Detail Panel (right side)                                     */
/* ------------------------------------------------------------------ */

function TaskDetailPanel({
  task,
  onClose,
  onUpdate,
  onDelete,
}: {
  task: Task;
  onClose: () => void;
  onUpdate: (updates: Partial<Task>) => void;
  onDelete: () => void;
}) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.descriptionHtml || '');

  useEffect(() => {
    setTitle(task.title);
    setDescription(task.descriptionHtml || '');
  }, [task.id, task.title, task.descriptionHtml]);

  return (
    <aside className="w-[380px] flex-shrink-0 bg-bg-secondary border-l border-border-primary flex flex-col">
      {/* Header */}
      <div className="h-12 flex items-center justify-between px-4 border-b border-border-primary flex-shrink-0">
        <span className="text-sm font-semibold text-text-primary">Task Detail</span>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={onDelete}
            className="p-1.5 rounded-lg hover:bg-bg-hover text-text-tertiary hover:text-accent-red transition-colors focus-visible:outline-2 focus-visible:outline-accent-blue"
            title="Delete task"
            aria-label="Delete task"
          >
            <XCircle size={16} />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-bg-hover text-text-tertiary hover:text-text-primary transition-colors focus-visible:outline-2 focus-visible:outline-accent-blue"
            aria-label="Close task detail"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Title (editable) */}
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => title !== task.title && onUpdate({ title })}
          className="w-full text-lg font-semibold text-text-primary bg-transparent focus:outline-none"
        />

        {/* Status picker */}
        <div className="flex items-center gap-3">
          <span className="w-20 text-xs text-text-tertiary">Status</span>
          <div className="flex flex-wrap gap-1">
            {ALL_STATUSES.map((s) => {
              const conf = STATUS_CONFIG[s];
              return (
                <button
                  key={s}
                  onClick={() => onUpdate({ status: s })}
                  className={cn(
                    'flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-colors focus-visible:outline-2 focus-visible:outline-accent-blue',
                    task.status === s
                      ? 'bg-bg-active font-medium'
                      : 'hover:bg-bg-hover text-text-tertiary'
                  )}
                  style={{ color: task.status === s ? conf.color : undefined }}
                >
                  {conf.icon}
                  {conf.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Priority picker */}
        <div className="flex items-center gap-3">
          <span className="w-20 text-xs text-text-tertiary">Priority</span>
          <div className="flex gap-1">
            {PRIORITY_OPTIONS.map((p) => {
              const conf = PRIORITY_CONFIG[p];
              return (
                <button
                  key={p}
                  onClick={() => onUpdate({ priority: p })}
                  className={cn(
                    'flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-colors focus-visible:outline-2 focus-visible:outline-accent-blue',
                    task.priority === p
                      ? 'bg-bg-active font-medium'
                      : 'hover:bg-bg-hover text-text-tertiary'
                  )}
                  style={{ color: task.priority === p ? conf.color : undefined }}
                >
                  {conf.icon}
                  {conf.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Assignees */}
        <div className="flex items-center gap-3">
          <span className="w-20 text-xs text-text-tertiary">Assignees</span>
          <div className="flex items-center gap-1">
            {task.assignees.map((a) => (
              <Avatar key={a.id} src={a.avatarUrl} name={a.displayName} size="sm" />
            ))}
            <button
              className="h-8 w-8 rounded-full border border-dashed border-border-secondary flex items-center justify-center text-text-tertiary hover:border-accent-blue hover:text-accent-blue transition-colors focus-visible:outline-2 focus-visible:outline-accent-blue"
              aria-label="Add assignee"
            >
              <Plus size={14} />
            </button>
          </div>
        </div>

        {/* Due date */}
        <div className="flex items-center gap-3">
          <span className="w-20 text-xs text-text-tertiary">Due Date</span>
          <input
            type="date"
            value={task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : ''}
            onChange={(e) => onUpdate({ dueDate: e.target.value || undefined })}
            className="h-8 px-2 rounded-lg bg-bg-tertiary border border-border-secondary text-sm text-text-primary focus:outline-none focus:border-accent-blue"
          />
        </div>

        {/* Labels */}
        {task.labels && task.labels.length > 0 && (
          <div className="flex items-start gap-3">
            <span className="w-20 text-xs text-text-tertiary pt-1">Labels</span>
            <div className="flex flex-wrap gap-1">
              {task.labels.map((l) => (
                <span
                  key={l}
                  className="px-2 py-0.5 rounded-full text-xs bg-accent-blue/10 text-accent-blue"
                >
                  {l}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Description (editable) */}
        <div>
          <label className="text-xs text-text-tertiary mb-1 block">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={() =>
              description !== (task.descriptionHtml || '') && onUpdate({ descriptionHtml: description })
            }
            placeholder="Add a description..."
            rows={4}
            className="w-full px-3 py-2 rounded-lg bg-bg-tertiary border border-border-secondary text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent-blue resize-none"
          />
        </div>

        {/* Metadata */}
        <div className="pt-3 border-t border-border-primary">
          <p className="text-xs text-text-tertiary">
            Created {formatRelativeTime(task.createdAt)}
            {task.updatedAt !== task.createdAt &&
              ` | Updated ${formatRelativeTime(task.updatedAt)}`}
          </p>
        </div>
      </div>
    </aside>
  );
}

/* ------------------------------------------------------------------ */
/*  Create Task Modal                                                  */
/* ------------------------------------------------------------------ */

function CreateTaskModal({
  open,
  onClose,
  onCreate,
  loading,
  defaultStatus,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (payload: Partial<Task>) => void;
  loading: boolean;
  defaultStatus: TaskStatus;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Priority>('MEDIUM');
  const [dueDate, setDueDate] = useState('');

  useEffect(() => {
    if (open) {
      setTitle('');
      setDescription('');
      setPriority('MEDIUM');
      setDueDate('');
    }
  }, [open]);

  const handleCreate = () => {
    if (!title.trim()) {
      toast('Title is required', 'error');
      return;
    }
    onCreate({
      title: title.trim(),
      descriptionHtml: description.trim() || undefined,
      priority,
      dueDate: dueDate || undefined,
      status: defaultStatus,
    });
  };

  return (
    <Modal open={open} onClose={onClose} title="Create Task" size="md">
      <div className="space-y-4">
        <Input
          label="Title"
          placeholder="Task title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text-secondary">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add details..."
            rows={3}
            className="w-full px-3 py-2 rounded-lg bg-bg-tertiary border border-border-secondary text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent-blue resize-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-secondary">Priority</label>
            <div className="flex flex-wrap gap-1">
              {(['URGENT', 'HIGH', 'MEDIUM', 'LOW'] as Priority[]).map((p) => {
                const conf = PRIORITY_CONFIG[p];
                return (
                  <button
                    key={p}
                    onClick={() => setPriority(p)}
                    className={cn(
                      'flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs border transition-colors focus-visible:outline-2 focus-visible:outline-accent-blue',
                      priority === p
                        ? 'border-accent-blue bg-accent-blue/10'
                        : 'border-border-primary hover:bg-bg-hover text-text-secondary'
                    )}
                    style={{ color: priority === p ? conf.color : undefined }}
                  >
                    {conf.icon}
                    {conf.label}
                  </button>
                );
              })}
            </div>
          </div>

          <Input
            label="Due Date"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleCreate} loading={loading} disabled={!title.trim()}>
            Create Task
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/*  Create Project Modal                                               */
/* ------------------------------------------------------------------ */

function CreateProjectModal({
  open,
  onClose,
  onCreate,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (payload: { name: string; color: string }) => void;
  loading: boolean;
}) {
  const [name, setName] = useState('');
  const [color, setColor] = useState('#4F8EF7');

  const PROJECT_COLORS = [
    '#4F8EF7',
    '#8B5CF6',
    '#10B981',
    '#F59E0B',
    '#EF4444',
    '#EC4899',
    '#06B6D4',
    '#6366F1',
  ];

  useEffect(() => {
    if (open) {
      setName('');
      setColor('#4F8EF7');
    }
  }, [open]);

  return (
    <Modal open={open} onClose={onClose} title="Create Project" size="sm">
      <div className="space-y-4">
        <Input
          label="Name"
          placeholder="Project name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text-secondary">Color</label>
          <div className="flex items-center gap-2">
            {PROJECT_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={cn(
                  'h-7 w-7 rounded-full flex items-center justify-center transition-transform focus-visible:outline-2 focus-visible:outline-accent-blue',
                  color === c && 'ring-2 ring-offset-2 ring-offset-bg-secondary scale-110'
                )}
                style={{ backgroundColor: c } as React.CSSProperties}
              >
                {color === c && (
                  <svg width="12" height="12" viewBox="0 0 10 8" fill="none">
                    <path
                      d="M1 4L3.5 6.5L9 1"
                      stroke="white"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => name.trim() && onCreate({ name: name.trim(), color })}
            loading={loading}
            disabled={!name.trim()}
          >
            Create Project
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/*  Loading Skeletons                                                  */
/* ------------------------------------------------------------------ */

function TasksSkeleton({ viewMode }: { viewMode: ViewMode }) {
  if (viewMode === 'board') {
    return (
      <div className="flex-1 overflow-x-auto p-4">
        <div className="flex gap-4 h-full">
          {BOARD_STATUSES.map((s) => (
            <div
              key={s}
              className="w-[280px] flex flex-col bg-bg-secondary/50 rounded-xl border border-border-primary"
            >
              <div className="flex items-center gap-2 px-3 py-2.5">
                <Skeleton className="h-3.5 w-3.5 rounded-full" />
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-4 w-6 ml-auto rounded-full" />
              </div>
              <div className="px-2 pb-2 space-y-2">
                {Array.from({ length: 2 + (BOARD_STATUSES.indexOf(s) % 3) }).map((_, j) => (
                  <CardSkeleton key={j} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-4 space-y-2">
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}
