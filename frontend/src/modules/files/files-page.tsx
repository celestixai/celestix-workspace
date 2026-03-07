import { useState, useRef, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { cn, formatFileSize, formatRelativeTime } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/empty-state';
import { toast } from '@/components/ui/toast';
import {
  FolderOpen,
  File,
  FileText,
  FileImage,
  FileVideo,
  FileAudio,
  FileSpreadsheet,
  FileCode,
  Archive,
  Upload,
  Search,
  Grid,
  List,
  Star,
  Clock,
  Trash2,
  ChevronRight,
  FolderPlus,
  Download,
  Share2,
  Pencil,
  Move,
  Copy,
  X,
  Home,
  CloudUpload,
  HardDrive,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface FileItem {
  id: string;
  name: string;
  type: 'FILE' | 'FOLDER';
  mimeType?: string;
  size?: number;
  parentId: string | null;
  path: string;
  thumbnailUrl?: string;
  isStarred: boolean;
  sharedWith?: { id: string; name: string }[];
  createdAt: string;
  updatedAt: string;
  createdBy: { id: string; displayName: string; avatarUrl?: string };
}

type SidebarSection = 'my-files' | 'starred' | 'recent' | 'trash';

/* ------------------------------------------------------------------ */
/*  File Icon Helpers                                                  */
/* ------------------------------------------------------------------ */

function getFileIcon(mimeType?: string, isFolder?: boolean) {
  if (isFolder) return <FolderOpen size={20} className="text-accent-amber" />;
  if (!mimeType) return <File size={20} className="text-text-tertiary" />;
  if (mimeType.startsWith('image/')) return <FileImage size={20} className="text-accent-emerald" />;
  if (mimeType.startsWith('video/')) return <FileVideo size={20} className="text-accent-violet" />;
  if (mimeType.startsWith('audio/')) return <FileAudio size={20} className="text-accent-cyan" />;
  if (mimeType.includes('spreadsheet') || mimeType.includes('csv'))
    return <FileSpreadsheet size={20} className="text-accent-emerald" />;
  if (mimeType.includes('pdf') || mimeType.includes('document') || mimeType.includes('text'))
    return <FileText size={20} className="text-accent-blue" />;
  if (mimeType.includes('zip') || mimeType.includes('archive') || mimeType.includes('tar'))
    return <Archive size={20} className="text-accent-amber" />;
  if (
    mimeType.includes('javascript') ||
    mimeType.includes('json') ||
    mimeType.includes('html') ||
    mimeType.includes('css')
  )
    return <FileCode size={20} className="text-accent-violet" />;
  return <File size={20} className="text-text-tertiary" />;
}

function getFileIconLarge(mimeType?: string, isFolder?: boolean) {
  if (isFolder) return <FolderOpen size={40} className="text-accent-amber" />;
  if (!mimeType) return <File size={40} className="text-text-tertiary" />;
  if (mimeType.startsWith('image/')) return <FileImage size={40} className="text-accent-emerald" />;
  if (mimeType.startsWith('video/')) return <FileVideo size={40} className="text-accent-violet" />;
  if (mimeType.startsWith('audio/')) return <FileAudio size={40} className="text-accent-cyan" />;
  if (mimeType.includes('pdf') || mimeType.includes('document'))
    return <FileText size={40} className="text-accent-blue" />;
  return <File size={40} className="text-text-tertiary" />;
}

/* ------------------------------------------------------------------ */
/*  Files Page                                                         */
/* ------------------------------------------------------------------ */

export function FilesPage() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  const [activeSection, setActiveSection] = useState<SidebarSection>('my-files');
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<{ id: string | null; name: string }[]>([
    { id: null, name: 'My Files' },
  ]);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [showRename, setShowRename] = useState<FileItem | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    file: FileItem;
  } | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* -- Queries -- */

  const { data: files = [], isLoading: filesLoading } = useQuery({
    queryKey: ['files', activeSection, currentFolderId],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (activeSection === 'my-files') {
        if (currentFolderId) params.parentFolderId = currentFolderId;
      } else if (activeSection === 'starred') {
        params.starred = 'true';
      } else if (activeSection === 'recent') {
        params.recent = 'true';
      } else if (activeSection === 'trash') {
        params.trashed = 'true';
      }
      const { data } = await api.get('/files', { params });
      return data.data as FileItem[];
    },
  });

  const filteredFiles = useMemo(() => {
    if (!searchQuery.trim()) return files;
    const q = searchQuery.toLowerCase();
    return files.filter((f) => f.name.toLowerCase().includes(q));
  }, [files, searchQuery]);

  const sortedFiles = useMemo(() => {
    return [...filteredFiles].sort((a, b) => {
      if (a.type === 'FOLDER' && b.type !== 'FOLDER') return -1;
      if (a.type !== 'FOLDER' && b.type === 'FOLDER') return 1;
      return a.name.localeCompare(b.name);
    });
  }, [filteredFiles]);

  /* -- Mutations -- */

  const uploadFiles = useMutation({
    mutationFn: async (fileList: FileList) => {
      for (const f of Array.from(fileList)) {
        const formData = new FormData();
        formData.append('file', f);
        if (currentFolderId) formData.append('parentFolderId', currentFolderId);
        await api.post('/files/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['files'] });
      toast('Files uploaded', 'success');
    },
    onError: () => toast('Upload failed', 'error'),
  });

  const createFolder = useMutation({
    mutationFn: async (name: string) => {
      await api.post('/files/folders', { name, parentFolderId: currentFolderId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['files'] });
      setShowNewFolder(false);
      toast('Folder created', 'success');
    },
    onError: () => toast('Failed to create folder', 'error'),
  });

  const renameFile = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      await api.patch(`/files/${id}/rename`, { name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['files'] });
      setShowRename(null);
      toast('Renamed', 'success');
    },
    onError: () => toast('Failed to rename', 'error'),
  });

  const toggleStar = useMutation({
    mutationFn: async ({ id }: { id: string; starred: boolean }) => {
      await api.post(`/files/${id}/star`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['files'] }),
  });

  const deleteFile = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/files/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['files'] });
      toast('Moved to trash', 'success');
    },
    onError: () => toast('Failed to delete', 'error'),
  });

  /* -- Navigation -- */

  const navigateToFolder = useCallback((file: FileItem) => {
    if (file.type !== 'FOLDER') return;
    setCurrentFolderId(file.id);
    setBreadcrumbs((prev) => [...prev, { id: file.id, name: file.name }]);
  }, []);

  const navigateToBreadcrumb = (index: number) => {
    const crumb = breadcrumbs[index];
    setCurrentFolderId(crumb.id);
    setBreadcrumbs((prev) => prev.slice(0, index + 1));
  };

  const handleSectionChange = (section: SidebarSection) => {
    setActiveSection(section);
    if (section === 'my-files') {
      setCurrentFolderId(null);
      setBreadcrumbs([{ id: null, name: 'My Files' }]);
    }
    setSearchQuery('');
  };

  /* -- Drag & Drop upload zone -- */

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => setIsDragOver(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      uploadFiles.mutate(e.dataTransfer.files);
    }
  };

  /* -- Context menu -- */

  const handleContextMenu = (e: React.MouseEvent, file: FileItem) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, file });
  };

  /* -- Sidebar items -- */

  const sidebarItems: { id: SidebarSection; label: string; icon: React.ReactNode }[] = [
    { id: 'my-files', label: 'My Files', icon: <HardDrive size={16} /> },
    { id: 'starred', label: 'Starred', icon: <Star size={16} /> },
    { id: 'recent', label: 'Recent', icon: <Clock size={16} /> },
    { id: 'trash', label: 'Trash', icon: <Trash2 size={16} /> },
  ];

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <div className="flex h-full overflow-hidden" onClick={() => setContextMenu(null)}>
      {/* ===== Sidebar (200px) ===== */}
      <aside className="w-[200px] flex-shrink-0 bg-bg-secondary border-r border-border-primary flex flex-col">
        {/* Upload + New Folder */}
        <div className="p-3 flex-shrink-0 space-y-2">
          <Button className="w-full" onClick={() => fileInputRef.current?.click()}>
            <Upload size={16} />
            Upload
          </Button>
          <Button
            variant="secondary"
            className="w-full"
            onClick={() => setShowNewFolder(true)}
          >
            <FolderPlus size={16} />
            New Folder
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => e.target.files && uploadFiles.mutate(e.target.files)}
          />
        </div>

        {/* Nav items: My Files, Starred, Recent, Trash */}
        <nav className="flex-1 px-2 space-y-0.5 overflow-y-auto">
          {sidebarItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleSectionChange(item.id)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                activeSection === item.id
                  ? 'bg-bg-active text-text-primary font-medium'
                  : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
              )}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>

        {/* Storage indicator */}
        <div className="p-3 border-t border-border-primary flex-shrink-0">
          <div className="flex items-center justify-between text-xs text-text-tertiary mb-1.5">
            <span>Storage</span>
          </div>
          <div className="h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
            <div className="h-full bg-accent-blue rounded-full w-1/3 transition-all" />
          </div>
        </div>
      </aside>

      {/* ===== Main Area ===== */}
      <main
        className={cn(
          'flex-1 flex flex-col min-w-0 relative',
          isDragOver &&
            'after:absolute after:inset-0 after:bg-accent-blue/5 after:border-2 after:border-dashed after:border-accent-blue after:rounded-xl after:z-10 after:pointer-events-none'
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Toolbar: breadcrumbs, search, view toggle */}
        <div className="h-12 flex items-center gap-3 px-4 border-b border-border-primary flex-shrink-0">
          {/* Breadcrumbs */}
          {activeSection === 'my-files' ? (
            <div className="flex items-center gap-1 text-sm min-w-0 overflow-hidden">
              {breadcrumbs.map((crumb, i) => (
                <div key={i} className="flex items-center gap-1 min-w-0">
                  {i > 0 && (
                    <ChevronRight
                      size={14}
                      className="text-text-tertiary flex-shrink-0"
                    />
                  )}
                  <button
                    onClick={() => navigateToBreadcrumb(i)}
                    className={cn(
                      'truncate transition-colors focus-visible:outline-2 focus-visible:outline-accent-blue',
                      i === breadcrumbs.length - 1
                        ? 'text-text-primary font-medium'
                        : 'text-text-tertiary hover:text-text-primary'
                    )}
                  >
                    {i === 0 ? <Home size={14} /> : crumb.name}
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <span className="text-sm font-medium text-text-primary capitalize truncate min-w-0">
              {activeSection.replace('-', ' ')}
            </span>
          )}

          <div className="flex-1" />

          {/* Search */}
          <div className="relative max-w-xs flex-shrink-0">
            <Search
              size={14}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-tertiary"
            />
            <input
              type="text"
              placeholder="Search files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-8 pl-8 pr-3 rounded-lg bg-bg-tertiary border border-border-primary text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent-blue"
            />
          </div>

          {/* Grid / List toggle */}
          <div className="flex items-center bg-bg-tertiary rounded-lg border border-border-primary p-0.5 flex-shrink-0">
            <button
              onClick={() => setViewMode('grid')}
              className={cn(
                'p-1.5 rounded-lg transition-colors focus-visible:outline-2 focus-visible:outline-accent-blue',
                viewMode === 'grid'
                  ? 'bg-bg-active text-text-primary shadow-sm'
                  : 'text-text-tertiary hover:text-text-secondary'
              )}
              title="Grid view"
              aria-label="Grid view"
            >
              <Grid size={14} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                'p-1.5 rounded-lg transition-colors focus-visible:outline-2 focus-visible:outline-accent-blue',
                viewMode === 'list'
                  ? 'bg-bg-active text-text-primary shadow-sm'
                  : 'text-text-tertiary hover:text-text-secondary'
              )}
              title="List view"
              aria-label="List view"
            >
              <List size={14} />
            </button>
          </div>
        </div>

        {/* Drag overlay message */}
        {isDragOver && (
          <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
            <div className="bg-bg-secondary border border-accent-blue rounded-xl p-8 shadow-lg text-center">
              <CloudUpload size={48} className="text-accent-blue mx-auto mb-2" />
              <p className="text-sm font-medium text-text-primary">Drop files to upload</p>
            </div>
          </div>
        )}

        {/* File content */}
        <div className="flex-1 overflow-y-auto p-4">
          {filesLoading ? (
            <FilesSkeleton viewMode={viewMode} />
          ) : sortedFiles.length === 0 ? (
            <EmptyState
              icon={<FolderOpen size={48} />}
              title={searchQuery ? 'No results' : 'No files'}
              description={
                searchQuery
                  ? 'Try a different search term'
                  : activeSection === 'trash'
                    ? 'Trash is empty'
                    : 'Upload files or create a folder to get started'
              }
              action={
                !searchQuery && activeSection === 'my-files' ? (
                  <div className="flex gap-2">
                    <Button onClick={() => fileInputRef.current?.click()}>
                      <Upload size={14} />
                      Upload
                    </Button>
                    <Button variant="secondary" onClick={() => setShowNewFolder(true)}>
                      <FolderPlus size={14} />
                      New Folder
                    </Button>
                  </div>
                ) : undefined
              }
            />
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {sortedFiles.map((file) => (
                <FileGridCard
                  key={file.id}
                  file={file}
                  onOpen={() => file.type === 'FOLDER' && navigateToFolder(file)}
                  onContextMenu={(e) => handleContextMenu(e, file)}
                  onToggleStar={() =>
                    toggleStar.mutate({ id: file.id, starred: !file.isStarred })
                  }
                />
              ))}
            </div>
          ) : (
            <FileListView
              files={sortedFiles}
              onOpen={(file) => file.type === 'FOLDER' && navigateToFolder(file)}
              onContextMenu={handleContextMenu}
              onToggleStar={(file) =>
                toggleStar.mutate({ id: file.id, starred: !file.isStarred })
              }
            />
          )}
        </div>
      </main>

      {/* ===== Context Menu ===== */}
      {contextMenu && (
        <ContextMenuPopup
          x={contextMenu.x}
          y={contextMenu.y}
          file={contextMenu.file}
          onClose={() => setContextMenu(null)}
          onRename={() => {
            setShowRename(contextMenu.file);
            setContextMenu(null);
          }}
          onDelete={() => {
            deleteFile.mutate(contextMenu.file.id);
            setContextMenu(null);
          }}
          onToggleStar={() => {
            toggleStar.mutate({
              id: contextMenu.file.id,
              starred: !contextMenu.file.isStarred,
            });
            setContextMenu(null);
          }}
        />
      )}

      {/* ===== New Folder Modal ===== */}
      <NewFolderModal
        open={showNewFolder}
        onClose={() => setShowNewFolder(false)}
        onCreate={(name) => createFolder.mutate(name)}
        loading={createFolder.isPending}
      />

      {/* ===== Rename Modal ===== */}
      {showRename && (
        <RenameModal
          open
          onClose={() => setShowRename(null)}
          onRename={(name) => renameFile.mutate({ id: showRename.id, name })}
          loading={renameFile.isPending}
          currentName={showRename.name}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Grid Card                                                          */
/* ------------------------------------------------------------------ */

function FileGridCard({
  file,
  onOpen,
  onContextMenu,
  onToggleStar,
}: {
  file: FileItem;
  onOpen: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onToggleStar: () => void;
}) {
  return (
    <div
      onDoubleClick={onOpen}
      onContextMenu={onContextMenu}
      className="group bg-bg-secondary border border-border-primary rounded-lg p-3 cursor-pointer hover:border-border-secondary hover:shadow-sm transition-all relative"
    >
      {/* Star toggle */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleStar();
        }}
        className={cn(
          'absolute top-2 right-2 p-1 rounded-lg transition-all focus-visible:outline-2 focus-visible:outline-accent-blue',
          file.isStarred
            ? 'text-accent-amber opacity-100'
            : 'text-text-tertiary opacity-0 group-hover:opacity-100 hover:text-accent-amber'
        )}
      >
        <Star size={14} fill={file.isStarred ? 'currentColor' : 'none'} />
      </button>

      {/* Icon / thumbnail */}
      <div className="flex items-center justify-center h-16 mb-2">
        {file.thumbnailUrl ? (
          <img
            src={file.thumbnailUrl}
            alt={file.name}
            className="h-full w-full object-cover rounded-lg"
          />
        ) : (
          getFileIconLarge(file.mimeType, file.type === 'FOLDER')
        )}
      </div>

      {/* Name, size / date */}
      <p className="text-sm text-text-primary truncate font-medium">{file.name}</p>
      <p className="text-[11px] text-text-tertiary mt-0.5 truncate">
        {file.type === 'FOLDER'
          ? formatRelativeTime(file.updatedAt)
          : file.size != null
            ? formatFileSize(file.size)
            : ''}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  List View                                                          */
/* ------------------------------------------------------------------ */

function FileListView({
  files,
  onOpen,
  onContextMenu,
  onToggleStar,
}: {
  files: FileItem[];
  onOpen: (file: FileItem) => void;
  onContextMenu: (e: React.MouseEvent, file: FileItem) => void;
  onToggleStar: (file: FileItem) => void;
}) {
  return (
    <div>
      {/* Table header */}
      <div className="grid grid-cols-[1fr_100px_120px_120px] gap-3 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-text-tertiary border-b border-border-primary">
        <span>Name</span>
        <span>Size</span>
        <span>Modified</span>
        <span>Owner</span>
      </div>

      {/* Rows */}
      <div className="divide-y divide-border-primary">
        {files.map((file) => (
          <div
            key={file.id}
            onDoubleClick={() => onOpen(file)}
            onContextMenu={(e) => onContextMenu(e, file)}
            className="grid grid-cols-[1fr_100px_120px_120px] gap-3 px-3 py-2 hover:bg-bg-hover cursor-pointer transition-colors items-center group"
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="flex-shrink-0">{getFileIcon(file.mimeType, file.type === 'FOLDER')}</span>
              <span className="text-sm text-text-primary truncate">{file.name}</span>
              {file.isStarred && (
                <Star
                  size={12}
                  className="text-accent-amber flex-shrink-0"
                  fill="currentColor"
                />
              )}
            </div>
            <span className="text-xs text-text-tertiary truncate">
              {file.type === 'FOLDER'
                ? '--'
                : file.size != null
                  ? formatFileSize(file.size)
                  : '--'}
            </span>
            <span className="text-xs text-text-tertiary truncate">
              {formatRelativeTime(file.updatedAt)}
            </span>
            <span className="text-xs text-text-tertiary truncate">
              {file.createdBy.displayName}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Context Menu                                                       */
/* ------------------------------------------------------------------ */

function ContextMenuPopup({
  x,
  y,
  file,
  onClose,
  onRename,
  onDelete,
  onToggleStar,
}: {
  x: number;
  y: number;
  file: FileItem;
  onClose: () => void;
  onRename: () => void;
  onDelete: () => void;
  onToggleStar: () => void;
}) {
  interface MenuItem {
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
    danger?: boolean;
  }
  interface Divider {
    type: 'divider';
  }

  const items: (MenuItem | Divider)[] = [
    { icon: <Download size={14} />, label: 'Download', onClick: onClose },
    { icon: <Pencil size={14} />, label: 'Rename', onClick: onRename },
    {
      icon: <Star size={14} />,
      label: file.isStarred ? 'Unstar' : 'Star',
      onClick: onToggleStar,
    },
    { icon: <Move size={14} />, label: 'Move', onClick: onClose },
    { icon: <Copy size={14} />, label: 'Copy', onClick: onClose },
    { icon: <Share2 size={14} />, label: 'Share', onClick: onClose },
    { type: 'divider' },
    { icon: <Trash2 size={14} />, label: 'Delete', onClick: onDelete, danger: true },
  ];

  return (
    <div
      className="fixed z-50 bg-bg-secondary border border-border-secondary rounded-lg shadow-lg py-1 min-w-[180px]"
      style={{ left: x, top: y }}
    >
      {items.map((item, i) => {
        if ('type' in item) {
          return <div key={i} className="my-1 h-px bg-border-primary" />;
        }
        const menuItem = item as MenuItem;
        return (
          <button
            key={i}
            onClick={menuItem.onClick}
            className={cn(
              'w-full flex items-center gap-2 px-3 py-1.5 text-sm transition-colors',
              menuItem.danger
                ? 'text-accent-red hover:bg-accent-red/10'
                : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
            )}
          >
            {menuItem.icon}
            {menuItem.label}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Modals                                                             */
/* ------------------------------------------------------------------ */

function NewFolderModal({
  open,
  onClose,
  onCreate,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string) => void;
  loading: boolean;
}) {
  const [name, setName] = useState('');

  const handleCreate = () => {
    if (!name.trim()) return;
    onCreate(name.trim());
    setName('');
  };

  return (
    <Modal open={open} onClose={onClose} title="New Folder" size="sm">
      <div className="space-y-4">
        <Input
          label="Folder name"
          placeholder="Untitled folder"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
        />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleCreate} loading={loading} disabled={!name.trim()}>
            Create
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function RenameModal({
  open,
  onClose,
  onRename,
  loading,
  currentName,
}: {
  open: boolean;
  onClose: () => void;
  onRename: (name: string) => void;
  loading: boolean;
  currentName: string;
}) {
  const [name, setName] = useState(currentName);

  const handleRename = () => {
    if (!name.trim() || name.trim() === currentName) return;
    onRename(name.trim());
  };

  return (
    <Modal open={open} onClose={onClose} title="Rename" size="sm">
      <div className="space-y-4">
        <Input
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleRename()}
        />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleRename} loading={loading} disabled={!name.trim()}>
            Rename
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/*  Loading Skeletons                                                  */
/* ------------------------------------------------------------------ */

function FilesSkeleton({ viewMode }: { viewMode: 'grid' | 'list' }) {
  if (viewMode === 'grid') {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="bg-bg-secondary rounded-lg border border-border-primary p-3">
            <Skeleton className="h-16 w-full rounded-lg mb-2" />
            <Skeleton className="h-3.5 w-3/4 mb-1" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-2">
          <Skeleton className="h-5 w-5 rounded-lg" />
          <Skeleton className="h-3.5 flex-1" />
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-20" />
        </div>
      ))}
    </div>
  );
}
