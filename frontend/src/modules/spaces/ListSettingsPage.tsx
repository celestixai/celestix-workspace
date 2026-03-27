import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useList } from '@/hooks/useLists';
import { useSpace } from '@/hooks/useSpaces';
import { StatusManager } from './StatusManager';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { cn } from '@/lib/utils';
import { ArrowLeft, Trash2 } from 'lucide-react';

const PRESET_COLORS = [
  '#4A90D9', '#E91E63', '#4CAF50', '#F59E0B', '#8B5CF6',
  '#EF4444', '#10B981', '#06B6D4', '#F97316', '#6366F1',
];

type Tab = 'general' | 'statuses' | 'danger';

interface ListSettingsPageProps {
  listId: string;
  spaceId: string;
  onBack: () => void;
}

interface ListStatusItem {
  id: string;
  name: string;
  color: string;
  statusGroup: 'not_started' | 'active' | 'done' | 'closed';
  position: number;
}

interface ListDetail {
  id: string;
  name: string;
  description?: string;
  color?: string;
  spaceId?: string;
  folderId?: string;
  useCustomStatuses?: boolean;
  dueDate?: string;
  startDate?: string;
  priority?: string;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export function ListSettingsPage({ listId, spaceId, onBack }: ListSettingsPageProps) {
  const [tab, setTab] = useState<Tab>('general');

  const tabs: { key: Tab; label: string }[] = [
    { key: 'general', label: 'General' },
    { key: 'statuses', label: 'Statuses' },
    { key: 'danger', label: 'Danger Zone' },
  ];

  return (
    <div className="flex-1 overflow-auto p-6">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-text-tertiary hover:text-text-primary transition-colors mb-4"
      >
        <ArrowLeft size={14} />
        Back
      </button>

      <h2 className="text-xl font-semibold text-text-primary mb-6">List Settings</h2>

      <div className="flex items-center gap-1 border-b border-border-primary mb-6">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px',
              tab === t.key
                ? 'text-accent-blue border-accent-blue'
                : 'text-text-tertiary border-transparent hover:text-text-secondary'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'general' && <GeneralTab listId={listId} />}
      {tab === 'statuses' && <StatusesTab listId={listId} spaceId={spaceId} />}
      {tab === 'danger' && <DangerTab listId={listId} spaceId={spaceId} onBack={onBack} />}
    </div>
  );
}

/* ─── General Tab ─── */
function GeneralTab({ listId }: { listId: string }) {
  const qc = useQueryClient();
  const { data: list } = useList(listId);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [dueDate, setDueDate] = useState('');
  const [startDate, setStartDate] = useState('');
  const [priority, setPriority] = useState('none');
  const [initialized, setInitialized] = useState(false);

  if (list && !initialized) {
    setName(list.name);
    const ld = list as any;
    setDescription(ld.description ?? '');
    setColor(ld.color || PRESET_COLORS[0]);
    setDueDate(ld.dueDate?.slice(0, 10) ?? '');
    setStartDate(ld.startDate?.slice(0, 10) ?? '');
    setPriority(ld.priority ?? 'none');
    setInitialized(true);
  }

  const updateList = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const { data } = await api.patch(`/task-lists/${listId}`, payload);
      return data.data ?? data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['list', listId] });
      qc.invalidateQueries({ queryKey: ['lists'] });
    },
  });

  function handleSave() {
    updateList.mutate({
      name: name.trim(),
      description,
      color,
      dueDate: dueDate || null,
      startDate: startDate || null,
      priority,
    });
  }

  return (
    <div className="max-w-lg space-y-5">
      <Input label="List Name" value={name} onChange={(e) => setName(e.target.value)} />

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-text-secondary">Description</label>
        <textarea
          className="w-full h-24 px-3 py-2 rounded-lg bg-bg-tertiary border border-border-secondary text-sm text-text-primary placeholder:text-text-tertiary resize-none transition-all hover:border-border-primary focus:border-accent-blue focus:ring-1 focus:ring-accent-blue/30 focus:outline-none"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-text-secondary">Color</label>
        <div className="flex items-center gap-2">
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className={cn(
                'w-7 h-7 rounded-full transition-all',
                color === c ? 'ring-2 ring-accent-blue ring-offset-2 ring-offset-bg-secondary' : ''
              )}
              style={{ backgroundColor: c }}
              aria-label={`Color ${c}`}
            />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text-secondary">Start Date</label>
          <input
            type="date"
            className="w-full h-9 px-3 rounded-lg bg-bg-tertiary border border-border-secondary text-sm text-text-primary transition-all hover:border-border-primary focus:border-accent-blue focus:ring-1 focus:ring-accent-blue/30 focus:outline-none"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text-secondary">Due Date</label>
          <input
            type="date"
            className="w-full h-9 px-3 rounded-lg bg-bg-tertiary border border-border-secondary text-sm text-text-primary transition-all hover:border-border-primary focus:border-accent-blue focus:ring-1 focus:ring-accent-blue/30 focus:outline-none"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-text-secondary">Priority</label>
        <select
          className="w-full h-9 px-3 rounded-lg bg-bg-tertiary border border-border-secondary text-sm text-text-primary transition-all hover:border-border-primary focus:border-accent-blue focus:outline-none cursor-pointer"
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
        >
          <option value="none">None</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="urgent">Urgent</option>
        </select>
      </div>

      <Button onClick={handleSave} loading={updateList.isPending}>
        Save Changes
      </Button>
      {updateList.isSuccess && (
        <span className="text-xs text-accent-green ml-3">Saved!</span>
      )}
    </div>
  );
}

