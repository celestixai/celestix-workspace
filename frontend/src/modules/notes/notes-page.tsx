import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState as LegacyEmptyState } from '@/components/shared/empty-state';
import { EmptyState } from '@/components/shared/EmptyState';
import { toast } from '@/components/ui/toast';
import { cn, formatRelativeTime } from '@/lib/utils';
import {
  FileText,
  StickyNote,
  Plus,
  Search,
  FolderOpen,
  Folder,
  ChevronRight,
  ChevronDown,
  Star,
  MoreHorizontal,
  Trash2,
  Pencil,
  Tag,
  X,
  Hash,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Code,
  List,
  ListOrdered,
  Quote,
  ImageIcon,
  Link,
  Heading1,
  Heading2,
  CheckSquare,
  Minus,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Note {
  id: string;
  title: string;
  content: string;
  contentText?: string;
  contentJson?: unknown;
  preview: string;
  folderId: string | null;
  tags: string[];
  isPinned?: boolean;
  isStarred: boolean;
  wordCount: number;
  createdAt: string;
  updatedAt: string;
}

interface NoteFolder {
  id: string;
  name: string;
  parentId: string | null;
  icon?: string;
  children?: NoteFolder[];
  noteCount: number;
  _count?: { notes: number };
}

/* ------------------------------------------------------------------ */
/*  Notes Page                                                         */
/* ------------------------------------------------------------------ */

export function NotesPage() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [editorContent, setEditorContent] = useState('');
  const [editorTitle, setEditorTitle] = useState('');
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  /* -- Queries -- */

  const { data: folders = [], isLoading: foldersLoading } = useQuery({
    queryKey: ['note-folders'],
    queryFn: async () => {
      const { data } = await api.get('/notes/folders');
      return data.data as NoteFolder[];
    },
  });

  const { data: notes = [], isLoading: notesLoading } = useQuery({
    queryKey: ['notes', selectedFolderId, selectedTag],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (selectedFolderId) params.folderId = selectedFolderId;
      if (selectedTag) params.tag = selectedTag;
      const { data } = await api.get('/notes', { params });
      return data.data as Note[];
    },
  });

  const { data: allTags = [] } = useQuery({
    queryKey: ['note-tags'],
    queryFn: async () => {
      const { data } = await api.get('/notes/tags');
      return data.data as string[];
    },
  });

  const selectedNote = notes.find((n) => n.id === selectedNoteId) || null;

  /* -- Filtered notes -- */

  const filteredNotes = useMemo(() => {
    if (!searchQuery.trim()) return notes;
    const q = searchQuery.toLowerCase();
    return notes.filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        (n.preview || n.contentText || '').toLowerCase().includes(q)
    );
  }, [notes, searchQuery]);

  /* -- Set editor content when note changes -- */

  useEffect(() => {
    if (selectedNote) {
      setEditorTitle(selectedNote.title);
      setEditorContent(selectedNote.content || selectedNote.contentText || '');
    } else {
      setEditorTitle('');
      setEditorContent('');
    }
  }, [selectedNote]);

  /* -- Mutations -- */

  const createNote = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/notes', {
        title: 'Untitled',
        contentText: '',
        folderId: selectedFolderId,
      });
      return data.data as Note;
    },
    onSuccess: (note) => {
      queryClient.invalidateQueries({ queryKey: ['notes'] });
      setSelectedNoteId(note.id);
      toast('Note created', 'success');
    },
    onError: () => toast('Failed to create note', 'error'),
  });

  const updateNote = useMutation({
    mutationFn: async ({ id, ...payload }: Partial<Note> & { id: string }) => {
      await api.patch(`/notes/${id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes'] });
    },
    onError: () => toast('Failed to save', 'error'),
  });

  const deleteNote = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/notes/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes'] });
      setSelectedNoteId(null);
      toast('Note deleted', 'success');
    },
    onError: () => toast('Failed to delete note', 'error'),
  });

  const createFolder = useMutation({
    mutationFn: async (name: string) => {
      await api.post('/notes/folders', { name, parentFolderId: null });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['note-folders'] });
      setShowCreateFolder(false);
      toast('Folder created', 'success');
    },
    onError: () => toast('Failed to create folder', 'error'),
  });

  const toggleStar = useMutation({
    mutationFn: async ({ id, starred }: { id: string; starred: boolean }) => {
      await api.patch(`/notes/${id}`, { isStarred: starred });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notes'] }),
  });

  /* -- Auto-save on blur -- */

  const handleSave = () => {
    if (!selectedNote) return;
    const hasChanges = editorTitle !== selectedNote.title || editorContent !== (selectedNote.content || selectedNote.contentText || '');
    if (hasChanges) {
      updateNote.mutate({ id: selectedNote.id, title: editorTitle, contentText: editorContent });
    }
  };

  /* -- Folder toggle -- */

  const toggleFolder = (folderId: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  };

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <div className="flex h-full overflow-hidden">
      {/* ===== Folder Sidebar ===== */}
      <aside className="w-[220px] flex-shrink-0 bg-bg-secondary border-r border-border-primary flex flex-col">
        {/* Header */}
        <div className="h-12 flex items-center justify-between px-4 border-b border-border-primary flex-shrink-0">
          <span className="text-sm font-semibold text-text-primary">Notes</span>
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => createNote.mutate()}
              className="p-1 rounded-lg hover:bg-bg-hover text-text-tertiary hover:text-text-primary transition-colors focus-visible:outline-2 focus-visible:outline-accent-blue"
              title="New note"
              aria-label="New note"
            >
              <Plus size={16} />
            </button>
          </div>
        </div>

        {/* All notes button */}
        <div className="px-2 pt-2">
          <button
            onClick={() => {
              setSelectedFolderId(null);
              setSelectedTag(null);
            }}
            className={cn(
              'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors',
              !selectedFolderId && !selectedTag
                ? 'bg-bg-active text-text-primary font-medium'
                : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
            )}
          >
            <FileText size={16} />
            All Notes
          </button>
        </div>

        {/* Folders */}
        <div className="flex-1 overflow-y-auto px-2 py-2">
          <div className="flex items-center justify-between px-2 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
              Folders
            </span>
            <button
              onClick={() => setShowCreateFolder(true)}
              className="p-0.5 rounded-lg hover:bg-bg-hover text-text-tertiary hover:text-text-primary transition-colors focus-visible:outline-2 focus-visible:outline-accent-blue"
              title="Create folder"
              aria-label="Create folder"
            >
              <Plus size={12} />
            </button>
          </div>

          {foldersLoading ? (
            <div className="space-y-1 px-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-7 w-full" />
              ))}
            </div>
          ) : folders.length === 0 ? (
            <p className="text-xs text-text-tertiary px-3 py-2">No folders</p>
          ) : (
            <div className="space-y-0.5">
              {folders.map((folder) => (
                <FolderItem
                  key={folder.id}
                  folder={folder}
                  selectedFolderId={selectedFolderId}
                  expandedFolders={expandedFolders}
                  onSelect={(id) => {
                    setSelectedFolderId(id);
                    setSelectedTag(null);
                  }}
                  onToggle={toggleFolder}
                />
              ))}
            </div>
          )}

          {/* Tags */}
          <div className="mt-4">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary px-2">
              Tags
            </span>
            <div className="mt-1 space-y-0.5">
              {allTags.length === 0 ? (
                <p className="text-xs text-text-tertiary px-3 py-2">No tags</p>
              ) : (
                allTags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => {
                      setSelectedTag(tag);
                      setSelectedFolderId(null);
                    }}
                    className={cn(
                      'w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors min-w-0',
                      selectedTag === tag
                        ? 'bg-bg-active text-accent-blue font-medium'
                        : 'text-text-secondary hover:bg-bg-hover'
                    )}
                  >
                    <Hash size={12} className="flex-shrink-0" />
                    <span className="truncate">{tag}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* ===== Note List ===== */}
      <div className="w-[260px] flex-shrink-0 border-r border-border-primary flex flex-col bg-bg-primary">
        {/* Search */}
        <div className="h-12 flex items-center px-3 border-b border-border-primary flex-shrink-0">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-tertiary" />
            <input
              type="text"
              placeholder="Search notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-8 pl-8 pr-3 rounded-lg bg-bg-tertiary border border-border-primary text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent-blue"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {notesLoading ? (
            <div className="space-y-1 p-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="p-3 space-y-2">
                  <Skeleton className="h-3.5 w-3/4" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-16" />
                </div>
              ))}
            </div>
          ) : filteredNotes.length === 0 ? (
            <LegacyEmptyState
              icon={<FileText size={36} />}
              title="No notes"
              description={searchQuery ? 'Try a different search' : 'Create your first note'}
              action={
                !searchQuery ? (
                  <Button size="sm" onClick={() => createNote.mutate()}>
                    <Plus size={14} /> New Note
                  </Button>
                ) : undefined
              }
              className="py-8"
            />
          ) : (
            <div className="divide-y divide-border-primary">
              {filteredNotes.map((note) => (
                <NoteListItem
                  key={note.id}
                  note={note}
                  active={selectedNoteId === note.id}
                  onClick={() => setSelectedNoteId(note.id)}
                  onToggleStar={() =>
                    toggleStar.mutate({ id: note.id, starred: !note.isStarred })
                  }
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ===== Editor Area ===== */}
      <main className="flex-1 flex flex-col min-w-0 bg-bg-primary">
        {selectedNote ? (
          <>
            {/* Editor toolbar */}
            <div className="h-12 flex items-center gap-1 px-4 border-b border-border-primary flex-shrink-0">
              <div className="flex items-center gap-0.5">
                {[
                  { icon: Bold, label: 'Bold' },
                  { icon: Italic, label: 'Italic' },
                  { icon: Underline, label: 'Underline' },
                  { icon: Strikethrough, label: 'Strikethrough' },
                ].map(({ icon: Icon, label }) => (
                  <button
                    key={label}
                    title={label}
                    aria-label={label}
                    className="p-1.5 rounded-lg hover:bg-bg-hover text-text-tertiary hover:text-text-primary transition-colors"
                  >
                    <Icon size={15} />
                  </button>
                ))}
              </div>

              <div className="w-px h-5 bg-border-primary mx-1" />

              <div className="flex items-center gap-0.5">
                {[
                  { icon: Heading1, label: 'Heading 1' },
                  { icon: Heading2, label: 'Heading 2' },
                ].map(({ icon: Icon, label }) => (
                  <button
                    key={label}
                    title={label}
                    aria-label={label}
                    className="p-1.5 rounded-lg hover:bg-bg-hover text-text-tertiary hover:text-text-primary transition-colors"
                  >
                    <Icon size={15} />
                  </button>
                ))}
              </div>

              <div className="w-px h-5 bg-border-primary mx-1" />

              <div className="flex items-center gap-0.5">
                {[
                  { icon: List, label: 'Bullet list' },
                  { icon: ListOrdered, label: 'Numbered list' },
                  { icon: CheckSquare, label: 'Task list' },
                  { icon: Quote, label: 'Quote' },
                  { icon: Code, label: 'Code' },
                  { icon: Minus, label: 'Divider' },
                ].map(({ icon: Icon, label }) => (
                  <button
                    key={label}
                    title={label}
                    aria-label={label}
                    className="p-1.5 rounded-lg hover:bg-bg-hover text-text-tertiary hover:text-text-primary transition-colors"
                  >
                    <Icon size={15} />
                  </button>
                ))}
              </div>

              <div className="w-px h-5 bg-border-primary mx-1" />

              <div className="flex items-center gap-0.5">
                {[
                  { icon: Link, label: 'Link' },
                  { icon: ImageIcon, label: 'Image' },
                ].map(({ icon: Icon, label }) => (
                  <button
                    key={label}
                    title={label}
                    aria-label={label}
                    className="p-1.5 rounded-lg hover:bg-bg-hover text-text-tertiary hover:text-text-primary transition-colors"
                  >
                    <Icon size={15} />
                  </button>
                ))}
              </div>

              <div className="flex-1" />

              {/* Actions */}
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => deleteNote.mutate(selectedNote.id)}
                  className="p-1.5 rounded-lg hover:bg-bg-hover text-text-tertiary hover:text-accent-red transition-colors focus-visible:outline-2 focus-visible:outline-accent-blue"
                  title="Delete note"
                  aria-label="Delete note"
                >
                  <Trash2 size={15} />
                </button>
                <button
                  className="p-1.5 rounded-lg hover:bg-bg-hover text-text-tertiary hover:text-text-primary transition-colors focus-visible:outline-2 focus-visible:outline-accent-blue"
                  title="More options"
                  aria-label="More options"
                >
                  <MoreHorizontal size={15} />
                </button>
              </div>
            </div>

            {/* Editor content */}
            <div className="flex-1 overflow-y-auto py-8 px-4">
              <div className="max-w-2xl mx-auto bg-[#111113] border border-[rgba(255,255,255,0.08)] rounded-[12px] p-8 min-h-[600px]">
                {/* Title */}
                <input
                  value={editorTitle}
                  onChange={(e) => setEditorTitle(e.target.value)}
                  onBlur={handleSave}
                  placeholder="Untitled"
                  className="w-full text-2xl font-display text-text-primary bg-transparent focus:outline-none border-none outline-none mb-1 placeholder:text-text-tertiary/40"
                />

                {/* Tags */}
                <div className="flex items-center gap-1.5 mb-4">
                  {(selectedNote.tags || []).map((tag) => (
                    <span
                      key={typeof tag === 'string' ? tag : (tag as any)?.tag?.name || ''}
                      className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-bg-tertiary text-xs text-text-secondary"
                    >
                      <Hash size={10} />
                      {typeof tag === 'string' ? tag : (tag as any)?.tag?.name || ''}
                    </span>
                  ))}
                  <button className="flex items-center gap-1 px-2 py-0.5 rounded-full border border-dashed border-border-secondary text-xs text-text-tertiary hover:text-text-secondary hover:border-border-primary transition-colors">
                    <Tag size={10} />
                    Add tag
                  </button>
                </div>

                {/* Meta */}
                <div className="text-xs text-text-tertiary mb-4">
                  Last edited {formatRelativeTime(selectedNote.updatedAt)}
                  {selectedNote.wordCount > 0 && <> &middot; {selectedNote.wordCount} words</>}
                </div>

                {/* Divider */}
                <div className="border-t border-[rgba(255,255,255,0.06)] mb-5" />

                {/* Rich text area (TipTap placeholder) */}
                <div className="ProseMirror">
                  <textarea
                    value={editorContent}
                    onChange={(e) => setEditorContent(e.target.value)}
                    onBlur={handleSave}
                    placeholder="Start writing..."
                    className="w-full min-h-[400px] bg-transparent text-text-primary text-sm leading-relaxed focus:outline-none resize-none placeholder:text-text-tertiary/40"
                  />
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <EmptyState
              icon={StickyNote}
              title="No notes yet"
              description="Capture your thoughts and ideas"
              actionLabel="+ New Note"
              onAction={() => createNote.mutate()}
            />
          </div>
        )}
      </main>

      {/* Create Folder Modal */}
      <CreateFolderModal
        open={showCreateFolder}
        onClose={() => setShowCreateFolder(false)}
        onCreate={(name) => createFolder.mutate(name)}
        loading={createFolder.isPending}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function FolderItem({
  folder,
  selectedFolderId,
  expandedFolders,
  onSelect,
  onToggle,
  depth = 0,
}: {
  folder: NoteFolder;
  selectedFolderId: string | null;
  expandedFolders: Set<string>;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
  depth?: number;
}) {
  const isExpanded = expandedFolders.has(folder.id);
  const isSelected = selectedFolderId === folder.id;
  const hasChildren = folder.children && folder.children.length > 0;
  const count = folder.noteCount ?? folder._count?.notes ?? 0;

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onClick={() => onSelect(folder.id)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(folder.id); } }}
        className={cn(
          'w-full flex items-center gap-2 py-1.5 rounded-lg text-sm transition-colors cursor-pointer min-w-0',
          isSelected
            ? 'bg-bg-active text-text-primary font-medium'
            : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
        )}
        style={{ paddingLeft: 8 + depth * 16 }}
      >
        {hasChildren ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggle(folder.id);
            }}
            className="p-0.5 flex-shrink-0"
            aria-label={isExpanded ? 'Collapse folder' : 'Expand folder'}
          >
            {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </button>
        ) : (
          <span className="w-4 flex-shrink-0" />
        )}
        {isExpanded ? (
          <FolderOpen size={14} className="text-accent-amber flex-shrink-0" />
        ) : (
          <Folder size={14} className="text-accent-amber flex-shrink-0" />
        )}
        <span className="truncate flex-1 text-left">{folder.name}</span>
        <span className="text-[10px] text-text-tertiary mr-2 flex-shrink-0">{count}</span>
      </div>

      {isExpanded && hasChildren && (
        <div>
          {folder.children!.map((child) => (
            <FolderItem
              key={child.id}
              folder={child}
              selectedFolderId={selectedFolderId}
              expandedFolders={expandedFolders}
              onSelect={onSelect}
              onToggle={onToggle}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function NoteListItem({
  note,
  active,
  onClick,
  onToggleStar,
}: {
  note: Note;
  active: boolean;
  onClick: () => void;
  onToggleStar: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'px-3 py-3 cursor-pointer transition-colors group',
        active ? 'bg-bg-active' : 'hover:bg-bg-hover'
      )}
    >
      <div className="flex items-center gap-2 mb-1 min-w-0">
        <p className="text-sm font-medium text-text-primary truncate flex-1 min-w-0">
          {note.title || 'Untitled'}
        </p>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleStar();
          }}
          className={cn(
            'p-0.5 rounded-lg transition-all flex-shrink-0',
            note.isStarred
              ? 'text-accent-amber'
              : 'text-text-tertiary opacity-0 group-hover:opacity-100 hover:text-accent-amber'
          )}
          title={note.isStarred ? 'Unstar note' : 'Star note'}
          aria-label={note.isStarred ? 'Unstar note' : 'Star note'}
        >
          <Star size={12} fill={note.isStarred ? 'currentColor' : 'none'} />
        </button>
      </div>
      <p className="text-xs text-text-tertiary line-clamp-2 mb-1">
        {note.preview || note.contentText || ''}
      </p>
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-[10px] text-text-tertiary truncate">{formatRelativeTime(note.updatedAt)}</span>
        {(note.tags || []).length > 0 && (
          <div className="flex gap-1 flex-shrink-0">
            {(typeof note.tags[0] === 'string'
              ? (note.tags as string[]).slice(0, 2)
              : (note.tags as any[]).slice(0, 2).map((t: any) => t?.tag?.name || '')
            ).map((tag: string) => (
              <span key={tag} className="text-[10px] text-accent-blue">#{tag}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CreateFolderModal({
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
    <Modal open={open} onClose={onClose} title="Create Folder" size="sm">
      <div className="space-y-4">
        <Input
          label="Folder name"
          placeholder="My Notes"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
        />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleCreate} loading={loading} disabled={!name.trim()}>
            Create
          </Button>
        </div>
      </div>
    </Modal>
  );
}
