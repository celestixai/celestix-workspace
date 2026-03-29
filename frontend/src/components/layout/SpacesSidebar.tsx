import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  X,
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
  /** Mobile overlay control */
  mobileOpen?: boolean;
  onMobileClose?: () => void;
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
        'w-full flex items-center gap-2 h-7 rounded-lg text-[13px] transition-all duration-100 text-left group',
        isActive
          ? 'font-medium'
          : ''
      )}
      style={{
        paddingLeft: 36,
        paddingRight: 12,
        backgroundColor: isActive ? 'rgba(255,255,255,0.08)' : undefined,
        color: isActive ? '#fff' : 'rgba(255,255,255,0.65)',
      }}
      onMouseEnter={(e) => {
        if (!isActive) {
          e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)';
          e.currentTarget.style.color = 'rgba(255,255,255,0.65)';
        }
      }}
      onMouseLeave={(e) => {
        if (!isActive) {
          e.currentTarget.style.backgroundColor = '';
          e.currentTarget.style.color = 'rgba(255,255,255,0.65)';
        }
      }}
    >
      <List size={14} className="flex-shrink-0" style={{ color: 'rgba(255,255,255,0.20)' }} />
      <span className="truncate flex-1">{list.name}</span>
      {list.taskCount != null && list.taskCount > 0 && (
        <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.30)' }}>{list.taskCount}</span>
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
          'w-full flex items-center gap-1.5 h-7 rounded-lg text-[13px] transition-all duration-100 text-left group',
          isActiveFolder ? 'font-medium' : ''
        )}
        style={{
          paddingLeft: 24,
          paddingRight: 12,
          backgroundColor: isActiveFolder ? 'rgba(255,255,255,0.08)' : undefined,
          color: isActiveFolder ? '#fff' : 'rgba(255,255,255,0.65)',
        }}
        onMouseEnter={(e) => {
          if (!isActiveFolder) {
            e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)';
          }
        }}
        onMouseLeave={(e) => {
          if (!isActiveFolder) {
            e.currentTarget.style.backgroundColor = '';
          }
        }}
      >
        {expanded ? <ChevronDown size={12} className="flex-shrink-0 opacity-40" /> : <ChevronRight size={12} className="flex-shrink-0 opacity-40" />}
        <Folder size={14} className="flex-shrink-0" style={{ color: 'rgba(255,255,255,0.20)' }} />
        <span className="truncate flex-1">{folder.name}</span>
      </button>
      {expanded && lists && (
        <div className="mt-0.5 space-y-0.5">
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
    <div className="mb-0.5">
      <div className="flex items-center group">
        <button
          onClick={() => {
            onToggle();
            onSelectSpace(space.id);
          }}
          className={cn(
            'flex-1 flex items-center gap-1.5 h-7 rounded-lg text-sm transition-all duration-100 text-left',
            isActiveSpace ? 'font-medium' : ''
          )}
          style={{
            paddingLeft: 12,
            paddingRight: 8,
            backgroundColor: isActiveSpace ? 'rgba(255,255,255,0.08)' : undefined,
            color: isActiveSpace ? '#fff' : 'rgba(255,255,255,0.65)',
          }}
          onMouseEnter={(e) => {
            if (!isActiveSpace) {
              e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)';
            }
          }}
          onMouseLeave={(e) => {
            if (!isActiveSpace) {
              e.currentTarget.style.backgroundColor = '';
            }
          }}
        >
          {expanded ? <ChevronDown size={12} className="flex-shrink-0 opacity-40" /> : <ChevronRight size={12} className="flex-shrink-0 opacity-40" />}
          <span
            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: space.color || '#3B82F6' }}
          />
          <span className="truncate flex-1">{space.name}</span>
        </button>
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity pr-1">
          <button
            onClick={(e) => { e.stopPropagation(); onCreateFolder(space.id); }}
            className="p-0.5 rounded text-text-tertiary hover:text-text-primary hover:bg-[rgba(255,255,255,0.08)] transition-colors"
            aria-label="New folder"
            title="New Folder"
          >
            <FolderPlus size={13} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onCreateList(space.id); }}
            className="p-0.5 rounded text-text-tertiary hover:text-text-primary hover:bg-[rgba(255,255,255,0.08)] transition-colors"
            aria-label="New list"
            title="New List"
          >
            <ListPlus size={13} />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-0.5 space-y-0.5">
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
  mobileOpen,
  onMobileClose,
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

  // ----------------------------------------------------------------
  // Sidebar content (shared between desktop & mobile)
  // ----------------------------------------------------------------
  const sidebarContent = (
    <div
      className="w-[85vw] max-w-[280px] md:w-[280px] h-full flex flex-col flex-shrink-0"
      style={{
        backgroundColor: '#09090B',
        borderRight: '1px solid rgba(255,255,255,0.08)',
        padding: '12px 0',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between" style={{ padding: '8px 20px' }}>
        <span
          className="uppercase"
          style={{
            fontSize: 11,
            fontWeight: 500,
            letterSpacing: '0.08em',
            color: 'rgba(255,255,255,0.20)',
          }}
        >
          Spaces
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowCreateSpace(true)}
            className="p-1 rounded-md hover:bg-[rgba(255,255,255,0.08)] transition-colors"
            style={{ color: 'rgba(255,255,255,0.40)' }}
            aria-label="Create space"
            title="Create space"
          >
            <Plus size={16} />
          </button>
          {/* Desktop: collapse toggle; Mobile: close button */}
          <button
            onClick={() => {
              if (onMobileClose) onMobileClose();
              else onToggle();
            }}
            className="p-1 rounded-md hover:bg-[rgba(255,255,255,0.08)] transition-colors"
            style={{ color: 'rgba(255,255,255,0.40)' }}
            aria-label={onMobileClose ? 'Close sidebar' : 'Collapse sidebar'}
          >
            {onMobileClose ? <X size={16} /> : <PanelLeftClose size={16} />}
          </button>
        </div>
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-y-auto px-2 py-1 space-y-0.5">
        {isLoading ? (
          <div className="space-y-3 px-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-1.5">
                <div className="h-4 w-24 bg-[rgba(255,255,255,0.06)] rounded animate-pulse" />
                <div className="ml-4 space-y-1">
                  <div className="h-3 w-20 bg-[rgba(255,255,255,0.06)] rounded animate-pulse" />
                  <div className="h-3 w-16 bg-[rgba(255,255,255,0.06)] rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : !spaces || spaces.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8" style={{ color: 'rgba(255,255,255,0.30)' }}>
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

  // ----------------------------------------------------------------
  // Desktop: collapsed state
  // ----------------------------------------------------------------
  if (collapsed) {
    return (
      <>
        <div
          className="hidden md:flex w-10 h-full flex-col items-center pt-3 flex-shrink-0"
          style={{
            backgroundColor: '#09090B',
            borderRight: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <button
            onClick={onToggle}
            className="p-1.5 rounded-md text-text-tertiary hover:text-text-primary hover:bg-[rgba(255,255,255,0.04)] transition-colors"
            aria-label="Expand spaces sidebar"
          >
            <PanelLeft size={16} />
          </button>
        </div>

        {/* Mobile overlay when collapsed on desktop but mobileOpen */}
        <AnimatePresence>
          {mobileOpen && (
            <>
              <motion.div
                className="fixed inset-0 bg-black/60 z-[200] md:hidden"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                onClick={onMobileClose}
              />
              <motion.div
                className="fixed top-0 left-0 bottom-0 z-[200] md:hidden"
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
              >
                {sidebarContent}
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </>
    );
  }

  // ----------------------------------------------------------------
  // Desktop: expanded (normal) + Mobile overlay
  // ----------------------------------------------------------------
  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden md:block h-full">
        {sidebarContent}
      </div>

      {/* Mobile overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              className="fixed inset-0 bg-black/60 z-[200] md:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={onMobileClose}
            />
            <motion.div
              className="fixed top-0 left-0 bottom-0 z-[200] md:hidden"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
            >
              {sidebarContent}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
