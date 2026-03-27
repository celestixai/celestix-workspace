import { useState, useMemo } from 'react';
import { useTags, useCreateTag, useAddTagsToTask, useRemoveTagFromTask, useTaskTags } from '@/hooks/useTags';
import { X, Plus, Search, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TagSelectorProps {
  taskId: string;
  workspaceId: string;
}

const PRESET_COLORS = [
  '#4F8EF7', '#6366F1', '#8B5CF6', '#A855F7',
  '#EC4899', '#EF4444', '#F97316', '#EAB308',
  '#22C55E', '#14B8A6', '#06B6D4', '#64748B',
];

export function TagSelector({ taskId, workspaceId }: TagSelectorProps) {
  const { data: workspaceTags = [] } = useTags(workspaceId);
  const { data: taskTags = [] } = useTaskTags(taskId);
  const createTag = useCreateTag(workspaceId);
  const addTags = useAddTagsToTask(taskId);
  const removeTag = useRemoveTagFromTask(taskId);

  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#4F8EF7');
  const [showCreate, setShowCreate] = useState(false);

  const taskTagIds = useMemo(() => new Set(taskTags.map((t) => t.id)), [taskTags]);

  const filtered = useMemo(
    () => workspaceTags.filter((t) => t.name.toLowerCase().includes(search.toLowerCase())),
    [workspaceTags, search],
  );

  const handleToggleTag = async (tagId: string) => {
    if (taskTagIds.has(tagId)) {
      removeTag.mutate(tagId);
    } else {
      addTags.mutate([tagId]);
    }
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;
    try {
      const tag = await createTag.mutateAsync({ name: newTagName.trim(), color: newTagColor });
      // Also add it to the task
      addTags.mutate([tag.id]);
      setNewTagName('');
      setShowCreate(false);
    } catch {
      // duplicate name error handled by API
    }
  };

  return (
    <div className="relative">
      {/* Display current tags as chips */}
      <div className="flex flex-wrap gap-1 items-center">
        {taskTags.map((tag) => (
          <span
            key={tag.id}
            className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-medium"
            style={{ backgroundColor: tag.color + '20', color: tag.color, border: `1px solid ${tag.color}40` }}
          >
            {tag.name}
            <button
              onClick={() => removeTag.mutate(tag.id)}
              className="hover:opacity-70 transition-opacity"
            >
              <X size={10} />
            </button>
          </span>
        ))}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="inline-flex items-center gap-1 text-[11px] text-text-tertiary hover:text-text-primary px-1.5 py-0.5 rounded hover:bg-bg-hover transition-colors"
        >
          <Plus size={12} />
          Tag
        </button>
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 top-full mt-1 left-0 w-64 bg-bg-secondary border border-border-primary rounded-lg shadow-xl overflow-hidden">
          {/* Search */}
          <div className="p-2 border-b border-border-secondary">
            <div className="flex items-center gap-2 px-2 py-1.5 bg-bg-tertiary rounded-md">
              <Search size={14} className="text-text-tertiary flex-shrink-0" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search tags..."
                className="bg-transparent text-sm text-text-primary w-full outline-none placeholder:text-text-tertiary"
                autoFocus
              />
            </div>
          </div>

          {/* Tag list */}
          <div className="max-h-48 overflow-y-auto p-1">
            {filtered.length === 0 && !showCreate && (
              <div className="text-xs text-text-tertiary text-center py-3">No tags found</div>
            )}
            {filtered.map((tag) => {
              const isSelected = taskTagIds.has(tag.id);
              return (
                <button
                  key={tag.id}
                  onClick={() => handleToggleTag(tag.id)}
                  className={cn(
                    'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-text-primary hover:bg-bg-hover transition-colors',
                    isSelected && 'bg-bg-hover',
                  )}
                >
                  <span
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: tag.color }}
                  />
                  <span className="flex-1 text-left truncate">{tag.name}</span>
                  {isSelected && <Check size={14} className="text-accent-blue flex-shrink-0" />}
                </button>
              );
            })}
          </div>

          {/* Create new tag */}
          <div className="border-t border-border-secondary p-2">
            {showCreate ? (
              <div className="space-y-2">
                <input
                  type="text"
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  placeholder="Tag name"
                  className="w-full px-2 py-1.5 bg-bg-tertiary rounded-md text-sm text-text-primary outline-none border border-border-secondary focus:border-accent-blue"
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateTag()}
                  autoFocus
                />
                <div className="flex flex-wrap gap-1">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setNewTagColor(c)}
                      className={cn(
                        'w-5 h-5 rounded-full border-2 transition-transform',
                        newTagColor === c ? 'border-white scale-110' : 'border-transparent',
                      )}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleCreateTag}
                    disabled={!newTagName.trim() || createTag.isPending}
                    className="flex-1 text-xs px-3 py-1.5 bg-accent-blue text-white rounded-md hover:bg-accent-blue/90 disabled:opacity-50 transition-colors"
                  >
                    Create
                  </button>
                  <button
                    onClick={() => { setShowCreate(false); setNewTagName(''); }}
                    className="text-xs px-3 py-1.5 text-text-tertiary hover:text-text-primary transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowCreate(true)}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-colors"
              >
                <Plus size={14} />
                Create new tag
              </button>
            )}
          </div>

          {/* Close on outside click */}
          <div className="fixed inset-0 -z-10" onClick={() => setIsOpen(false)} />
        </div>
      )}
    </div>
  );
}
