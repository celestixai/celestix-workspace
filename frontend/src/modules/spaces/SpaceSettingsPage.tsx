import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useSpace, useUpdateSpace, useDeleteSpace } from '@/hooks/useSpaces';
import { useTaskTypes, useCreateTaskType, useUpdateTaskType, useDeleteTaskType } from '@/hooks/useTaskTypes';
import { StatusManager } from './StatusManager';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { cn } from '@/lib/utils';
import { ArrowLeft, Trash2, X, Shield, ChevronDown, Plus, Pencil, CheckSquare, Bug, Star, Flag, Circle } from 'lucide-react';

const PRESET_COLORS = [
  '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6',
  '#DC2626', '#14B8A6', '#60A5FA', '#F97316', '#22c55e',
];

type Tab = 'general' | 'statuses' | 'task-types' | 'members' | 'danger';

interface SpaceSettingsPageProps {
  spaceId: string;
  onBack: () => void;
}

interface SpaceStatus {
  id: string;
  name: string;
  color: string;
  statusGroup: 'not_started' | 'active' | 'done' | 'closed';
  position: number;
}

interface SpaceMember {
  id: string;
  userId: string;
  displayName: string;
  email: string;
  username?: string;
  avatarUrl?: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'GUEST';
}

const ROLES = ['OWNER', 'ADMIN', 'MEMBER', 'GUEST'] as const;

export function SpaceSettingsPage({ spaceId, onBack }: SpaceSettingsPageProps) {
  const [tab, setTab] = useState<Tab>('general');

  const tabs: { key: Tab; label: string }[] = [
    { key: 'general', label: 'General' },
    { key: 'statuses', label: 'Statuses' },
    { key: 'task-types', label: 'Task Types' },
    { key: 'members', label: 'Members' },
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

      <h2 className="text-xl font-semibold text-text-primary mb-6">Space Settings</h2>

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

      {tab === 'general' && <GeneralTab spaceId={spaceId} />}
      {tab === 'statuses' && <StatusesTab spaceId={spaceId} />}
      {tab === 'task-types' && <TaskTypesTab spaceId={spaceId} />}
      {tab === 'members' && <MembersTab spaceId={spaceId} />}
      {tab === 'danger' && <DangerTab spaceId={spaceId} onBack={onBack} />}
    </div>
  );
}

/* ─── General Tab ─── */
function GeneralTab({ spaceId }: { spaceId: string }) {
  const { data: space } = useSpace(spaceId);
  const updateSpace = useUpdateSpace(spaceId);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [icon, setIcon] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [taskIdPrefix, setTaskIdPrefix] = useState('');
  const [prefixSaved, setPrefixSaved] = useState(false);
  const qc = useQueryClient();

  const savePrefix = useMutation({
    mutationFn: async (prefix: string) => {
      const { data } = await api.patch(`/spaces/${spaceId}/task-id-prefix`, { prefix });
      return data.data ?? data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['space', spaceId] });
      setPrefixSaved(true);
      setTimeout(() => setPrefixSaved(false), 2000);
    },
  });

  if (space && !initialized) {
    setName(space.name);
    setDescription(space.description ?? '');
    setColor(space.color || PRESET_COLORS[0]);
    setIcon(space.icon ?? '');
    setTaskIdPrefix((space as any).taskIdPrefix ?? '');
    setInitialized(true);
  }

  function handleSave() {
    updateSpace.mutate({ name: name.trim(), description, color, icon });
  }

  function handleSavePrefix() {
    if (taskIdPrefix.trim().length >= 2) {
      savePrefix.mutate(taskIdPrefix.trim().toUpperCase());
    }
  }

  return (
    <div className="max-w-lg space-y-5">
      <Input label="Space Name" value={name} onChange={(e) => setName(e.target.value)} />

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

      <Input label="Icon" value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="e.g. rocket, star" />

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-text-secondary">Privacy</label>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsPrivate(false)}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium border transition-colors',
              !isPrivate
                ? 'border-accent-blue bg-accent-blue/10 text-accent-blue'
                : 'border-border-secondary text-text-tertiary hover:text-text-secondary'
            )}
          >
            Public
          </button>
          <button
            onClick={() => setIsPrivate(true)}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium border transition-colors',
              isPrivate
                ? 'border-accent-blue bg-accent-blue/10 text-accent-blue'
                : 'border-border-secondary text-text-tertiary hover:text-text-secondary'
            )}
          >
            Private
          </button>
        </div>
      </div>

      <Button onClick={handleSave} loading={updateSpace.isPending}>
        Save Changes
      </Button>
      {updateSpace.isSuccess && (
        <span className="text-xs text-accent-green ml-3">Saved!</span>
      )}

      {/* Task ID Prefix */}
      <div className="border-t border-border-secondary pt-5 mt-5">
        <h3 className="text-sm font-semibold text-text-primary mb-1">Task ID Prefix</h3>
        <p className="text-xs text-text-tertiary mb-3">
          Set a prefix for auto-generated task IDs. New tasks will be numbered sequentially.
        </p>
        <div className="flex items-center gap-2">
          <Input
            value={taskIdPrefix}
            onChange={(e) => setTaskIdPrefix(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 10))}
            placeholder="e.g. ENG"
            className="w-40"
          />
          <Button size="sm" onClick={handleSavePrefix} loading={savePrefix.isPending} disabled={taskIdPrefix.trim().length < 2}>
            Set Prefix
          </Button>
          {prefixSaved && (
            <span className="text-xs text-accent-green">Saved!</span>
          )}
        </div>
        {taskIdPrefix.trim().length >= 2 && (
          <p className="text-xs text-text-tertiary mt-2">
            Tasks will be numbered as: <span className="font-mono text-text-secondary">{taskIdPrefix.trim().toUpperCase()}-001</span>, <span className="font-mono text-text-secondary">{taskIdPrefix.trim().toUpperCase()}-002</span>, ...
          </p>
        )}
        {savePrefix.isError && (
          <p className="text-xs text-accent-red mt-1">
            {(savePrefix.error as any)?.response?.data?.error?.message || 'Failed to set prefix'}
          </p>
        )}
      </div>
    </div>
  );
}

