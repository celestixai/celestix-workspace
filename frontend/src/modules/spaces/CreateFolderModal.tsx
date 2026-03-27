import React, { useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useCreateFolder } from '@/hooks/useFolders';
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

interface CreateFolderModalProps {
  open: boolean;
  onClose: () => void;
  spaceId: string;
  parentFolderId?: string;
}

export function CreateFolderModal({ open, onClose, spaceId, parentFolderId }: CreateFolderModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [icon, setIcon] = useState('');
  const [error, setError] = useState('');

  const createFolder = useCreateFolder(spaceId);

  function resetForm() {
    setName('');
    setDescription('');
    setColor(PRESET_COLORS[0]);
    setIcon('');
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
      await createFolder.mutateAsync({ name: trimmed });
      handleClose();
    } catch {
      setError('Failed to create folder. Please try again.');
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title="Create Folder">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Name"
          placeholder="e.g. Frontend"
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
          </div>
        </div>

        <Input
          label="Icon"
          placeholder="e.g. folder, archive"
          value={icon}
          onChange={(e) => setIcon(e.target.value)}
        />

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit" loading={createFolder.isPending}>
            Create Folder
          </Button>
        </div>
      </form>
    </Modal>
  );
}
