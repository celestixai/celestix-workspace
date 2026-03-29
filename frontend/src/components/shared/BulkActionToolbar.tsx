import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toast } from '@/components/ui/toast';
import { useListStatuses, type ListStatus } from '@/hooks/useLists';
import {
  X,
  CheckCircle2,
  Flag,
  UserPlus,
  Calendar,
  ArrowRightLeft,
  Trash2,
} from 'lucide-react';

interface BulkActionToolbarProps {
  selectedTaskIds: string[];
  onClearSelection: () => void;
  listId?: string;
  spaceId?: string;
  onActionComplete: () => void;
}

const PRIORITIES = [
  { value: 'URGENT', label: 'Urgent', color: 'text-red-400' },
  { value: 'HIGH', label: 'High', color: 'text-orange-400' },
  { value: 'MEDIUM', label: 'Medium', color: 'text-yellow-400' },
  { value: 'LOW', label: 'Low', color: 'text-blue-400' },
  { value: 'NONE', label: 'None', color: 'text-[rgba(255,255,255,0.40)]' },
];

export function BulkActionToolbar({
  selectedTaskIds,
  onClearSelection,
  listId,
  onActionComplete,
}: BulkActionToolbarProps) {
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [showPriorityMenu, setShowPriorityMenu] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [dateValue, setDateValue] = useState('');

  const { data: statuses } = useListStatuses(listId);

  const bulkMutation = useMutation({
    mutationFn: async (body: { taskIds: string[]; action: string; payload?: Record<string, unknown> }) => {
      const { data } = await api.post('/tasks/bulk-action', body);
      return data.data ?? data;
    },
    onSuccess: (result) => {
      const { successCount, failedCount } = result;
      if (failedCount === 0) {
        toast(`Updated ${successCount} task${successCount !== 1 ? 's' : ''}`, 'success');
      } else {
        toast(`Updated ${successCount}/${successCount + failedCount} tasks (${failedCount} failed)`, 'error');
      }
      onClearSelection();
      onActionComplete();
    },
    onError: () => {
      toast('Bulk action failed', 'error');
    },
  });

  const performAction = (action: string, payload: Record<string, unknown> = {}) => {
    bulkMutation.mutate({ taskIds: selectedTaskIds, action, payload });
    // Close all menus
    setShowStatusMenu(false);
    setShowPriorityMenu(false);
    setShowDatePicker(false);
    setShowDeleteConfirm(false);
  };

  if (selectedTaskIds.length === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-xl bg-bg-secondary border border-border-primary shadow-2xl backdrop-blur-sm">
      {/* Count */}
      <span className="text-sm font-medium text-text-primary whitespace-nowrap">
        {selectedTaskIds.length} task{selectedTaskIds.length !== 1 ? 's' : ''} selected
      </span>

      <div className="w-px h-6 bg-border-secondary" />

      {/* Status */}
      <div className="relative">
        <button
          onClick={() => {
            setShowStatusMenu((p) => !p);
            setShowPriorityMenu(false);
            setShowDatePicker(false);
            setShowDeleteConfirm(false);
          }}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-bg-tertiary hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-colors"
        >
          <CheckCircle2 size={14} />
          Status
        </button>
        {showStatusMenu && (
          <div className="absolute bottom-full mb-2 left-0 min-w-[160px] bg-bg-secondary border border-border-secondary rounded-lg shadow-xl py-1 z-10">
            {statuses && statuses.length > 0 ? (
              statuses.map((s: ListStatus) => (
                <button
                  key={s.id}
                  onClick={() =>
                    performAction('update_status', {
                      statusName: s.name,
                      statusColor: s.color,
                      status: s.type === 'done' ? 'DONE' : s.type === 'in_progress' ? 'IN_PROGRESS' : 'TODO',
                    })
                  }
                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-bg-hover flex items-center gap-2"
                >
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                  {s.name}
                </button>
              ))
            ) : (
              ['BACKLOG', 'TODO', 'IN_PROGRESS', 'REVIEW', 'DONE'].map((st) => (
                <button
                  key={st}
                  onClick={() => performAction('update_status', { status: st })}
                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-bg-hover text-text-secondary"
                >
                  {st.replace('_', ' ')}
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Priority */}
      <div className="relative">
        <button
          onClick={() => {
            setShowPriorityMenu((p) => !p);
            setShowStatusMenu(false);
            setShowDatePicker(false);
            setShowDeleteConfirm(false);
          }}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-bg-tertiary hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-colors"
        >
          <Flag size={14} />
          Priority
        </button>
        {showPriorityMenu && (
          <div className="absolute bottom-full mb-2 left-0 min-w-[140px] bg-bg-secondary border border-border-secondary rounded-lg shadow-xl py-1 z-10">
            {PRIORITIES.map((p) => (
              <button
                key={p.value}
                onClick={() => performAction('update_priority', { priority: p.value })}
                className="w-full text-left px-3 py-1.5 text-xs hover:bg-bg-hover flex items-center gap-2"
              >
                <Flag size={10} className={p.color} />
                <span className="text-text-secondary">{p.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Due Date */}
      <div className="relative">
        <button
          onClick={() => {
            setShowDatePicker((p) => !p);
            setShowStatusMenu(false);
            setShowPriorityMenu(false);
            setShowDeleteConfirm(false);
          }}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-bg-tertiary hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-colors"
        >
          <Calendar size={14} />
          Due Date
        </button>
        {showDatePicker && (
          <div className="absolute bottom-full mb-2 left-0 bg-bg-secondary border border-border-secondary rounded-lg shadow-xl p-3 z-10 flex flex-col gap-2">
            <input
              type="date"
              value={dateValue}
              onChange={(e) => setDateValue(e.target.value)}
              className="text-xs px-2 py-1.5 rounded bg-bg-tertiary border border-border-secondary text-text-primary"
            />
            <div className="flex gap-2">
              <button
                onClick={() => {
                  if (dateValue) {
                    performAction('set_due_date', { dueDate: new Date(dateValue).toISOString() });
                    setDateValue('');
                  }
                }}
                disabled={!dateValue}
                className="flex-1 text-xs px-2 py-1 rounded bg-accent-blue text-white hover:bg-accent-blue/80 disabled:opacity-40 transition-colors"
              >
                Apply
              </button>
              <button
                onClick={() => {
                  performAction('set_due_date', { dueDate: null });
                  setDateValue('');
                }}
                className="text-xs px-2 py-1 rounded bg-bg-tertiary text-text-tertiary hover:text-text-primary transition-colors"
              >
                Clear
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Move */}
      <button
        onClick={() => performAction('move', {})}
        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-bg-tertiary hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-colors opacity-50 cursor-not-allowed"
        title="Move — coming soon"
        disabled
      >
        <ArrowRightLeft size={14} />
        Move
      </button>

      {/* Delete */}
      <div className="relative">
        <button
          onClick={() => {
            setShowDeleteConfirm((p) => !p);
            setShowStatusMenu(false);
            setShowPriorityMenu(false);
            setShowDatePicker(false);
          }}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-colors"
        >
          <Trash2 size={14} />
          Delete
        </button>
        {showDeleteConfirm && (
          <div className="absolute bottom-full mb-2 right-0 bg-bg-secondary border border-border-secondary rounded-lg shadow-xl p-3 z-10 min-w-[200px]">
            <p className="text-xs text-text-secondary mb-2">
              Delete {selectedTaskIds.length} task{selectedTaskIds.length !== 1 ? 's' : ''}? This cannot be undone.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => performAction('delete')}
                className="flex-1 text-xs px-2 py-1.5 rounded bg-red-500 text-white hover:bg-red-600 transition-colors"
              >
                Confirm Delete
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="text-xs px-2 py-1.5 rounded bg-bg-tertiary text-text-tertiary hover:text-text-primary transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="w-px h-6 bg-border-secondary" />

      {/* Deselect all */}
      <button
        onClick={onClearSelection}
        className="flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg hover:bg-bg-hover text-text-tertiary hover:text-text-primary transition-colors"
        title="Deselect all"
      >
        <X size={14} />
      </button>
    </div>
  );
}
