import React, { useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useCreateSpace } from '@/hooks/useSpaces';
import { cn } from '@/lib/utils';

const PRESET_COLORS = [
  '#4A90D9',
  '#E91E63',
  '#4CAF50',
  '#F59E0B',
  '#8B5CF6',
  '#EF4444',
  '#10B981',
  '#06B6D4',
  '#F97316',
  '#6366F1',
];

interface CreateSpaceModalProps {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
}

export function CreateSpaceModal({ open, onClose, workspaceId }: CreateSpaceModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [icon, setIcon] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [error, setError] = useState('');

  const createSpace = useCreateSpace(workspaceId);

  function resetForm() {
    setName('');
    setDescription('');
    setColor(PRESET_COLORS[0]);
    setIcon('');
    setIsPrivate(false);
    setError('');
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Name is required');
      return;
    }
    if (trimmed.length > 100) {
      setError('Name must be 100 characters or less');
      return;
    }
    setError('');
    try {
      await createSpace.mutateAsync({
        name: trimmed,
        description: description.trim() || undefined,
        color,
        icon: icon.trim() || undefined,
      });
      handleClose();
    } catch {
      setError('Failed to create space. Please try again.');
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title="Create Space">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Name"
          placeholder="e.g. Engineering"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={error}
          autoFocus
          required
          maxLength={100}
        />

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text-secondary">Description</label>
          <textarea
            className="w-full h-20 px-3 py-2 rounded-lg bg-bg-tertiary border border-border-secondary text-sm text-text-primary placeholder:text-text-tertiary transition-all duration-150 ease-out hover:border-border-primary focus:border-accent-blue focus:ring-1 focus:ring-accent-blue/30 focus:outline-none resize-none"
            placeholder="Optional description..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text-secondary">Color</label>
          <div className="flex items-center gap-2 flex-wrap">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={cn(
                  'w-7 h-7 rounded-full transition-all duration-150 flex-shrink-0',
                  color === c
                    ? 'ring-2 ring-offset-2 ring-offset-bg-secondary ring-accent-blue scale-110'
                    : 'hover:scale-110'
                )}
                style={{ backgroundColor: c }}
                aria-label={`Select color ${c}`}
              />
            ))}
            <div
              className="w-5 h-5 rounded-full border border-border-secondary ml-2"
              style={{ backgroundColor: color }}
              title={`Selected: ${color}`}
            />
          </div>
        </div>

        <Input
          label="Icon"
          placeholder="e.g. code, palette, rocket"
          value={icon}
          onChange={(e) => setIcon(e.target.value)}
        />

        <div className="flex items-center gap-2">
          <button
            type="button"
            role="switch"
            aria-checked={isPrivate}
            onClick={() => setIsPrivate(!isPrivate)}
            className={cn(
              'relative w-9 h-5 rounded-full transition-colors duration-200 flex-shrink-0',
              isPrivate ? 'bg-accent-blue' : 'bg-bg-tertiary border border-border-secondary'
            )}
          >
            <span
              className={cn(
                'absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200',
                isPrivate && 'translate-x-4'
              )}
            />
          </button>
          <span className="text-sm text-text-secondary">Private Space</span>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit" loading={createSpace.isPending}>
            Create Space
          </Button>
        </div>
      </form>
    </Modal>
  );
}
