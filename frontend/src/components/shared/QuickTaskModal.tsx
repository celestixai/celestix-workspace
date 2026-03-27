import { useState, useCallback, useRef, useEffect } from 'react';
import { X, Sparkles, Flag, Calendar, List } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useAIStatus } from '@/hooks/useAI';

interface QuickTaskModalProps {
  open: boolean;
  onClose: () => void;
}

const priorityOptions = [
  { value: 'URGENT', label: 'Urgent', color: 'text-accent-red' },
  { value: 'HIGH', label: 'High', color: 'text-accent-amber' },
  { value: 'NORMAL', label: 'Normal', color: 'text-accent-blue' },
  { value: 'LOW', label: 'Low', color: 'text-text-tertiary' },
] as const;

export function QuickTaskModal({ open, onClose }: QuickTaskModalProps) {
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<string>('NORMAL');
  const [dueDate, setDueDate] = useState('');
  const [listId, setListId] = useState('');
  const [creating, setCreating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { data: aiStatus } = useAIStatus();
  const aiAvailable = aiStatus?.isAvailable ?? false;

  useEffect(() => {
    if (open) {
      setTitle('');
      setPriority('NORMAL');
      setDueDate('');
      setListId('');
      setCreating(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const handleCreate = useCallback(async () => {
    if (!title.trim()) return;
    setCreating(true);
    try {
      // Dispatch to tasks store / API — for now we log and close
      // This would be: await api.post('/tasks', { title, priority, dueDate, listId });
      console.log('Quick task created:', { title, priority, dueDate, listId });
      onClose();
    } catch {
      setCreating(false);
    }
  }, [title, priority, dueDate, listId, onClose]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && title.trim()) {
      e.preventDefault();
      handleCreate();
    }
    if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]" role="dialog" aria-modal="true" aria-label="Quick task creation">
      <div className="fixed inset-0 bg-black/60" onClick={onClose} />

      <div className="relative w-[calc(100%-2rem)] max-w-lg bg-bg-secondary border border-border-primary rounded-xl shadow-lg overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-primary">
          <h2 className="text-sm font-semibold text-text-primary">New Task</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-colors"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-3" onKeyDown={handleKeyDown}>
          {/* Title */}
          <input
            ref={inputRef}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Task title..."
            className="w-full h-10 px-3 rounded-lg bg-bg-tertiary border border-border-primary text-text-primary placeholder:text-text-tertiary text-sm outline-none focus:border-accent-blue transition-colors"
            aria-label="Task title"
          />

          {/* Options row */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Priority */}
            <div className="flex items-center gap-1 bg-bg-tertiary rounded-lg border border-border-primary px-2 py-1.5">
              <Flag size={14} className="text-text-tertiary" />
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="bg-transparent text-xs text-text-secondary outline-none cursor-pointer"
                aria-label="Priority"
              >
                {priorityOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Due date */}
            <div className="flex items-center gap-1 bg-bg-tertiary rounded-lg border border-border-primary px-2 py-1.5">
              <Calendar size={14} className="text-text-tertiary" />
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="bg-transparent text-xs text-text-secondary outline-none cursor-pointer"
                aria-label="Due date"
              />
            </div>

            {/* List selector (placeholder) */}
            <div className="flex items-center gap-1 bg-bg-tertiary rounded-lg border border-border-primary px-2 py-1.5">
              <List size={14} className="text-text-tertiary" />
              <input
                value={listId}
                onChange={(e) => setListId(e.target.value)}
                placeholder="List..."
                className="bg-transparent text-xs text-text-secondary outline-none w-16 placeholder:text-text-tertiary"
                aria-label="List"
              />
            </div>

            {/* AI Autofill */}
            {aiAvailable && (
              <button
                onClick={() => {
                  // AI autofill stub
                  console.log('AI autofill triggered');
                }}
                className="flex items-center gap-1 bg-bg-tertiary rounded-lg border border-border-primary px-2 py-1.5 text-accent-purple hover:bg-accent-purple/10 transition-colors"
                title="AI Autofill"
              >
                <Sparkles size={14} />
                <span className="text-xs">AI</span>
              </button>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-border-primary">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={handleCreate} loading={creating} disabled={!title.trim()}>
            Create
          </Button>
        </div>
      </div>
    </div>
  );
}
