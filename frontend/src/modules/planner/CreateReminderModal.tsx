import { useState } from 'react';
import { X, Bell } from 'lucide-react';
import { useCreateReminder } from '@/hooks/useReminders';

interface CreateReminderModalProps {
  open: boolean;
  onClose: () => void;
}

export function CreateReminderModal({ open, onClose }: CreateReminderModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState('09:00');

  const createMut = useCreateReminder();

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !dueDate) return;

    const dueAt = new Date(`${dueDate}T${dueTime}:00`).toISOString();
    createMut.mutate(
      { title: title.trim(), description: description.trim() || undefined, dueAt },
      {
        onSuccess: () => {
          setTitle('');
          setDescription('');
          setDueDate('');
          setDueTime('09:00');
          onClose();
        },
      },
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-cx-surface border border-[var(--cx-border-1)] rounded-xl shadow-xl w-full max-w-md mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--cx-border-1)]">
          <div className="flex items-center gap-2">
            <Bell size={18} className="text-accent-blue" />
            <h2 className="text-base font-semibold text-[var(--cx-text-1)]">Add Reminder</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--cx-text-3)] hover:text-[var(--cx-text-1)] hover:bg-[rgba(255,255,255,0.04)] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-xs font-medium text-[var(--cx-text-2)] mb-1.5">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What do you need to remember?"
              maxLength={200}
              className="w-full px-3 py-2 rounded-lg bg-cx-raised border border-[var(--cx-border-1)] text-sm text-[var(--cx-text-1)] placeholder-text-tertiary focus:outline-none focus:border-accent-blue transition-colors"
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-[var(--cx-text-2)] mb-1.5">
              Description <span className="text-[var(--cx-text-3)]">(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add details..."
              rows={3}
              className="w-full px-3 py-2 rounded-lg bg-cx-raised border border-[var(--cx-border-1)] text-sm text-[var(--cx-text-1)] placeholder-text-tertiary focus:outline-none focus:border-accent-blue transition-colors resize-none"
            />
          </div>

          {/* Date & Time */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-[var(--cx-text-2)] mb-1.5">Date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-cx-raised border border-[var(--cx-border-1)] text-sm text-[var(--cx-text-1)] focus:outline-none focus:border-accent-blue transition-colors"
              />
            </div>
            <div className="w-28">
              <label className="block text-xs font-medium text-[var(--cx-text-2)] mb-1.5">Time</label>
              <input
                type="time"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-cx-raised border border-[var(--cx-border-1)] text-sm text-[var(--cx-text-1)] focus:outline-none focus:border-accent-blue transition-colors"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm text-[var(--cx-text-2)] hover:bg-[rgba(255,255,255,0.04)] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!title.trim() || !dueDate || createMut.isPending}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-accent-blue text-white hover:bg-accent-blue/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {createMut.isPending ? 'Creating...' : 'Create Reminder'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
