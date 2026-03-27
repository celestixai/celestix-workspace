import { useState } from 'react';
import { useRelationships, useCreateRelationship, useDeleteRelationship, useDependencyWarnings } from '@/hooks/useRelationships';
import type { RelationType, RelationshipEntry } from '@/hooks/useRelationships';
import { Modal } from '@/components/ui/modal';
import { Link2, ArrowRight, Clock, X, Plus, AlertTriangle, Search } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

interface TaskRelationshipsProps {
  taskId: string;
  projectId?: string;
}

interface SearchTask {
  id: string;
  title: string;
  status: string;
  customTaskId?: string;
}

const TYPE_LABELS: Record<RelationType, string> = {
  BLOCKS: 'Blocking',
  WAITING_ON: 'Waiting On',
  LINKED_TO: 'Linked To',
};

const TYPE_ICONS: Record<RelationType, React.ElementType> = {
  BLOCKS: ArrowRight,
  WAITING_ON: Clock,
  LINKED_TO: Link2,
};

const TYPE_COLORS: Record<RelationType, string> = {
  BLOCKS: 'text-accent-red',
  WAITING_ON: 'text-orange-400',
  LINKED_TO: 'text-accent-blue',
};

function RelationshipGroup({
  label,
  icon: Icon,
  color,
  entries,
  onDelete,
}: {
  label: string;
  icon: React.ElementType;
  color: string;
  entries: RelationshipEntry[];
  onDelete: (id: string) => void;
}) {
  if (entries.length === 0) return null;

  return (
    <div className="mb-3">
      <div className="flex items-center gap-1.5 mb-1.5">
        <Icon size={12} className={color} />
        <span className="text-xs font-medium text-text-secondary">{label}</span>
        <span className="text-[10px] text-text-tertiary">({entries.length})</span>
      </div>
      <div className="space-y-1">
        {entries.map((entry) => (
          <div
            key={entry.id}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-bg-tertiary hover:bg-bg-hover transition-colors group"
          >
            {entry.task.customTaskId && (
              <span className="text-[10px] font-mono text-text-tertiary">{entry.task.customTaskId}</span>
            )}
            <span className="text-sm text-text-primary flex-1 truncate">{entry.task.title}</span>
            <span className="text-[10px] text-text-tertiary px-1.5 py-0.5 rounded bg-bg-secondary">
              {entry.task.status}
            </span>
            <button
              onClick={() => onDelete(entry.id)}
              className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-bg-secondary text-text-tertiary hover:text-accent-red transition-all"
              title="Remove relationship"
            >
              <X size={12} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TaskRelationships({ taskId, projectId }: TaskRelationshipsProps) {
  const { data: relationships, isLoading } = useRelationships(taskId);
  const { data: warnings } = useDependencyWarnings(taskId);
  const createMutation = useCreateRelationship(taskId);
  const deleteMutation = useDeleteRelationship(taskId);

  const [showModal, setShowModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<RelationType>('BLOCKS');

  // Search tasks for the add modal
  const { data: searchResults } = useQuery<SearchTask[]>({
    queryKey: ['task-search', projectId, searchQuery],
    queryFn: async () => {
      if (!projectId) return [];
      const { data } = await api.get(`/tasks/projects/${projectId}/tasks`, {
        params: { search: searchQuery, limit: 20 },
      });
      return (data.data ?? data).filter((t: SearchTask) => t.id !== taskId);
    },
    enabled: !!projectId && searchQuery.length >= 2,
  });

  const handleDelete = (relId: string) => {
    deleteMutation.mutate(relId);
  };

  const handleCreate = (targetTaskId: string) => {
    createMutation.mutate(
      { targetTaskId, type: selectedType },
      { onSuccess: () => { setShowModal(false); setSearchQuery(''); } },
    );
  };

  const totalCount =
    (relationships?.blocking?.length ?? 0) +
    (relationships?.waitingOn?.length ?? 0) +
    (relationships?.linkedTo?.length ?? 0);

  if (isLoading) {
    return <div className="h-8 bg-bg-tertiary rounded animate-pulse" />;
  }

  return (
    <div>
      {/* Dependency Warnings */}
      {warnings && warnings.length > 0 && (
        <div className="mb-3 space-y-1">
          {warnings.map((w, i) => (
            <div
              key={i}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-orange-500/10 border border-orange-500/20"
            >
              <AlertTriangle size={12} className="text-orange-400 flex-shrink-0" />
              <span className="text-xs text-orange-300">{w.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* Section header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Link2 size={14} className="text-text-tertiary" />
          <span className="text-xs font-medium text-text-secondary">Relationships</span>
          {totalCount > 0 && (
            <span className="text-[10px] text-text-tertiary">({totalCount})</span>
          )}
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1 text-[11px] text-text-tertiary hover:text-accent-blue transition-colors"
        >
          <Plus size={12} />
          Add
        </button>
      </div>

      {/* Relationship groups */}
      {relationships && (
        <>
          <RelationshipGroup
            label="Blocking"
            icon={TYPE_ICONS.BLOCKS}
            color={TYPE_COLORS.BLOCKS}
            entries={relationships.blocking}
            onDelete={handleDelete}
          />
          <RelationshipGroup
            label="Waiting On"
            icon={TYPE_ICONS.WAITING_ON}
            color={TYPE_COLORS.WAITING_ON}
            entries={relationships.waitingOn}
            onDelete={handleDelete}
          />
          <RelationshipGroup
            label="Linked To"
            icon={TYPE_ICONS.LINKED_TO}
            color={TYPE_COLORS.LINKED_TO}
            entries={relationships.linkedTo}
            onDelete={handleDelete}
          />
        </>
      )}

      {totalCount === 0 && (
        <p className="text-xs text-text-tertiary italic">No relationships</p>
      )}

      {/* Add Relationship Modal */}
      <Modal
        open={showModal}
        onClose={() => { setShowModal(false); setSearchQuery(''); }}
        title="Add Relationship"
        size="sm"
      >
        <div className="space-y-4">
          {/* Type selector */}
          <div>
            <label className="text-xs font-medium text-text-secondary mb-1.5 block">Type</label>
            <div className="flex gap-2">
              {(['BLOCKS', 'WAITING_ON', 'LINKED_TO'] as RelationType[]).map((type) => {
                const Icon = TYPE_ICONS[type];
                return (
                  <button
                    key={type}
                    onClick={() => setSelectedType(type)}
                    className={cn(
                      'flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors',
                      selectedType === type
                        ? 'border-accent-blue/50 bg-accent-blue/10 text-accent-blue'
                        : 'border-border-secondary text-text-tertiary hover:text-text-primary hover:bg-bg-hover',
                    )}
                  >
                    <Icon size={12} />
                    {TYPE_LABELS[type]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Task search */}
          <div>
            <label className="text-xs font-medium text-text-secondary mb-1.5 block">Search tasks</label>
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-tertiary" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by title or ID..."
                className="w-full pl-8 pr-3 py-2 text-sm bg-bg-tertiary border border-border-secondary rounded-lg text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent-blue/50"
              />
            </div>
          </div>

          {/* Search results */}
          {searchResults && searchResults.length > 0 && (
            <div className="max-h-48 overflow-y-auto space-y-1">
              {searchResults.map((task) => (
                <button
                  key={task.id}
                  onClick={() => handleCreate(task.id)}
                  disabled={createMutation.isPending}
                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-bg-hover transition-colors text-left"
                >
                  {task.customTaskId && (
                    <span className="text-[10px] font-mono text-text-tertiary">{task.customTaskId}</span>
                  )}
                  <span className="text-sm text-text-primary flex-1 truncate">{task.title}</span>
                  <span className="text-[10px] text-text-tertiary">{task.status}</span>
                </button>
              ))}
            </div>
          )}

          {searchQuery.length >= 2 && searchResults && searchResults.length === 0 && (
            <p className="text-xs text-text-tertiary text-center py-3">No tasks found</p>
          )}

          {searchQuery.length < 2 && searchQuery.length > 0 && (
            <p className="text-xs text-text-tertiary text-center py-3">Type at least 2 characters to search</p>
          )}
        </div>
      </Modal>
    </div>
  );
}
