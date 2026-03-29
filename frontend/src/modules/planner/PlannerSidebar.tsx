import { useState } from 'react';
import {
  Bell,
  Check,
  Clock,
  Plus,
  Trash2,
  AlertTriangle,
  CalendarDays,
  ListTodo,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useReminders, useCompleteReminder, useSnoozeReminder, useDeleteReminder } from '@/hooks/useReminders';
import type { Reminder, SnoozeDuration } from '@/hooks/useReminders';
import { CreateReminderModal } from './CreateReminderModal';

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today.getTime() + 86400000);
  const dateOnly = new Date(d.getFullYear(), d.getMonth(), d.getDate());

  if (dateOnly.getTime() === today.getTime()) return 'Today';
  if (dateOnly.getTime() === tomorrow.getTime()) return 'Tomorrow';
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function ReminderItem({ reminder }: { reminder: Reminder }) {
  const completeMut = useCompleteReminder();
  const snoozeMut = useSnoozeReminder();
  const deleteMut = useDeleteReminder(reminder.id);
  const [showSnooze, setShowSnooze] = useState(false);

  const isOverdue = !reminder.isCompleted && new Date(reminder.dueAt) <= new Date();

  const snoozeOptions: { label: string; value: SnoozeDuration }[] = [
    { label: '15 min', value: '15m' },
    { label: '1 hour', value: '1h' },
    { label: '3 hours', value: '3h' },
    { label: 'Tomorrow', value: 'tomorrow' },
    { label: 'Next week', value: 'next_week' },
  ];

  return (
    <div className={cn(
      'group px-3 py-2 rounded-lg border transition-colors',
      isOverdue
        ? 'border-accent-red/30 bg-accent-red/5'
        : 'border-[var(--cx-border-1)] bg-cx-raised hover:bg-[rgba(255,255,255,0.04)]',
    )}>
      <div className="flex items-start gap-2">
        <button
          onClick={() => completeMut.mutate(reminder.id)}
          className={cn(
            'mt-0.5 w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors',
            reminder.isCompleted
              ? 'bg-accent-emerald border-accent-emerald text-white'
              : 'border-[var(--cx-border-2)] hover:border-accent-blue',
          )}
        >
          {reminder.isCompleted && <Check size={10} />}
        </button>
        <div className="flex-1 min-w-0">
          <p className={cn(
            'text-xs font-medium truncate',
            reminder.isCompleted ? 'text-[var(--cx-text-3)] line-through' : 'text-[var(--cx-text-1)]',
          )}>
            {reminder.title}
          </p>
          <div className="flex items-center gap-1.5 mt-0.5">
            {isOverdue && <AlertTriangle size={10} className="text-accent-red" />}
            <span className={cn(
              'text-[10px]',
              isOverdue ? 'text-accent-red' : 'text-[var(--cx-text-3)]',
            )}>
              {formatDate(reminder.dueAt)} {formatTime(reminder.dueAt)}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => setShowSnooze(!showSnooze)}
            className="p-1 rounded text-[var(--cx-text-3)] hover:text-[var(--cx-text-1)] hover:bg-[rgba(255,255,255,0.04)] transition-colors"
            title="Snooze"
          >
            <Clock size={12} />
          </button>
          <button
            onClick={() => deleteMut.mutate()}
            className="p-1 rounded text-[var(--cx-text-3)] hover:text-accent-red hover:bg-[rgba(255,255,255,0.04)] transition-colors"
            title="Delete"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>
      {showSnooze && (
        <div className="flex flex-wrap gap-1 mt-2 ml-6">
          {snoozeOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => {
                snoozeMut.mutate({ reminderId: reminder.id, duration: opt.value });
                setShowSnooze(false);
              }}
              className="px-2 py-0.5 text-[10px] rounded-full bg-cx-bg border border-[var(--cx-border-2)] text-[var(--cx-text-2)] hover:bg-[rgba(255,255,255,0.04)] transition-colors"
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function PlannerSidebar() {
  const [showCreateModal, setShowCreateModal] = useState(false);

  const { data: overdueReminders } = useReminders('overdue');
  const { data: upcomingReminders } = useReminders('upcoming');

  return (
    <>
      <div className="w-72 border-l border-[var(--cx-border-1)] bg-cx-surface flex flex-col h-full overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Reminders section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5">
                <Bell size={14} className="text-accent-blue" />
                <h3 className="text-xs font-semibold text-[var(--cx-text-1)] uppercase tracking-wider">Reminders</h3>
              </div>
              <button
                onClick={() => setShowCreateModal(true)}
                className="p-1 rounded-lg text-[var(--cx-text-3)] hover:text-accent-blue hover:bg-[rgba(255,255,255,0.04)] transition-colors"
                title="Add Reminder"
              >
                <Plus size={14} />
              </button>
            </div>

            {/* Overdue */}
            {overdueReminders && overdueReminders.length > 0 && (
              <div className="mb-3">
                <p className="text-[10px] font-medium text-accent-red uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <AlertTriangle size={10} />
                  Overdue ({overdueReminders.length})
                </p>
                <div className="space-y-1.5">
                  {overdueReminders.map((r) => (
                    <ReminderItem key={r.id} reminder={r} />
                  ))}
                </div>
              </div>
            )}

            {/* Upcoming */}
            {upcomingReminders && upcomingReminders.length > 0 && (
              <div>
                <p className="text-[10px] font-medium text-[var(--cx-text-3)] uppercase tracking-wider mb-1.5">
                  Upcoming
                </p>
                <div className="space-y-1.5">
                  {upcomingReminders.slice(0, 10).map((r) => (
                    <ReminderItem key={r.id} reminder={r} />
                  ))}
                </div>
              </div>
            )}

            {(!overdueReminders || overdueReminders.length === 0) &&
              (!upcomingReminders || upcomingReminders.length === 0) && (
                <p className="text-xs text-[var(--cx-text-3)] text-center py-4">
                  No reminders. Click + to add one.
                </p>
              )}
          </div>

          {/* My Tasks section (placeholder) */}
          <div>
            <div className="flex items-center gap-1.5 mb-3">
              <ListTodo size={14} className="text-accent-amber" />
              <h3 className="text-xs font-semibold text-[var(--cx-text-1)] uppercase tracking-wider">My Tasks</h3>
            </div>
            <p className="text-xs text-[var(--cx-text-3)] text-center py-4">
              Task overview coming from your assigned tasks.
            </p>
          </div>

          {/* Unplanned section */}
          <div>
            <div className="flex items-center gap-1.5 mb-3">
              <CalendarDays size={14} className="text-[var(--cx-text-3)]" />
              <h3 className="text-xs font-semibold text-[var(--cx-text-1)] uppercase tracking-wider">Unplanned</h3>
            </div>
            <p className="text-xs text-[var(--cx-text-3)] text-center py-4">
              Tasks with no due date will appear here.
            </p>
          </div>
        </div>
      </div>

      <CreateReminderModal open={showCreateModal} onClose={() => setShowCreateModal(false)} />
    </>
  );
}
