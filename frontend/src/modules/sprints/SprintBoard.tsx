import { useState } from 'react';
import { useSprintTasks, useRemoveTaskFromSprint, useAddTasksToSprint } from '@/hooks/useSprints';
import type { SprintTask } from '@/hooks/useSprints';
import { Plus, X, User } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  sprintId: string;
  sprintStatus: string;
}

const STATUS_COLUMNS = [
  { key: 'BACKLOG', label: 'Backlog', color: 'bg-[var(--cx-text-2)]' },
  { key: 'TODO', label: 'To Do', color: 'bg-cx-brand' },
  { key: 'IN_PROGRESS', label: 'In Progress', color: 'bg-cx-warning' },
  { key: 'REVIEW', label: 'Review', color: 'bg-purple-400' },
  { key: 'DONE', label: 'Done', color: 'bg-cx-success' },
];

export function SprintBoard({ sprintId, sprintStatus }: Props) {
  const { data: tasks, isLoading } = useSprintTasks(sprintId);
  const removeMutation = useRemoveTaskFromSprint(sprintId);
  const addMutation = useAddTasksToSprint(sprintId);
  const [addTaskInput, setAddTaskInput] = useState('');
  const [showAddInput, setShowAddInput] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48 text-[var(--cx-text-2)] text-sm">
        Loading sprint tasks...
      </div>
    );
  }

  const tasksByStatus = (status: string) =>
    (tasks ?? []).filter((t) => (t.statusName || t.status) === status || t.status === status);

  const handleRemoveTask = (taskId: string) => {
    if (confirm('Remove this task from the sprint?')) {
      removeMutation.mutate(taskId);
    }
  };

  const handleAddTasks = () => {
    const ids = addTaskInput.split(',').map((s) => s.trim()).filter(Boolean);
    if (ids.length > 0) {
      addMutation.mutate(ids, {
        onSuccess: () => {
          setAddTaskInput('');
          setShowAddInput(false);
        },
      });
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Add tasks bar */}
      {sprintStatus !== 'COMPLETE' && sprintStatus !== 'CLOSED' && (
        <div className="flex items-center gap-2 mb-3">
          {showAddInput ? (
            <div className="flex items-center gap-2 flex-1">
              <input
                type="text"
                value={addTaskInput}
                onChange={(e) => setAddTaskInput(e.target.value)}
                placeholder="Paste task IDs (comma-separated)"
                className="flex-1 px-3 py-1.5 text-sm bg-cx-surface border border-[rgba(255,255,255,0.08)]rounded-lg text-[var(--cx-text-1)] placeholder:text-[var(--cx-text-3)] focus:outline-none focus:ring-1 focus:ring-accent-blue"
                onKeyDown={(e) => e.key === 'Enter' && handleAddTasks()}
              />
              <button
                onClick={handleAddTasks}
                className="px-3 py-1.5 text-sm bg-accent-blue text-white rounded-lg hover:bg-accent-blue/90"
              >
                Add
              </button>
              <button
                onClick={() => { setShowAddInput(false); setAddTaskInput(''); }}
                className="p-1.5 text-[var(--cx-text-2)] hover:bg-cx-raised rounded-lg"
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowAddInput(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-[var(--cx-text-2)] hover:bg-cx-surface rounded-lg border border-dashed border-[rgba(255,255,255,0.08)]"
            >
              <Plus size={14} />
              Add Tasks
            </button>
          )}
        </div>
      )}

      {/* Kanban columns */}
      <div className="flex gap-3 flex-1 overflow-x-auto pb-2">
        {STATUS_COLUMNS.map((col) => {
          const colTasks = tasksByStatus(col.key);
          return (
            <div key={col.key} className="flex-shrink-0 w-60 flex flex-col">
              {/* Column header */}
              <div className="flex items-center gap-2 mb-2 px-1">
                <div className={cn('w-2 h-2 rounded-full', col.color)} />
                <span className="text-xs font-medium text-[var(--cx-text-2)] uppercase tracking-wide">
                  {col.label}
                </span>
                <span className="text-xs text-[var(--cx-text-3)]">({colTasks.length})</span>
              </div>

              {/* Cards */}
              <div className="flex-1 space-y-2 overflow-y-auto pr-1">
                {colTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onRemove={() => handleRemoveTask(task.id)}
                    canRemove={sprintStatus !== 'COMPLETE' && sprintStatus !== 'CLOSED'}
                  />
                ))}
                {colTasks.length === 0 && (
                  <div className="text-xs text-[var(--cx-text-3)] text-center py-6 border border-dashed border-[rgba(255,255,255,0.08)]rounded-lg">
                    No tasks
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TaskCard({ task, onRemove, canRemove }: { task: SprintTask; onRemove: () => void; canRemove: boolean }) {
  const priorityColors: Record<string, string> = {
    URGENT: 'border-l-red-500',
    HIGH: 'border-l-orange-500',
    MEDIUM: 'border-l-yellow-500',
    LOW: 'border-l-blue-400',
    NONE: 'border-l-transparent',
  };

  return (
    <div
      className={cn(
        'bg-cx-surface border border-[rgba(255,255,255,0.08)]rounded-lg p-2.5 group relative border-l-[3px]',
        priorityColors[task.priority] || 'border-l-transparent'
      )}
    >
      {canRemove && (
        <button
          onClick={onRemove}
          className="absolute top-1.5 right-1.5 p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-cx-raised text-[var(--cx-text-3)]"
        >
          <X size={12} />
        </button>
      )}

      <div className="text-sm text-[var(--cx-text-1)] leading-snug mb-1.5 pr-4">{task.title}</div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {task.storyPoints != null && (
            <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium bg-accent-blue/10 text-accent-blue rounded">
              {task.storyPoints} SP
            </span>
          )}
          {task.dueDate && (
            <span className="text-[10px] text-[var(--cx-text-3)]">
              {new Date(task.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
            </span>
          )}
        </div>
        <div className="flex -space-x-1.5">
          {task.assignees.slice(0, 2).map((a) => (
            <div
              key={a.user.id}
              className="w-5 h-5 rounded-full bg-cx-raised border border-bg-secondary flex items-center justify-center"
              title={a.user.displayName}
            >
              {a.user.avatarUrl ? (
                <img src={a.user.avatarUrl} className="w-full h-full rounded-full object-cover" alt="" />
              ) : (
                <User size={10} className="text-[var(--cx-text-3)]" />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