/* ─── Statuses Tab ─── */
function StatusesTab({ listId, spaceId }: { listId: string; spaceId: string }) {
  const qc = useQueryClient();
  const { data: space } = useSpace(spaceId);
  const queryKey = ['list-custom-statuses', listId];

  const { data: listDetail } = useQuery<ListDetail>({
    queryKey: ['list-detail', listId],
    queryFn: async () => {
      const { data } = await api.get(`/task-lists/${listId}`);
      return data.data ?? data;
    },
    enabled: !!listId,
  });

  const { data: statuses = [], isLoading } = useQuery<ListStatusItem[]>({
    queryKey,
    queryFn: async () => {
      const { data } = await api.get(`/task-lists/${listId}/statuses`);
      return data.data ?? data;
    },
    enabled: !!listId,
  });

  const enableCustom = useMutation({
    mutationFn: async () => {
      const { data } = await api.post(`/task-lists/${listId}/statuses/custom`);
      return data.data ?? data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      qc.invalidateQueries({ queryKey: ['list-detail', listId] });
    },
  });

  const revertInherited = useMutation({
    mutationFn: async () => {
      await api.delete(`/task-lists/${listId}/statuses/custom`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      qc.invalidateQueries({ queryKey: ['list-detail', listId] });
    },
  });

  const addStatus = useMutation({
    mutationFn: async (payload: { statusGroup: string; name: string; color: string }) => {
      const { data } = await api.post(`/task-lists/${listId}/statuses`, payload);
      return data.data ?? data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, name, color }: { id: string; name: string; color: string }) => {
      const { data } = await api.patch(`/task-lists/list-statuses/${id}`, { name, color });
      return data.data ?? data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  const deleteStatus = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/task-lists/list-statuses/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  const useCustom = listDetail?.useCustomStatuses ?? false;

  if (isLoading) {
    return <div className="text-sm text-text-tertiary">Loading statuses...</div>;
  }

  if (!useCustom) {
    return (
      <div className="max-w-lg">
        <div className="bg-bg-tertiary border border-border-secondary rounded-lg p-4 mb-4">
          <p className="text-sm text-text-secondary mb-3">
            Inheriting statuses from <strong className="text-text-primary">{space?.name ?? 'Space'}</strong>
          </p>
          <Button size="sm" variant="outline" onClick={() => enableCustom.mutate()} loading={enableCustom.isPending}>
            Use Custom Statuses
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-text-tertiary">Custom statuses for this list.</p>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => revertInherited.mutate()}
          loading={revertInherited.isPending}
        >
          Revert to Inherited
        </Button>
      </div>
      <StatusManager
        statuses={statuses}
        onAdd={(group, name, color) => addStatus.mutate({ statusGroup: group, name, color })}
        onUpdate={(id, name, color) => updateStatus.mutate({ id, name, color })}
        onDelete={(id) => deleteStatus.mutate(id)}
      />
    </div>
  );
}

/* ─── Danger Zone Tab ─── */
function DangerTab({ listId, spaceId, onBack }: { listId: string; spaceId: string; onBack: () => void }) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const qc = useQueryClient();

  const deleteList = useMutation({
    mutationFn: async () => {
      await api.delete(`/task-lists/${listId}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lists'] });
      setConfirmOpen(false);
      onBack();
    },
  });

  return (
    <div className="max-w-lg">
      <div className="border border-accent-red/40 rounded-lg p-5">
        <h3 className="text-sm font-semibold text-accent-red mb-2">Delete List</h3>
        <p className="text-xs text-text-secondary mb-4">
          This will permanently delete the list and all its tasks. This action cannot be undone.
        </p>
        <Button variant="danger" onClick={() => setConfirmOpen(true)}>
          <Trash2 size={14} />
          Delete List
        </Button>
      </div>

      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} title="Delete List">
        <p className="text-sm text-text-secondary mb-4">
          Are you sure? This will permanently delete this list and all its tasks.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirmOpen(false)}>Cancel</Button>
          <Button variant="danger" onClick={() => deleteList.mutate()} loading={deleteList.isPending}>
            Delete
          </Button>
        </div>
      </Modal>
    </div>
  );
}
