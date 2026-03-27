import { useState, useEffect, useCallback } from 'react';
import {
  ChevronRight,
  ChevronDown,
  Plus,
  Folder,
  List,
  PanelLeftClose,
  PanelLeft,
  Circle,
  Users,
  Hash,
  FolderPlus,
  ListPlus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSpaces, Space } from '@/hooks/useSpaces';
import { useFolders, Folder as FolderType } from '@/hooks/useFolders';
import { useListsBySpace, useListsByFolder, TaskList } from '@/hooks/useLists';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { CreateSpaceModal } from '@/modules/spaces/CreateSpaceModal';
import { CreateFolderModal } from '@/modules/spaces/CreateFolderModal';
import { CreateListModal } from '@/modules/spaces/CreateListModal';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface SpacesSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  activeItemId: string | null;
  activeItemType: 'space' | 'folder' | 'list' | null;
  onSelectSpace: (spaceId: string) => void;
  onSelectFolder: (folderId: string, spaceId: string) => void;
  onSelectList: (listId: string, spaceId: string, folderId?: string) => void;
}

/* ------------------------------------------------------------------ */
/*  Expand/collapse persistence                                        */
/* ------------------------------------------------------------------ */

const STORAGE_KEY = 'celestix-spaces-expanded';

function loadExpanded(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveExpanded(expanded: Record<string, boolean>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(expanded));
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function ListItem({
  list,
  spaceId,
  folderId,
  isActive,
  onSelect,
}: {
  list: TaskList;
  spaceId: string;
  folderId?: string;
  isActive: boolean;
  onSelect: (listId: string, spaceId: string, folderId?: string) => void;
}) {
  return (
    <button
      onClick={() => onSelect(list.id, spaceId, folderId)}
      className={cn(
        'w-full flex items-center gap-2 px-2 py-1 rounded-md text-xs transition-colors text-left group',
        isActive
          ? 'bg-bg-active text-accent-blue'
          : 'text-text-tertiary hover:text-text-secondary hover:bg-bg-hover'
      )}
    >
      <List size={14} className="flex-shrink-0 opacity-60" />
      <span className="truncate flex-1">{list.name}</span>
      {list.taskCount != null && list.taskCount > 0 && (
        <span className="text-[10px] text-text-tertiary opacity-70">{list.taskCount}</span>
      )}
    </button>
  );
}

function FolderNode({
  folder,
  spaceId,
  expanded,
  onToggle,
  isActiveFolder,
  activeItemId,
  activeItemType,
  onSelectFolder,
  onSelectList,
}: {
  folder: FolderType;
  spaceId: string;
  expanded: boolean;
  onToggle: () => void;
  isActiveFolder: boolean;
  activeItemId: string | null;
  activeItemType: 'space' | 'folder' | 'list' | null;
  onSelectFolder: (folderId: string, spaceId: string) => void;
  onSelectList: (listId: string, spaceId: string, folderId?: string) => void;
}) {
  const { data: lists } = useListsByFolder(expanded ? folder.id : undefined);

  return (
    <div>
      <button
        onClick={() => {
          onToggle();
          onSelectFolder(folder.id, spaceId);
        }}
        className={cn(
          'w-full flex items-center gap-1.5 px-2 py-1 rounded-md text-xs transition-colors text-left group',
          isActiveFolder
            ? 'bg-bg-active text-accent-blue'
            : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
        )}
      >
        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <Folder size={14} className="flex-shrink-0 opacity-70" />
        <span className="truncate flex-1">{folder.name}</span>
      </button>
      {expanded && lists && (
        <div className="ml-5 mt-0.5 space-y-0.5">
          {lists.map((list) => (
            <ListItem
              key={list.id}
              list={list}
              spaceId={spaceId}
              folderId={folder.id}
              isActive={activeItemType === 'list' && activeItemId === list.id}
              onSelect={onSelectList}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SpaceNode({
  space,
  expanded,
  onToggle,
  expandedNodes,
  onToggleNode,
  activeItemId,
  activeItemType,
  onSelectSpace,
  onSelectFolder,
  onSelectList,
  onCreateFolder,
  onCreateList,
}: {
  space: Space;
  expanded: boolean;
  onToggle: () => void;
  expandedNodes: Record<string, boolean>;
  onToggleNode: (id: string) => void;
  activeItemId: string | null;
  activeItemType: 'space' | 'folder' | 'list' | null;
  onSelectSpace: (spaceId: string) => void;
  onSelectFolder: (folderId: string, spaceId: string) => void;
  onSelectList: (listId: string, spaceId: string, folderId?: string) => void;
  onCreateFolder: (spaceId: string) => void;
  onCreateList: (spaceId: string, folderId?: string) => void;
}) {
  const { data: folders } = useFolders(expanded ? space.id : undefined);
  const { data: spaceLists } = useListsBySpace(expanded ? space.id : undefined);

  // Direct lists = lists in this space that don't belong to a folder
  const directLists = (spaceLists ?? []).filter((l) => !l.folderId);
  const isActiveSpace = activeItemType === 'space' && activeItemId === space.id;

  return (
    <div className="mb-1">
      <div className="flex items-center group">
        <button
          onClick={() => {
            onToggle();
            onSelectSpace(space.id);
          }}
          className={cn(
            'flex-1 flex items-center gap-1.5 px-2 py-1.5 rounded-md text-sm font-medium transition-colors text-left',
            isActiveSpace
              ? 'bg-bg-active text-accent-blue'
              : 'text-text-primary hover:bg-bg-hover'
          )}
        >
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <Circle
            size={10}
            className="flex-shrink-0"
            style={{ color: space.color || '#4F8EF7', fill: space.color || '#4F8EF7' }}
          />
          <span className="truncate flex-1">{space.name}</span>
          {space.memberCount != null && space.memberCount > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] text-text-tertiary opacity-0 group-hover:opacity-100 transition-opacity">
              <Users size={10} />
              {space.memberCount}
            </span>
          )}
        </button>
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity pr-1">
          <button
            onClick={(e) => { e.stopPropagation(); onCreateFolder(space.id); }}
            className="p-0.5 rounded text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-colors"
            aria-label="New folder"
            title="New Folder"
          >
            <FolderPlus size={13} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onCreateList(space.id); }}
            className="p-0.5 rounded text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-colors"
            aria-label="New list"
            title="New List"
          >
            <ListPlus size={13} />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="ml-3 mt-0.5 space-y-0.5">
          {(folders ?? []).map((folder) => (
            <FolderNode
              key={folder.id}
              folder={folder}
              spaceId={space.id}
              expanded={!!expandedNodes[`folder-${folder.id}`]}
              onToggle={() => onToggleNode(`folder-${folder.id}`)}
              isActiveFolder={activeItemType === 'folder' && activeItemId === folder.id}
              activeItemId={activeItemId}
              activeItemType={activeItemType}
              onSelectFolder={onSelectFolder}
              onSelectList={onSelectList}
            />
          ))}
          {directLists.map((list) => (
            <ListItem
              key={list.id}
              list={list}
              spaceId={space.id}
              isActive={activeItemType === 'list' && activeItemId === list.id}
              onSelect={onSelectList}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export function SpacesSidebar({
  collapsed,
  onToggle,
  activeItemId,
  activeItemType,
  onSelectSpace,
  onSelectFolder,
  onSelectList,
}: SpacesSidebarProps) {
  const { data: workspaces } = useQuery({
    queryKey: ['workspaces'],
    queryFn: async () => {
      const { data } = await api.get('/workspace');
      return data.data;
    },
  });
  const workspaceId = workspaces?.[0]?.id;

  const { data: spaces, isLoading } = useSpaces(workspaceId);
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>(loadExpanded);

  // Modal state
  const [showCreateSpace, setShowCreateSpace] = useState(false);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [showCreateList, setShowCreateList] = useState(false);
  const [targetSpaceId, setTargetSpaceId] = useState<string>('');
  const [targetFolderId, setTargetFolderId] = useState<string | undefined>(undefined);

  useEffect(() => {
    saveExpanded(expandedNodes);
  }, [expandedNodes]);

  const toggleNode = useCallback((id: string) => {
    setExpandedNodes((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const handleCreateFolder = useCallback((spaceId: string) => {
    setTargetSpaceId(spaceId);
    setShowCreateFolder(true);
  }, []);

  const handleCreateList = useCallback((spaceId: string, folderId?: string) => {
    setTargetSpaceId(spaceId);
    setTargetFolderId(folderId);
    setShowCreateList(true);
  }, []);

  if (collapsed) {
    return (
      <div className="w-10 h-full bg-bg-secondary border-r border-border-primary flex flex-col items-center pt-3 flex-shrink-0">
        <button
          onClick={onToggle}
          className="p-1.5 rounded-md text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-colors"
          aria-label="Expand spaces sidebar"
        >
          <PanelLeft size={16} />
        </button>
      </div>
    );
  }

  return (
    <div className="w-[260px] h-full bg-bg-secondary border-r border-border-primary flex flex-col flex-shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border-primary">
        <div className="flex items-center gap-2">
          <Hash size={16} className="text-text-tertiary" />
          <span className="text-sm font-semibold text-text-primary">Spaces</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowCreateSpace(true)}
            className="p-1 rounded-md text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-colors"
            aria-label="Create space"
            title="Create space"
          >
            <Plus size={16} />
          </button>
          <button
            onClick={onToggle}
            className="p-1 rounded-md text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-colors"
            aria-label="Collapse sidebar"
          >
            <PanelLeftClose size={16} />
          </button>
        </div>
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
        {isLoading ? (
          <div className="space-y-3 px-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-1.5">
                <div className="h-4 w-24 bg-bg-tertiary rounded animate-pulse" />
                <div className="ml-4 space-y-1">
                  <div className="h-3 w-20 bg-bg-tertiary rounded animate-pulse" />
                  <div className="h-3 w-16 bg-bg-tertiary rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : !spaces || spaces.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-text-tertiary">
            <Hash size={24} className="mb-2 opacity-40" />
            <p className="text-xs">No spaces yet</p>
            <p className="text-[10px] mt-1 opacity-70">Create your first space to get started</p>
          </div>
        ) : (
          spaces.map((space) => (
            <SpaceNode
              key={space.id}
              space={space}
              expanded={!!expandedNodes[`space-${space.id}`]}
              onToggle={() => toggleNode(`space-${space.id}`)}
              expandedNodes={expandedNodes}
              onToggleNode={toggleNode}
              activeItemId={activeItemId}
              activeItemType={activeItemType}
              onSelectSpace={onSelectSpace}
              onSelectFolder={onSelectFolder}
              onSelectList={onSelectList}
              onCreateFolder={handleCreateFolder}
              onCreateList={handleCreateList}
            />
          ))
        )}
      </div>

      {/* Creation Modals */}
      {workspaceId && (
        <CreateSpaceModal
          open={showCreateSpace}
          onClose={() => setShowCreateSpace(false)}
          workspaceId={workspaceId}
        />
      )}
      {targetSpaceId && (
        <CreateFolderModal
          open={showCreateFolder}
          onClose={() => setShowCreateFolder(false)}
          spaceId={targetSpaceId}
        />
      )}
      {targetSpaceId && (
        <CreateListModal
          open={showCreateList}
          onClose={() => setShowCreateList(false)}
          spaceId={targetSpaceId}
          folderId={targetFolderId}
        />
      )}
    </div>
  );
}
