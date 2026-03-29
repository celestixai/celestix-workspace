import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useFolder } from '@/hooks/useFolders';
import { useSpace } from '@/hooks/useSpaces';
import { StatusManager } from './StatusManager';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { cn } from '@/lib/utils';
import { ArrowLeft, Trash2 } from 'lucide-react';

const PRESET_COLORS = [
  '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6',
  '#DC2626', '#14B8A6', '#60A5FA', '#F97316', '#22c55e',
];

type Tab = 'general' | 'statuses' | 'danger';

interface FolderSettingsPageProps {
  folderId: string;
  spaceId: string;
  onBack: () => void;
}

interface FolderStatus {
  id: string;
  name: string;
  color: string;
  statusGroup: 'not_started' | 'active' | 'done' | 'closed';
  position: number;
}

interface FolderDetail {
  id: string;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  spaceId: string;
  useCustomStatuses?: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export function FolderSettingsPage({ folderId, spaceId, onBack }: FolderSettingsPageProps) {
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

      <h2 className="text-xl font-semibold text-text-primary mb-6">Folder Settings</h2>

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

      {tab === 'general' && <GeneralTab folderId={folderId} />}
      {tab === 'statuses' && <StatusesTab folderId={folderId} spaceId={spaceId} />}
      {tab === 'danger' && <DangerTab folderId={folderId} spaceId={spaceId} onBack={onBack} />}
    </div>
  );
}

/* ─── General Tab ─── */
function GeneralTab({ folderId }: { folderId: string }) {
  const qc = useQueryClient();
  const { data: folder } = useFolder(folderId);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [icon, setIcon] = useState('');
  const [initialized, setInitialized] = useState(false);

  if (folder && !initialized) {
    setName(folder.name);
    setDescription((folder as any).description ?? '');
    setColor((folder as any).color || PRESET_COLORS[0]);
    setIcon((folder as any).icon ?? '');
    setInitialized(true);
  }

  const updateFolder = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const { data } = await api.patch(`/folders/${folderId}`, payload);
      return data.data ?? data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['folder', folderId] });
      qc.invalidateQueries({ queryKey: ['folders'] });
    },
  });

  function handleSave() {
    updateFolder.mutate({ name: name.trim(), description, color, icon });
  }

  return (
    <div className="max-w-lg space-y-5">
      <Input label="Folder Name" value={name} onChange={(e) => setName(e.target.value)} />

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

      <Input label="Icon" value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="e.g. folder-open" />

      <Button onClick={handleSave} loading={updateFolder.isPending}>
        Save Changes
      </Button>
      {updateFolder.isSuccess && (
        <span className="text-xs text-accent-green ml-3">Saved!</span>
      )}
    </div>
  );
}

/* ─── Statuses Tab ─── */
function StatusesTab({ folderId, spaceId }: { folderId: string; spaceId: string }) {
  const qc = useQueryClient();
  const { data: space } = useSpace(spaceId);
  const queryKey = ['folder-statuses', folderId];

  const { data: folderDetail } = useQuery<FolderDetail>({
    queryKey: ['folder-detail', folderId],
    queryFn: async () => {
      const { data } = await api.get(`/folders/${folderId}`);
      return data.data ?? data;
    },
    enabled: !!folderId,
  });

  const { data: statuses = [], isLoading } = useQuery<FolderStatus[]>({
    queryKey,
    queryFn: async () => {
      const { data } = await api.get(`/folders/${folderId}/statuses`);
      return data.data ?? data;
    },
    enabled: !!folderId,
  });

  const enableCustom = useMutation({
    mutationFn: async () => {
      const { data } = await api.post(`/folders/${folderId}/statuses/custom`);
      return data.data ?? data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      qc.invalidateQueries({ queryKey: ['folder-detail', folderId] });
    },
  });

  const revertInherited = useMutation({
    mutationFn: async () => {
      await api.delete(`/folders/${folderId}/statuses/custom`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      qc.invalidateQueries({ queryKey: ['folder-detail', folderId] });
    },
  });

  const addStatus = useMutation({
    mutationFn: async (payload: { statusGroup: string; name: string; color: string }) => {
      const { data } = await api.post(`/folders/${folderId}/statuses`, payload);
      return data.data ?? data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, name, color }: { id: string; name: string; color: string }) => {
      const { data } = await api.patch(`/folders/folder-statuses/${id}`, { name, color });
      return data.data ?? data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  const deleteStatus = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/folders/folder-statuses/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  const useCustom = folderDetail?.useCustomStatuses ?? false;

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
        <p className="text-xs text-text-tertiary">Custom statuses for this folder.</p>
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
function DangerTab({ folderId, spaceId, onBack }: { folderId: string; spaceId: string; onBack: () => void }) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const qc = useQueryClient();

  const deleteFolder = useMutation({
    mutationFn: async () => {
      await api.delete(`/folders/${folderId}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['folders', spaceId] });
      setConfirmOpen(false);
      onBack();
    },
  });

  return (
    <div className="max-w-lg">
      <div className="border border-accent-red/40 rounded-lg p-5">
        <h3 className="text-sm font-semibold text-accent-red mb-2">Delete Folder</h3>
        <p className="text-xs text-text-secondary mb-4">
          This will permanently delete the folder and all its lists and tasks. This action cannot be undone.
        </p>
        <Button variant="danger" onClick={() => setConfirmOpen(true)}>
          <Trash2 size={14} />
          Delete Folder
        </Button>
      </div>

      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} title="Delete Folder">
        <p className="text-sm text-text-secondary mb-4">
          Are you sure? This will permanently delete this folder and all its lists and tasks.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirmOpen(false)}>Cancel</Button>
          <Button variant="danger" onClick={() => deleteFolder.mutate()} loading={deleteFolder.isPending}>
            Delete
          </Button>
        </div>
      </Modal>
    </div>
  );
}
