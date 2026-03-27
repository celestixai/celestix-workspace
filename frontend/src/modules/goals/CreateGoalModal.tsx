import { useState, useCallback } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { useCreateGoal } from '@/hooks/useGoals';
import type { GoalFolder, GoalTargetType } from '@/hooks/useGoals';

interface CreateGoalModalProps {
  workspaceId: string;
  folders: GoalFolder[];
  defaultFolderId?: string | null;
  onClose: () => void;
  onCreated?: () => void;
}

const PRESET_COLORS = [
  '#3b82f6', '#8b5cf6', '#ec4899', '#ef4444',
  '#f59e0b', '#10b981', '#06b6d4', '#6366f1',
];

interface TargetDraft {
  key: number;
  name: string;
  type: GoalTargetType;
  targetValue: string;
  unit: string;
}

let nextKey = 0;

export function CreateGoalModal({ workspaceId, folders, defaultFolderId, onClose, onCreated }: CreateGoalModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [folderId, setFolderId] = useState(defaultFolderId ?? '');
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [dueDate, setDueDate] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [targets, setTargets] = useState<TargetDraft[]>([]);

  const createGoal = useCreateGoal();

  const addTargetDraft = () => {
    setTargets((prev) => [...prev, { key: ++nextKey, name: '', type: 'NUMBER', targetValue: '100', unit: '' }]);
  };

  const updateTargetDraft = (key: number, field: keyof TargetDraft, value: string) => {
    setTargets((prev) => prev.map((t) => (t.key === key ? { ...t, [field]: value } : t)));
  };

  const removeTargetDraft = (key: number) => {
    setTargets((prev) => prev.filter((t) => t.key !== key));
  };

  const handleCreate = useCallback(() => {
    if (!name.trim()) return;
    createGoal.mutate(
      {
        workspaceId,
        folderId: folderId || undefined,
        name: name.trim(),
        description: description.trim() || undefined,
        color,
        dueDate: dueDate || undefined,
        privacy: isPrivate ? 'PRIVATE' : 'PUBLIC',
        targets: targets
          .filter((t) => t.name.trim())
          .map((t) => ({
            name: t.name.trim(),
            type: t.type,
            targetValue: parseFloat(t.targetValue) || 100,
            unit: t.unit || undefined,
          })),
      },
      {
        onSuccess: () => {
          onCreated?.();
          onClose();
        },
      }
    );
  }, [name, description, folderId, color, dueDate, isPrivate, targets, workspaceId, createGoal, onClose, onCreated]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="w-full max-w-lg max-h-[85vh] bg-bg-secondary rounded-2xl border border-border-primary shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-primary">
          <h2 className="text-lg font-semibold text-text-primary">Create Goal</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-bg-hover text-text-tertiary">
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Name *</label>
            <input
              autoFocus
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Goal name"
              className="w-full h-9 px-3 rounded-lg bg-bg-tertiary border border-border-primary text-text-primary text-sm placeholder:text-text-tertiary focus:outline-none focus:border-accent-blue"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this goal about?"
              rows={3}
              className="w-full px-3 py-2 rounded-lg bg-bg-tertiary border border-border-primary text-text-primary text-sm placeholder:text-text-tertiary focus:outline-none focus:border-accent-blue resize-none"
            />
          </div>

          {/* Folder */}
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Folder</label>
            <select
              value={folderId}
              onChange={(e) => setFolderId(e.target.value)}
              className="w-full h-9 px-3 rounded-lg bg-bg-tertiary border border-border-primary text-text-primary text-sm focus:outline-none focus:border-accent-blue"
            >
              <option value="">No folder</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </div>

          {/* Color */}
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Color</label>
            <div className="flex gap-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-full border-2 transition-all ${color === c ? 'border-text-primary scale-110' : 'border-transparent hover:scale-110'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {/* Due date */}
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Due Date</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="h-9 px-3 rounded-lg bg-bg-tertiary border border-border-primary text-text-primary text-sm focus:outline-none focus:border-accent-blue"
            />
          </div>

          {/* Privacy */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-text-secondary">Private</label>
            <button
              onClick={() => setIsPrivate(!isPrivate)}
              className={`relative w-9 h-5 rounded-full transition-colors ${isPrivate ? 'bg-accent-blue' : 'bg-bg-tertiary border border-border-primary'}`}
            >
              <span
                className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${isPrivate ? 'left-[18px]' : 'left-0.5'}`}
              />
            </button>
          </div>

          {/* Targets */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-text-secondary">Targets</label>
              <button
                onClick={addTargetDraft}
                className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium text-accent-blue hover:bg-bg-hover transition-colors"
              >
                <Plus size={12} />
                Add Target
              </button>
            </div>

            <div className="space-y-2">
              {targets.map((t) => (
                <div key={t.key} className="p-3 rounded-lg bg-bg-tertiary border border-border-primary space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={t.name}
                      onChange={(e) => updateTargetDraft(t.key, 'name', e.target.value)}
                      placeholder="Target name"
                      className="flex-1 h-7 px-2 rounded-md bg-bg-secondary border border-border-primary text-text-primary text-xs placeholder:text-text-tertiary focus:outline-none focus:border-accent-blue"
                    />
                    <button
                      onClick={() => removeTargetDraft(t.key)}
                      className="p-1 rounded text-text-tertiary hover:text-accent-red transition-colors"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <select
                      value={t.type}
                      onChange={(e) => updateTargetDraft(t.key, 'type', e.target.value)}
                      className="h-7 px-2 rounded-md bg-bg-secondary border border-border-primary text-text-primary text-xs focus:outline-none focus:border-accent-blue"
                    >
                      <option value="NUMBER">Number</option>
                      <option value="CURRENCY">Currency</option>
                      <option value="TRUE_FALSE">True/False</option>
                      <option value="TASK_COMPLETION">Task Completion</option>
                    </select>
                    {(t.type === 'NUMBER' || t.type === 'CURRENCY') && (
                      <>
                        <input
                          type="number"
                          value={t.targetValue}
                          onChange={(e) => updateTargetDraft(t.key, 'targetValue', e.target.value)}
                          placeholder="Target"
                          className="w-20 h-7 px-2 rounded-md bg-bg-secondary border border-border-primary text-text-primary text-xs focus:outline-none focus:border-accent-blue"
                        />
                        <input
                          type="text"
                          value={t.unit}
                          onChange={(e) => updateTargetDraft(t.key, 'unit', e.target.value)}
                          placeholder="Unit"
                          className="w-20 h-7 px-2 rounded-md bg-bg-secondary border border-border-primary text-text-primary text-xs focus:outline-none focus:border-accent-blue"
                        />
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border-primary">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-medium text-text-secondary hover:bg-bg-hover transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!name.trim() || createGoal.isPending}
            className="px-4 py-2 rounded-lg text-xs font-medium bg-accent-blue text-white hover:bg-accent-blue/90 transition-colors disabled:opacity-50"
          >
            {createGoal.isPending ? 'Creating...' : 'Create Goal'}
          </button>
        </div>
      </div>
    </div>
  );
}
