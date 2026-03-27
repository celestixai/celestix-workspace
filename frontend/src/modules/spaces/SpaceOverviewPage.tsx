import { useSpace } from '@/hooks/useSpaces';
import { useFolders } from '@/hooks/useFolders';
import { useListsBySpace } from '@/hooks/useLists';
import { Circle, Folder, List, Users, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SpaceOverviewPageProps {
  spaceId: string;
  onSelectFolder: (folderId: string, spaceId: string) => void;
  onSelectList: (listId: string, spaceId: string, folderId?: string) => void;
  onOpenSettings?: (spaceId: string) => void;
}

export function SpaceOverviewPage({ spaceId, onSelectFolder, onSelectList, onOpenSettings }: SpaceOverviewPageProps) {
  const { data: space, isLoading: loadingSpace } = useSpace(spaceId);
  const { data: folders } = useFolders(spaceId);
  const { data: lists } = useListsBySpace(spaceId);

  const directLists = (lists ?? []).filter((l) => !l.folderId);

  if (loadingSpace) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-accent-blue/30 border-t-accent-blue rounded-full animate-spin" />
      </div>
    );
  }

  if (!space) {
    return (
      <div className="flex-1 flex items-center justify-center text-text-tertiary text-sm">
        Space not found
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-6">
      {/* Space Header */}
      <div className="flex items-center gap-3 mb-6">
        <Circle
          size={16}
          style={{ color: space.color || '#4F8EF7', fill: space.color || '#4F8EF7' }}
        />
        <h2 className="text-xl font-semibold text-text-primary">{space.name}</h2>
        {space.memberCount != null && space.memberCount > 0 && (
          <span className="flex items-center gap-1 text-xs text-text-tertiary">
            <Users size={12} />
            {space.memberCount} members
          </span>
        )}
        {onOpenSettings && (
          <button
            onClick={() => onOpenSettings(spaceId)}
            className="ml-auto p-1.5 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-colors"
            aria-label="Space settings"
          >
            <Settings size={16} />
          </button>
        )}
      </div>

      {space.description && (
        <p className="text-sm text-text-secondary mb-6">{space.description}</p>
      )}

      {/* Folders */}
      {folders && folders.length > 0 && (
        <div className="mb-6">
          <h3 className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-3">Folders</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {folders.map((folder) => (
              <button
                key={folder.id}
                onClick={() => onSelectFolder(folder.id, spaceId)}
                className="flex items-center gap-3 p-3 rounded-lg bg-bg-tertiary border border-border-primary hover:border-border-secondary hover:bg-bg-hover transition-colors text-left"
              >
                <Folder size={18} className="text-text-tertiary" />
                <span className="text-sm text-text-primary font-medium truncate">{folder.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Direct Lists */}
      {directLists.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-3">Lists</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {directLists.map((list) => (
              <button
                key={list.id}
                onClick={() => onSelectList(list.id, spaceId)}
                className="flex items-center gap-3 p-3 rounded-lg bg-bg-tertiary border border-border-primary hover:border-border-secondary hover:bg-bg-hover transition-colors text-left"
              >
                <List size={18} className="text-text-tertiary" />
                <span className="text-sm text-text-primary font-medium truncate flex-1">{list.name}</span>
                {list.taskCount != null && (
                  <span className="text-xs text-text-tertiary">{list.taskCount} tasks</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {(!folders || folders.length === 0) && directLists.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-text-tertiary">
          <Folder size={32} className="mb-3 opacity-40" />
          <p className="text-sm">This space is empty</p>
          <p className="text-xs mt-1 opacity-70">Add folders and lists to organize your work</p>
        </div>
      )}
    </div>
  );
}