/* ─── Statuses Tab ─── */
function StatusesTab({ spaceId }: { spaceId: string }) {
  const qc = useQueryClient();
  const queryKey = ['space-statuses', spaceId];

  const { data: statuses = [], isLoading } = useQuery<SpaceStatus[]>({
    queryKey,
    queryFn: async () => {
      const { data } = await api.get(`/spaces/${spaceId}/statuses`);
      return data.data ?? data;
    },
    enabled: !!spaceId,
  });

  const addStatus = useMutation({
    mutationFn: async (payload: { statusGroup: string; name: string; color: string }) => {
      const { data } = await api.post(`/spaces/${spaceId}/statuses`, payload);
      return data.data ?? data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, name, color }: { id: string; name: string; color: string }) => {
      const { data } = await api.patch(`/spaces/statuses/${id}`, { name, color });
      return data.data ?? data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  const deleteStatus = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/spaces/statuses/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  if (isLoading) {
    return <div className="text-sm text-text-tertiary">Loading statuses...</div>;
  }

  return (
    <div className="max-w-lg">
      <p className="text-xs text-text-tertiary mb-4">
        These statuses are inherited by all Folders and Lists in this Space unless they use custom statuses.
      </p>
      <StatusManager
        statuses={statuses}
        onAdd={(group, name, color) => addStatus.mutate({ statusGroup: group, name, color })}
        onUpdate={(id, name, color) => updateStatus.mutate({ id, name, color })}
        onDelete={(id) => deleteStatus.mutate(id)}
      />
    </div>
  );
}

/* ─── Members Tab ─── */
function MembersTab({ spaceId }: { spaceId: string }) {
  const qc = useQueryClient();
  const queryKey = ['space-members', spaceId];
  const [addEmail, setAddEmail] = useState('');

  const { data: members = [], isLoading } = useQuery<SpaceMember[]>({
    queryKey,
    queryFn: async () => {
      const { data } = await api.get(`/spaces/${spaceId}/members`);
      return data.data ?? data;
    },
    enabled: !!spaceId,
  });

  const updateRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      await api.patch(`/spaces/${spaceId}/members/${userId}`, { role });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  const removeMember = useMutation({
    mutationFn: async (userId: string) => {
      await api.delete(`/spaces/${spaceId}/members/${userId}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  const addMember = useMutation({
    mutationFn: async (email: string) => {
      await api.post(`/spaces/${spaceId}/members`, { email });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      setAddEmail('');
    },
  });

  if (isLoading) {
    return <div className="text-sm text-text-tertiary">Loading members...</div>;
  }

  return (
    <div className="max-w-lg space-y-6">
      {/* Add member */}
      <div>
        <label className="text-sm font-medium text-text-secondary mb-1.5 block">Add Member</label>
        <div className="flex items-center gap-2">
          <Input
            placeholder="Email address..."
            value={addEmail}
            onChange={(e) => setAddEmail(e.target.value)}
            className="flex-1"
          />
          <Button
            size="sm"
            onClick={() => addEmail.trim() && addMember.mutate(addEmail.trim())}
            loading={addMember.isPending}
          >
            Add
          </Button>
        </div>
      </div>

      {/* Member list */}
      <div className="space-y-1">
        {members.map((m) => (
          <div
            key={m.userId}
            className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-bg-hover transition-colors group"
          >
            <div className="w-8 h-8 rounded-full bg-accent-blue/20 text-accent-blue text-xs font-semibold flex items-center justify-center flex-shrink-0">
              {m.displayName?.slice(0, 2).toUpperCase() || m.email?.slice(0, 2).toUpperCase() || '??'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-text-primary truncate">{m.displayName || 'Unknown'}</p>
              <p className="text-xs text-text-tertiary truncate">{m.username ? `@${m.username}` : m.email}</p>
            </div>
            <div className="relative">
              <select
                value={m.role}
                onChange={(e) => updateRole.mutate({ userId: m.userId, role: e.target.value })}
                className="appearance-none text-xs px-2 py-1 pr-6 rounded bg-bg-tertiary border border-border-secondary text-text-secondary focus:outline-none focus:border-accent-blue cursor-pointer"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
              <ChevronDown size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none" />
            </div>
            <button
              onClick={() => removeMember.mutate(m.userId)}
              className="p-1 rounded text-text-tertiary hover:text-accent-red hover:bg-bg-active opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label={`Remove ${m.displayName}`}
            >
              <X size={14} />
            </button>
          </div>
        ))}
        {members.length === 0 && (
          <p className="text-sm text-text-tertiary py-4 text-center">No members yet</p>
        )}
      </div>
    </div>
  );
}

/* ─── Task Types Tab ─── */
const TASK_TYPE_ICON_MAP: Record<string, React.ElementType> = {
  'check-square': CheckSquare,
  bug: Bug,
  star: Star,
  flag: Flag,
};

const TASK_TYPE_PRESET_COLORS = [
  '#3B82F6', '#EF4444', '#8B5CF6', '#F97316', '#10B981',
  '#DC2626', '#14B8A6', '#60A5FA', '#F59E0B', '#22c55e',
];

function TaskTypesTab({ spaceId }: { spaceId: string }) {
  const { data: taskTypes = [], isLoading } = useTaskTypes(spaceId);
  const createTaskType = useCreateTaskType(spaceId);
  const updateTaskType = useUpdateTaskType(spaceId);
  const deleteTaskType = useDeleteTaskType(spaceId);

  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('');
  const [color, setColor] = useState(TASK_TYPE_PRESET_COLORS[0]);
  const [description, setDescription] = useState('');

  function resetForm() {
    setName('');
    setIcon('');
    setColor(TASK_TYPE_PRESET_COLORS[0]);
    setDescription('');
    setShowAdd(false);
    setEditId(null);
  }

  function handleAdd() {
    if (!name.trim()) return;
    createTaskType.mutate(
      { name: name.trim(), icon: icon || undefined, color, description: description || undefined },
      { onSuccess: resetForm }
    );
  }

  function handleEdit(tt: { id: string; name: string; icon?: string | null; color?: string | null; description?: string | null }) {
    setEditId(tt.id);
    setName(tt.name);
    setIcon(tt.icon ?? '');
    setColor(tt.color ?? TASK_TYPE_PRESET_COLORS[0]);
    setDescription(tt.description ?? '');
    setShowAdd(false);
  }

  function handleUpdate() {
    if (!editId || !name.trim()) return;
    updateTaskType.mutate(
      { typeId: editId, name: name.trim(), icon: icon || undefined, color, description: description || undefined },
      { onSuccess: resetForm }
    );
  }

  function renderIcon(iconName: string | null | undefined, iconColor: string | null | undefined, size = 16) {
    const IconComp = iconName ? TASK_TYPE_ICON_MAP[iconName] : null;
    if (IconComp) {
      return <IconComp size={size} style={{ color: iconColor || undefined }} />;
    }
    return <Circle size={size} style={{ color: iconColor || undefined, fill: iconColor || undefined }} />;
  }

  if (isLoading) {
    return <div className="text-sm text-text-tertiary">Loading task types...</div>;
  }

  return (
    <div className="max-w-lg">
      <p className="text-xs text-text-tertiary mb-4">
        Task types help categorize tasks in this space. Each new space comes with default types.
      </p>

      {/* List existing types */}
      <div className="space-y-1 mb-4">
        {taskTypes.map((tt) => (
          <div
            key={tt.id}
            className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-bg-hover transition-colors group"
          >
            {renderIcon(tt.icon, tt.color)}
            <span
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: tt.color || '#888' }}
            />
            <span className="text-sm text-text-primary flex-1">{tt.name}</span>
            {tt.isDefault && (
              <span className="text-[10px] text-accent-blue bg-accent-blue/10 px-1.5 py-0.5 rounded">Default</span>
            )}
            <button
              onClick={() => handleEdit(tt)}
              className="p-1 rounded text-text-tertiary hover:text-text-primary hover:bg-bg-active opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label={`Edit ${tt.name}`}
            >
              <Pencil size={12} />
            </button>
            <button
              onClick={() => deleteTaskType.mutate(tt.id)}
              className="p-1 rounded text-text-tertiary hover:text-accent-red hover:bg-bg-active opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label={`Delete ${tt.name}`}
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}
        {taskTypes.length === 0 && (
          <p className="text-sm text-text-tertiary py-4 text-center">No task types configured</p>
        )}
      </div>

      {/* Add / Edit form */}
      {(showAdd || editId) && (
        <div className="border border-border-secondary rounded-lg p-4 space-y-3 mb-3">
          <h4 className="text-sm font-medium text-text-primary">{editId ? 'Edit Task Type' : 'New Task Type'}</h4>
          <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Epic" />
          <Input label="Icon" value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="e.g. check-square, bug, star, flag" />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-secondary">Color</label>
            <div className="flex items-center gap-2 flex-wrap">
              {TASK_TYPE_PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={cn(
                    'w-6 h-6 rounded-full transition-all',
                    color === c ? 'ring-2 ring-accent-blue ring-offset-1 ring-offset-bg-secondary' : ''
                  )}
                  style={{ backgroundColor: c }}
                  aria-label={`Color ${c}`}
                />
              ))}
            </div>
          </div>
          <Input label="Description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description" />
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={editId ? handleUpdate : handleAdd} loading={createTaskType.isPending || updateTaskType.isPending}>
              {editId ? 'Update' : 'Create'}
            </Button>
            <Button size="sm" variant="ghost" onClick={resetForm}>Cancel</Button>
          </div>
        </div>
      )}

      {!showAdd && !editId && (
        <Button size="sm" variant="ghost" onClick={() => setShowAdd(true)}>
          <Plus size={14} />
          Add Task Type
        </Button>
      )}
    </div>
  );
}

/* ─── Danger Zone Tab ─── */
function DangerTab({ spaceId, onBack }: { spaceId: string; onBack: () => void }) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const deleteSpace = useDeleteSpace(spaceId);

  function handleDelete() {
    deleteSpace.mutate(undefined, {
      onSuccess: () => {
        setConfirmOpen(false);
        onBack();
      },
    });
  }

  return (
    <div className="max-w-lg">
      <div className="border border-accent-red/40 rounded-lg p-5">
        <h3 className="text-sm font-semibold text-accent-red mb-2">Delete Space</h3>
        <p className="text-xs text-text-secondary mb-4">
          This will permanently delete the space and all its folders, lists, and tasks. This action cannot be undone.
        </p>
        <Button variant="danger" onClick={() => setConfirmOpen(true)}>
          <Trash2 size={14} />
          Delete Space
        </Button>
      </div>

      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} title="Delete Space">
        <p className="text-sm text-text-secondary mb-4">
          Are you sure? This will permanently delete the space and all its folders, lists, and tasks.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirmOpen(false)}>Cancel</Button>
          <Button variant="danger" onClick={handleDelete} loading={deleteSpace.isPending}>
            Delete
          </Button>
        </div>
      </Modal>
    </div>
  );
}
