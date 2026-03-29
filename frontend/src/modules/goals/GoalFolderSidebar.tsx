import { useState } from 'react';
import { Plus, Folder, MoreHorizontal, Pencil, Trash2, ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { GoalFolder } from '@/hooks/useGoals';
import { useCreateGoalFolder } from '@/hooks/useGoals';

interface GoalFolderSidebarProps {
  workspaceId?: string;
  folders: GoalFolder[];
  activeFolderId: string | null;
  onSelectFolder: (folderId: string | null) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export function GoalFolderSidebar({
  workspaceId,
  folders,
  activeFolderId,
  onSelectFolder,
  collapsed,
  onToggleCollapse,
}: GoalFolderSidebarProps) {
  const [showCreateInput, setShowCreateInput] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const createFolder = useCreateGoalFolder(workspaceId);

  const handleCreate = () => {
    if (!newFolderName.trim()) return;
    createFolder.mutate(
      { name: newFolderName.trim() },
      {
        onSuccess: () => {
          setNewFolderName('');
          setShowCreateInput(false);
        },
      }
    );
  };

  if (collapsed) {
    return (
      <div className="w-10 border-r border-[rgba(255,255,255,0.08)] bg-[#09090B] flex flex-col items-center py-3">
        <button
          onClick={onToggleCollapse}
          className="p-1.5 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-colors"
          aria-label="Expand sidebar"
        >
          <Folder size={16} />
        </button>
      </div>
    );
  }

  return (
    <div className="w-[220px] border-r border-[rgba(255,255,255,0.08)] bg-[#09090B] flex flex-col flex-shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-[rgba(255,255,255,0.08)]">
        <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Folders</span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowCreateInput(true)}
            className="p-1 rounded-md text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-colors"
            aria-label="Create folder"
          >
            <Plus size={14} />
          </button>
          <button
            onClick={onToggleCollapse}
            className="p-1 rounded-md text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-colors"
            aria-label="Collapse sidebar"
          >
            <ChevronLeft size={14} />
          </button>
        </div>
      </div>

      {/* Folder list */}
      <div className="flex-1 overflow-y-auto py-1">
        {/* All Goals */}
        <button
          onClick={() => onSelectFolder(null)}
          className={cn(
            'w-full flex items-center gap-2 px-3 py-1.5 text-xs font-medium transition-colors',
            activeFolderId === null
              ? 'text-accent-blue bg-bg-active'
              : 'text-text-secondary hover:bg-bg-hover'
          )}
        >
          <Folder size={14} />
          All Goals
        </button>

        {folders.map((folder) => (
          <div
            key={folder.id}
            className="relative"
            onMouseEnter={() => setHoveredId(folder.id)}
            onMouseLeave={() => { setHoveredId(null); setMenuOpenId(null); }}
          >
            <button
              onClick={() => onSelectFolder(folder.id)}
              className={cn(
                'w-full flex items-center gap-2 px-3 py-1.5 text-xs font-medium transition-colors',
                activeFolderId === folder.id
                  ? 'text-accent-blue bg-bg-active'
                  : 'text-text-secondary hover:bg-bg-hover'
              )}
            >
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: folder.color || 'var(--accent-blue)' }}
              />
              <span className="truncate">{folder.name}</span>
            </button>

            {/* Hover actions */}
            {(hoveredId === folder.id || menuOpenId === folder.id) && (
              <button
                onClick={(e) => { e.stopPropagation(); setMenuOpenId(menuOpenId === folder.id ? null : folder.id); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded text-text-tertiary hover:text-text-primary hover:bg-bg-hover"
              >
                <MoreHorizontal size={12} />
              </button>
            )}

            {/* Context menu */}
            {menuOpenId === folder.id && (
              <div className="absolute right-0 top-full z-50 w-32 py-1 bg-bg-tertiary border border-border-primary rounded-lg shadow-lg">
                <button className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-text-secondary hover:bg-bg-hover">
                  <Pencil size={12} />
                  Rename
                </button>
                <button className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-accent-red hover:bg-bg-hover">
                  <Trash2 size={12} />
                  Delete
                </button>
              </div>
            )}
          </div>
        ))}

        {/* Create input */}
        {showCreateInput && (
          <div className="px-3 py-1.5">
            <input
              autoFocus
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreate();
                if (e.key === 'Escape') { setShowCreateInput(false); setNewFolderName(''); }
              }}
              onBlur={() => { if (!newFolderName.trim()) { setShowCreateInput(false); } }}
              placeholder="Folder name..."
              className="w-full h-7 px-2 rounded-md bg-bg-tertiary border border-border-primary text-text-primary text-xs placeholder:text-text-tertiary focus:outline-none focus:border-accent-blue"
            />
          </div>
        )}
      </div>
    </div>
  );
}
