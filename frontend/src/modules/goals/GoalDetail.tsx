import { useState, useCallback } from 'react';
import {
  X, Hash, DollarSign, CheckCircle, ListChecks,
  Plus, Trash2, Users, Lock, Unlock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useGoal, useUpdateGoal, useDeleteGoal,
  useAddTarget, useUpdateTargetProgress,
} from '@/hooks/useGoals';
import type { Goal, GoalTarget } from '@/hooks/useGoals';
import { CircularProgress } from './GoalCard';
import { TargetProgressBar } from './TargetProgressBar';
import { Avatar } from '@/components/shared/avatar';

interface GoalDetailProps {
  goalId: string;
  onClose: () => void;
  onDeleted?: () => void;
}

const PRESET_COLORS = [
  '#3B82F6', '#8B5CF6', '#F97316', '#EF4444',
  '#F59E0B', '#10B981', '#14B8A6', '#60A5FA',
];

const targetTypeIcon: Record<string, typeof Hash> = {
  NUMBER: Hash,
  CURRENCY: DollarSign,
  TRUE_FALSE: CheckCircle,
  TASK_COMPLETION: ListChecks,
};

function TargetRow({ target, goalId }: { target: GoalTarget; goalId: string }) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(String(target.currentValue));
  const updateProgress = useUpdateTargetProgress(target.id);
  const Icon = targetTypeIcon[target.type] || Hash;

  const handleSave = () => {
    const val = parseFloat(editValue);
    if (!isNaN(val)) {
      updateProgress.mutate({ currentValue: val });
    }
    setEditing(false);
  };

  const handleToggle = () => {
    updateProgress.mutate({ currentValue: target.currentValue >= target.targetValue ? 0 : target.targetValue });
  };

  return (
    <div className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-bg-hover transition-colors group">
      <Icon size={14} className="text-text-tertiary flex-shrink-0" />

      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-text-primary truncate">{target.name}</p>

        {target.type === 'TRUE_FALSE' ? (
          <button
            onClick={handleToggle}
            className={cn(
              'mt-1 px-2 py-0.5 rounded-md text-[10px] font-medium transition-colors',
              target.currentValue >= target.targetValue
                ? 'bg-accent-emerald/20 text-accent-emerald'
                : 'bg-bg-tertiary text-text-tertiary hover:bg-bg-hover'
            )}
          >
            {target.currentValue >= target.targetValue ? 'Complete' : 'Incomplete'}
          </button>
        ) : target.type === 'TASK_COMPLETION' ? (
          <div className="mt-1">
            <TargetProgressBar current={target.currentValue} target={target.targetValue} showLabel />
            {target.listName && (
              <span className="text-[10px] text-text-tertiary">Linked: {target.listName}</span>
            )}
          </div>
        ) : (
          <div className="mt-1 flex items-center gap-2">
            <div className="flex-1">
              <TargetProgressBar current={target.currentValue} target={target.targetValue} showLabel />
            </div>
            {editing ? (
              <input
                autoFocus
                type="number"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(false); }}
                onBlur={handleSave}
                className="w-16 h-6 px-1.5 rounded bg-bg-tertiary border border-border-primary text-text-primary text-[10px] focus:outline-none focus:border-accent-blue"
              />
            ) : (
              <button
                onClick={() => { setEditValue(String(target.currentValue)); setEditing(true); }}
                className="text-[10px] text-accent-blue hover:underline"
              >
                {target.currentValue}{target.unit ? ` ${target.unit}` : ''}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function GoalDetail({ goalId, onClose, onDeleted }: GoalDetailProps) {
  const { data: goal, isLoading } = useGoal(goalId);
  const updateGoal = useUpdateGoal(goalId);
  const deleteGoal = useDeleteGoal(goalId);

  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState('');
  const [editingDesc, setEditingDesc] = useState(false);
  const [descValue, setDescValue] = useState('');
  const [showAddTarget, setShowAddTarget] = useState(false);
  const [newTargetName, setNewTargetName] = useState('');
  const [newTargetType, setNewTargetType] = useState<'NUMBER' | 'CURRENCY' | 'TRUE_FALSE' | 'TASK_COMPLETION'>('NUMBER');
  const [newTargetValue, setNewTargetValue] = useState('100');
  const [newTargetUnit, setNewTargetUnit] = useState('');

  const addTarget = useAddTarget(goalId);

  const handleSaveName = useCallback(() => {
    if (nameValue.trim() && nameValue !== goal?.name) {
      updateGoal.mutate({ name: nameValue.trim() });
    }
    setEditingName(false);
  }, [nameValue, goal?.name, updateGoal]);

  const handleSaveDesc = useCallback(() => {
    if (descValue !== (goal?.description || '')) {
      updateGoal.mutate({ description: descValue });
    }
    setEditingDesc(false);
  }, [descValue, goal?.description, updateGoal]);

  const handleAddTarget = useCallback(() => {
    if (!newTargetName.trim()) return;
    addTarget.mutate(
      {
        name: newTargetName.trim(),
        type: newTargetType,
        targetValue: parseFloat(newTargetValue) || 100,
        unit: newTargetUnit || undefined,
      },
      {
        onSuccess: () => {
          setNewTargetName('');
          setNewTargetValue('100');
          setNewTargetUnit('');
          setShowAddTarget(false);
        },
      }
    );
  }, [newTargetName, newTargetType, newTargetValue, newTargetUnit, addTarget]);

  const handleDelete = useCallback(() => {
    if (!confirm('Delete this goal? This cannot be undone.')) return;
    deleteGoal.mutate(undefined, {
      onSuccess: () => {
        onDeleted?.();
        onClose();
      },
    });
  }, [deleteGoal, onClose, onDeleted]);

  if (isLoading || !goal) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="w-full max-w-2xl bg-bg-secondary rounded-2xl border border-border-primary p-8 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-accent-blue/30 border-t-accent-blue rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="w-full max-w-2xl max-h-[85vh] bg-bg-secondary rounded-2xl border border-border-primary shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-primary">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <span
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: goal.color || 'var(--accent-blue)' }}
            />
            {editingName ? (
              <input
                autoFocus
                type="text"
                value={nameValue}
                onChange={(e) => setNameValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') setEditingName(false); }}
                onBlur={handleSaveName}
                className="flex-1 h-8 px-2 rounded-lg bg-bg-tertiary border border-border-primary text-text-primary text-lg font-semibold focus:outline-none focus:border-accent-blue"
              />
            ) : (
              <h2
                className="text-lg font-semibold text-text-primary truncate cursor-pointer hover:text-accent-blue transition-colors"
                onClick={() => { setNameValue(goal.name); setEditingName(true); }}
              >
                {goal.name}
              </h2>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-bg-hover text-text-tertiary transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          {/* Description */}
          <div>
            {editingDesc ? (
              <textarea
                autoFocus
                value={descValue}
                onChange={(e) => setDescValue(e.target.value)}
                onBlur={handleSaveDesc}
                onKeyDown={(e) => { if (e.key === 'Escape') setEditingDesc(false); }}
                placeholder="Add a description..."
                className="w-full h-20 px-3 py-2 rounded-lg bg-bg-tertiary border border-border-primary text-text-primary text-xs placeholder:text-text-tertiary focus:outline-none focus:border-accent-blue resize-none"
              />
            ) : (
              <p
                className="text-xs text-text-secondary cursor-pointer hover:text-text-primary transition-colors"
                onClick={() => { setDescValue(goal.description || ''); setEditingDesc(true); }}
              >
                {goal.description || 'Click to add a description...'}
              </p>
            )}
          </div>

          {/* Progress ring */}
          <div className="flex justify-center">
            <CircularProgress
              percentage={goal.progress ?? 0}
              color={goal.color || 'var(--accent-blue)'}
              size={120}
            />
          </div>

          {/* Targets */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Targets</h3>
              <button
                onClick={() => setShowAddTarget(true)}
                className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium text-accent-blue hover:bg-bg-hover transition-colors"
              >
                <Plus size={12} />
                Add Target
              </button>
            </div>

            <div className="space-y-1">
              {goal.targets?.map((target) => (
                <TargetRow key={target.id} target={target} goalId={goalId} />
              ))}
            </div>

            {goal.targets?.length === 0 && !showAddTarget && (
              <p className="text-xs text-text-tertiary text-center py-4">No targets yet. Add one to track progress.</p>
            )}

            {/* Add target form */}
            {showAddTarget && (
              <div className="mt-2 p-3 rounded-lg bg-bg-tertiary border border-border-primary space-y-2">
                <input
                  autoFocus
                  type="text"
                  value={newTargetName}
                  onChange={(e) => setNewTargetName(e.target.value)}
                  placeholder="Target name"
                  className="w-full h-7 px-2 rounded-md bg-bg-secondary border border-border-primary text-text-primary text-xs placeholder:text-text-tertiary focus:outline-none focus:border-accent-blue"
                />
                <div className="flex gap-2">
                  <select
                    value={newTargetType}
                    onChange={(e) => setNewTargetType(e.target.value as typeof newTargetType)}
                    className="h-7 px-2 rounded-md bg-bg-secondary border border-border-primary text-text-primary text-xs focus:outline-none focus:border-accent-blue"
                  >
                    <option value="NUMBER">Number</option>
                    <option value="CURRENCY">Currency</option>
                    <option value="TRUE_FALSE">True/False</option>
                    <option value="TASK_COMPLETION">Task Completion</option>
                  </select>
                  {(newTargetType === 'NUMBER' || newTargetType === 'CURRENCY') && (
                    <>
                      <input
                        type="number"
                        value={newTargetValue}
                        onChange={(e) => setNewTargetValue(e.target.value)}
                        placeholder="Target"
                        className="w-20 h-7 px-2 rounded-md bg-bg-secondary border border-border-primary text-text-primary text-xs focus:outline-none focus:border-accent-blue"
                      />
                      <input
                        type="text"
                        value={newTargetUnit}
                        onChange={(e) => setNewTargetUnit(e.target.value)}
                        placeholder="Unit"
                        className="w-20 h-7 px-2 rounded-md bg-bg-secondary border border-border-primary text-text-primary text-xs focus:outline-none focus:border-accent-blue"
                      />
                    </>
                  )}
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setShowAddTarget(false)}
                    className="px-3 py-1 rounded-md text-xs text-text-secondary hover:bg-bg-hover transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddTarget}
                    disabled={addTarget.isPending}
                    className="px-3 py-1 rounded-md text-xs font-medium bg-accent-blue text-white hover:bg-accent-blue/90 transition-colors disabled:opacity-50"
                  >
                    Add
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Members */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Members</h3>
              <button className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium text-accent-blue hover:bg-bg-hover transition-colors">
                <Plus size={12} />
                Add Member
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {goal.members?.map((member) => (
                <div key={member.id} className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-bg-tertiary">
                  <Avatar
                    src={member.user.avatarUrl}
                    name={member.user.displayName}
                    size="xs"
                    userId={member.user.id}
                  />
                  <span className="text-[10px] text-text-primary">{member.user.displayName}</span>
                  <span className="text-[9px] text-text-tertiary bg-bg-secondary px-1 rounded capitalize">
                    {member.role.toLowerCase()}
                  </span>
                </div>
              ))}
              {(!goal.members || goal.members.length === 0) && (
                <p className="text-xs text-text-tertiary">No members added.</p>
              )}
            </div>
          </div>

          {/* Settings */}
          <div>
            <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Settings</h3>
            <div className="space-y-2">
              {/* Color */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-text-tertiary w-16">Color</span>
                <div className="flex gap-1.5">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => updateGoal.mutate({ color: c })}
                      className={cn(
                        'w-5 h-5 rounded-full border-2 transition-all',
                        goal.color === c ? 'border-text-primary scale-110' : 'border-transparent hover:scale-110'
                      )}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              {/* Due date */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-text-tertiary w-16">Due</span>
                <input
                  type="date"
                  value={goal.dueDate ? goal.dueDate.split('T')[0] : ''}
                  onChange={(e) => updateGoal.mutate({ dueDate: e.target.value || null })}
                  className="h-7 px-2 rounded-md bg-bg-tertiary border border-border-primary text-text-primary text-xs focus:outline-none focus:border-accent-blue"
                />
              </div>

              {/* Privacy */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-text-tertiary w-16">Privacy</span>
                <button
                  onClick={() => updateGoal.mutate({ privacy: goal.privacy === 'PUBLIC' ? 'PRIVATE' : 'PUBLIC' })}
                  className={cn(
                    'flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-colors',
                    goal.privacy === 'PRIVATE'
                      ? 'bg-accent-amber/20 text-accent-amber'
                      : 'bg-bg-tertiary text-text-secondary hover:bg-bg-hover'
                  )}
                >
                  {goal.privacy === 'PRIVATE' ? <Lock size={12} /> : <Unlock size={12} />}
                  {goal.privacy === 'PRIVATE' ? 'Private' : 'Public'}
                </button>
              </div>
            </div>
          </div>

          {/* Danger zone */}
          <div className="pt-3 border-t border-border-primary">
            <button
              onClick={handleDelete}
              disabled={deleteGoal.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-accent-red hover:bg-accent-red/10 transition-colors disabled:opacity-50"
            >
              <Trash2 size={14} />
              Delete Goal
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
