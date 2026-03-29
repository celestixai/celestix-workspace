import React, { useState } from 'react';
import { Pencil, Trash2, Plus, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const PRESET_COLORS = [
  '#3B82F6',
  '#EF4444',
  '#10B981',
  '#F59E0B',
  '#8B5CF6',
  '#DC2626',
  '#14B8A6',
  '#60A5FA',
  '#F97316',
  '#22c55e',
];

type StatusGroup = 'not_started' | 'active' | 'done' | 'closed';

interface Status {
  id: string;
  name: string;
  color: string;
  statusGroup: StatusGroup;
  position: number;
}

interface StatusManagerProps {
  statuses: Status[];
  onAdd: (group: StatusGroup, name: string, color: string) => void;
  onUpdate: (id: string, name: string, color: string) => void;
  onDelete: (id: string) => void;
  onReorder?: (id: string, newPosition: number) => void;
}

const GROUP_LABELS: Record<StatusGroup, string> = {
  not_started: 'Not Started',
  active: 'Active',
  done: 'Done',
  closed: 'Closed',
};

const GROUP_COLORS: Record<StatusGroup, string> = {
  not_started: 'text-text-tertiary',
  active: 'text-accent-blue',
  done: 'text-accent-green',
  closed: 'text-text-tertiary',
};

const GROUP_ORDER: StatusGroup[] = ['not_started', 'active', 'done', 'closed'];

function StatusRow({
  status,
  onUpdate,
  onDelete,
}: {
  status: Status;
  onUpdate: (id: string, name: string, color: string) => void;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(status.name);
  const [editColor, setEditColor] = useState(status.color);

  function handleSave() {
    const trimmed = editName.trim();
    if (trimmed) {
      onUpdate(status.id, trimmed, editColor);
    }
    setEditing(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') {
      setEditName(status.name);
      setEditColor(status.color);
      setEditing(false);
    }
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-bg-tertiary">
        <div className="flex items-center gap-1.5 flex-wrap">
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setEditColor(c)}
              className={cn(
                'w-5 h-5 rounded-full transition-all',
                editColor === c ? 'ring-2 ring-accent-blue ring-offset-1 ring-offset-bg-tertiary' : ''
              )}
              style={{ backgroundColor: c }}
              aria-label={`Color ${c}`}
            />
          ))}
        </div>
        <input
          className="flex-1 h-7 px-2 rounded bg-bg-secondary border border-border-secondary text-sm text-text-primary focus:outline-none focus:border-accent-blue"
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
        />
        <Button size="sm" onClick={handleSave}>
          Save
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setEditName(status.name);
            setEditColor(status.color);
            setEditing(false);
          }}
        >
          Cancel
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-bg-hover group transition-colors">
      <GripVertical size={14} className="text-text-tertiary opacity-0 group-hover:opacity-60 cursor-grab flex-shrink-0" />
      <span
        className="w-3 h-3 rounded-full flex-shrink-0"
        style={{ backgroundColor: status.color }}
      />
      <span className="text-sm text-text-primary flex-1 truncate">{status.name}</span>
      <button
        onClick={() => {
          setEditName(status.name);
          setEditColor(status.color);
          setEditing(true);
        }}
        className="p-1 rounded text-text-tertiary hover:text-text-primary hover:bg-bg-active opacity-0 group-hover:opacity-100 transition-opacity"
        aria-label={`Edit ${status.name}`}
      >
        <Pencil size={13} />
      </button>
      <button
        onClick={() => onDelete(status.id)}
        className="p-1 rounded text-text-tertiary hover:text-accent-red hover:bg-bg-active opacity-0 group-hover:opacity-100 transition-opacity"
        aria-label={`Delete ${status.name}`}
      >
        <Trash2 size={13} />
      </button>
    </div>
  );
}

function AddStatusRow({ group, onAdd }: { group: StatusGroup; onAdd: (group: StatusGroup, name: string, color: string) => void }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState(PRESET_COLORS[0]);

  function handleAdd() {
    const trimmed = name.trim();
    if (trimmed) {
      onAdd(group, trimmed, color);
      setName('');
      setColor(PRESET_COLORS[0]);
      setAdding(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleAdd();
    if (e.key === 'Escape') {
      setName('');
      setAdding(false);
    }
  }

  if (adding) {
    return (
      <div className="flex items-center gap-2 px-2 py-1.5">
        <div className="flex items-center gap-1 flex-wrap">
          {PRESET_COLORS.slice(0, 6).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className={cn(
                'w-4 h-4 rounded-full transition-all',
                color === c ? 'ring-2 ring-accent-blue ring-offset-1 ring-offset-bg-secondary' : ''
              )}
              style={{ backgroundColor: c }}
              aria-label={`Color ${c}`}
            />
          ))}
        </div>
        <input
          className="flex-1 h-7 px-2 rounded bg-bg-tertiary border border-border-secondary text-sm text-text-primary focus:outline-none focus:border-accent-blue"
          placeholder="Status name..."
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
        />
        <Button size="sm" onClick={handleAdd}>
          Add
        </Button>
        <Button size="sm" variant="ghost" onClick={() => { setName(''); setAdding(false); }}>
          Cancel
        </Button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setAdding(true)}
      className="flex items-center gap-1.5 px-2 py-1 text-xs text-text-tertiary hover:text-text-secondary transition-colors"
    >
      <Plus size={12} />
      <span>Add Status</span>
    </button>
  );
}

export function StatusManager({ statuses, onAdd, onUpdate, onDelete }: StatusManagerProps) {
  const grouped = GROUP_ORDER.map((group) => ({
    group,
    label: GROUP_LABELS[group],
    colorClass: GROUP_COLORS[group],
    items: statuses
      .filter((s) => s.statusGroup === group)
      .sort((a, b) => a.position - b.position),
  }));

  return (
    <div className="space-y-4">
      {grouped.map(({ group, label, colorClass, items }) => (
        <div key={group}>
          <div className={cn('text-xs font-semibold uppercase tracking-wider mb-1.5 px-2', colorClass)}>
            {label}
          </div>
          <div className="space-y-0.5">
            {items.map((status) => (
              <StatusRow
                key={status.id}
                status={status}
                onUpdate={onUpdate}
                onDelete={onDelete}
              />
            ))}
            <AddStatusRow group={group} onAdd={onAdd} />
          </div>
        </div>
      ))}
    </div>
  );
}
