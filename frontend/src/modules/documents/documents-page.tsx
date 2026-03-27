import { useState, useEffect, useRef, useCallback } from 'react';
import { useUIStore } from '@/stores/ui.store';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  FileText,
  Plus,
  ArrowLeft,
  Search,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Link,
  Image,
  Table,
  Undo2,
  Redo2,
  Save,
  Clock,
  Users,
  MessageSquare,
  MoreVertical,
  X,
  ChevronDown,
  RotateCcw,
  Trash2,
  Type,
} from 'lucide-react';

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

interface DocVersion {
  id: string;
  timestamp: string;
  wordCount: number;
  content: string;
}

interface Collaborator {
  id: string;
  name: string;
  email: string;
  avatar?: string;
}

interface Comment {
  id: string;
  author: string;
  text: string;
  timestamp: string;
  resolved: boolean;
}

interface Document {
  id: string;
  title: string;
  content: string;
  wordCount: number;
  createdAt: string;
  updatedAt: string;
  versions: DocVersion[];
  collaborators: Collaborator[];
  comments: Comment[];
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function countWords(text: string): number {
  const stripped = text.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ');
  const words = stripped.trim().split(/\s+/).filter(Boolean);
  return words.length;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

const FONT_SIZES = ['12', '14', '16', '18', '20', '24', '28', '32', '36', '48'];

// ──────────────────────────────────────────────
// Toolbar Button
// ──────────────────────────────────────────────

function ToolbarButton({
  active,
  onClick,
  title,
  children,
  disabled,
}: {
  active?: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={cn(
        'p-1.5 rounded transition-colors',
        active
          ? 'bg-accent-blue/20 text-accent-blue'
          : 'text-text-secondary hover:text-text-primary hover:bg-bg-primary',
        disabled && 'opacity-40 cursor-not-allowed'
      )}
    >
      {children}
    </button>
  );
}

function ToolbarSeparator() {
  return <div className="w-px h-6 bg-border-primary mx-1" />;
}

// ──────────────────────────────────────────────
// Editor Toolbar
// ──────────────────────────────────────────────

function EditorToolbar({
  editorRef,
  fontSize,
  onFontSizeChange,
}: {
  editorRef: React.RefObject<HTMLDivElement | null>;
  fontSize: string;
  onFontSizeChange: (size: string) => void;
}) {
  const exec = (cmd: string, value?: string) => {
    document.execCommand(cmd, false, value);
    editorRef.current?.focus();
  };

  const isActive = (cmd: string): boolean => {
    try {
      return document.queryCommandState(cmd);
    } catch {
      return false;
    }
  };

  const [showFontSize, setShowFontSize] = useState(false);

  return (
    <div className="flex items-center gap-0.5 px-4 py-2 bg-bg-secondary border-b border-border-primary flex-wrap">
      {/* Text formatting */}
      <ToolbarButton active={isActive('bold')} onClick={() => exec('bold')} title="Bold (Ctrl+B)">
        <Bold size={16} />
      </ToolbarButton>
      <ToolbarButton active={isActive('italic')} onClick={() => exec('italic')} title="Italic (Ctrl+I)">
        <Italic size={16} />
      </ToolbarButton>
      <ToolbarButton active={isActive('underline')} onClick={() => exec('underline')} title="Underline (Ctrl+U)">
        <Underline size={16} />
      </ToolbarButton>
      <ToolbarButton active={isActive('strikeThrough')} onClick={() => exec('strikeThrough')} title="Strikethrough">
        <Strikethrough size={16} />
      </ToolbarButton>

      <ToolbarSeparator />

      {/* Font size dropdown */}
      <div className="relative">
        <button
          onClick={() => setShowFontSize(!showFontSize)}
          className="flex items-center gap-1 px-2 py-1 text-xs text-text-secondary hover:text-text-primary rounded hover:bg-bg-primary transition-colors"
          title="Font size"
        >
          <Type size={14} />
          {fontSize}px
          <ChevronDown size={12} />
        </button>
        {showFontSize && (
          <div className="absolute top-full left-0 mt-1 bg-bg-secondary border border-border-primary rounded-lg shadow-lg z-20 py-1 min-w-[80px]">
            {FONT_SIZES.map((s) => (
              <button
                key={s}
                onClick={() => {
                  onFontSizeChange(s);
                  exec('fontSize', '3');
                  setShowFontSize(false);
                }}
                className={cn(
                  'w-full text-left px-3 py-1 text-xs hover:bg-bg-primary transition-colors',
                  s === fontSize ? 'text-accent-blue' : 'text-text-primary'
                )}
              >
                {s}px
              </button>
            ))}
          </div>
        )}
      </div>

      <ToolbarSeparator />

      {/* Headings */}
      <ToolbarButton onClick={() => exec('formatBlock', 'h1')} title="Heading 1">
        <Heading1 size={16} />
      </ToolbarButton>
      <ToolbarButton onClick={() => exec('formatBlock', 'h2')} title="Heading 2">
        <Heading2 size={16} />
      </ToolbarButton>
      <ToolbarButton onClick={() => exec('formatBlock', 'h3')} title="Heading 3">
        <Heading3 size={16} />
      </ToolbarButton>

      <ToolbarSeparator />

      {/* Lists */}
      <ToolbarButton
        active={isActive('insertUnorderedList')}
        onClick={() => exec('insertUnorderedList')}
        title="Bullet list"
      >
        <List size={16} />
      </ToolbarButton>
      <ToolbarButton
        active={isActive('insertOrderedList')}
        onClick={() => exec('insertOrderedList')}
        title="Numbered list"
      >
        <ListOrdered size={16} />
      </ToolbarButton>

      <ToolbarSeparator />

      {/* Alignment */}
      <ToolbarButton onClick={() => exec('justifyLeft')} title="Align left">
        <AlignLeft size={16} />
      </ToolbarButton>
      <ToolbarButton onClick={() => exec('justifyCenter')} title="Align center">
        <AlignCenter size={16} />
      </ToolbarButton>
      <ToolbarButton onClick={() => exec('justifyRight')} title="Align right">
        <AlignRight size={16} />
      </ToolbarButton>

      <ToolbarSeparator />

      {/* Insert */}
      <ToolbarButton
        onClick={() => {
          const url = prompt('Enter link URL:');
          if (url) exec('createLink', url);
        }}
        title="Insert link"
      >
        <Link size={16} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => {
          const url = prompt('Enter image URL:');
          if (url) exec('insertImage', url);
        }}
        title="Insert image"
      >
        <Image size={16} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => {
          exec(
            'insertHTML',
            '<table style="border-collapse:collapse;width:100%"><tr><td style="border:1px solid #444;padding:8px">&nbsp;</td><td style="border:1px solid #444;padding:8px">&nbsp;</td><td style="border:1px solid #444;padding:8px">&nbsp;</td></tr><tr><td style="border:1px solid #444;padding:8px">&nbsp;</td><td style="border:1px solid #444;padding:8px">&nbsp;</td><td style="border:1px solid #444;padding:8px">&nbsp;</td></tr></table>'
          );
        }}
        title="Insert table"
      >
        <Table size={16} />
      </ToolbarButton>

      <ToolbarSeparator />

      {/* Undo/Redo */}
      <ToolbarButton onClick={() => exec('undo')} title="Undo (Ctrl+Z)">
        <Undo2 size={16} />
      </ToolbarButton>
      <ToolbarButton onClick={() => exec('redo')} title="Redo (Ctrl+Y)">
        <Redo2 size={16} />
      </ToolbarButton>
    </div>
  );
}

// ──────────────────────────────────────────────
// Version History Panel
// ──────────────────────────────────────────────

function VersionHistoryPanel({
  versions,
  onRestore,
  onClose,
}: {
  versions: DocVersion[];
  onRestore: (version: DocVersion) => void;
  onClose: () => void;
}) {
  return (
    <aside className="w-72 bg-bg-secondary border-l border-border-primary flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b border-border-primary">
        <h3 className="text-sm font-semibold text-text-primary">Version History</h3>
        <button onClick={onClose} className="text-text-secondary hover:text-text-primary">
          <X size={18} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {versions.length === 0 ? (
          <p className="p-4 text-sm text-text-secondary">No versions saved yet.</p>
        ) : (
          versions.map((v) => (
            <div
              key={v.id}
              className="flex items-center justify-between px-4 py-3 border-b border-border-primary hover:bg-bg-primary/50"
            >
              <div>
                <p className="text-sm text-text-primary">
                  {new Date(v.timestamp).toLocaleString()}
                </p>
                <p className="text-xs text-text-secondary">{v.wordCount} words</p>
              </div>
              <button
                onClick={() => onRestore(v)}
                className="text-xs text-accent-blue hover:underline flex items-center gap-1"
              >
                <RotateCcw size={12} />
                Restore
              </button>
            </div>
          ))
        )}
      </div>
    </aside>
  );
}

// ──────────────────────────────────────────────
// Collaborators Panel
// ──────────────────────────────────────────────

function CollaboratorsPanel({
  collaborators,
  onAdd,
  onRemove,
  onClose,
}: {
  collaborators: Collaborator[];
  onAdd: (email: string) => void;
  onRemove: (id: string) => void;
  onClose: () => void;
}) {
  const [email, setEmail] = useState('');

  return (
    <aside className="w-72 bg-bg-secondary border-l border-border-primary flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b border-border-primary">
        <h3 className="text-sm font-semibold text-text-primary">Collaborators</h3>
        <button onClick={onClose} className="text-text-secondary hover:text-text-primary">
          <X size={18} />
        </button>
      </div>
      <div className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && email.trim()) {
                onAdd(email.trim());
                setEmail('');
              }
            }}
            placeholder="Add by email..."
            className="flex-1 bg-bg-primary border border-border-primary rounded px-2 py-1.5 text-sm text-text-primary placeholder-text-secondary outline-none focus:border-accent-blue"
          />
          <button
            onClick={() => {
              if (email.trim()) {
                onAdd(email.trim());
                setEmail('');
              }
            }}
            className="text-accent-blue hover:text-accent-blue/80"
          >
            <Plus size={18} />
          </button>
        </div>
        <div className="space-y-2">
          {collaborators.map((c) => (
            <div key={c.id} className="flex items-center justify-between py-2 group">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-accent-blue/20 flex items-center justify-center text-accent-blue text-xs font-bold">
                  {c.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm text-text-primary">{c.name}</p>
                  <p className="text-xs text-text-secondary">{c.email}</p>
                </div>
              </div>
              <button
                onClick={() => onRemove(c.id)}
                className="opacity-0 group-hover:opacity-100 text-text-secondary hover:text-red-400"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}

// ──────────────────────────────────────────────
// Comments Panel
// ──────────────────────────────────────────────

function CommentsPanel({
  comments,
  onAdd,
  onResolve,
  onClose,
}: {
  comments: Comment[];
  onAdd: (text: string) => void;
  onResolve: (id: string) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState('');

  return (
    <aside className="w-72 bg-bg-secondary border-l border-border-primary flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b border-border-primary">
        <h3 className="text-sm font-semibold text-text-primary">
          Comments ({comments.filter((c) => !c.resolved).length})
        </h3>
        <button onClick={onClose} className="text-text-secondary hover:text-text-primary">
          <X size={18} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {comments.map((c) => (
          <div
            key={c.id}
            className={cn(
              'p-3 rounded-lg border',
              c.resolved
                ? 'border-border-primary opacity-50'
                : 'border-accent-blue/30 bg-accent-blue/5'
            )}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-text-primary">{c.author}</span>
              <span className="text-xs text-text-secondary">{timeAgo(c.timestamp)}</span>
            </div>
            <p className="text-sm text-text-primary mb-2">{c.text}</p>
            {!c.resolved && (
              <button
                onClick={() => onResolve(c.id)}
                className="text-xs text-accent-blue hover:underline"
              >
                Resolve
              </button>
            )}
          </div>
        ))}
      </div>
      <div className="p-4 border-t border-border-primary">
        <div className="flex items-center gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && text.trim()) {
                onAdd(text.trim());
                setText('');
              }
            }}
            placeholder="Add a comment..."
            className="flex-1 bg-bg-primary border border-border-primary rounded px-2 py-1.5 text-sm text-text-primary placeholder-text-secondary outline-none focus:border-accent-blue"
          />
        </div>
      </div>
    </aside>
  );
}

// ──────────────────────────────────────────────
// Document Card
// ──────────────────────────────────────────────

function DocumentCard({
  doc,
  onOpen,
  onDelete,
}: {
  doc: Document;
  onOpen: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      onClick={onOpen}
      className="bg-bg-secondary border border-border-primary rounded-xl p-4 cursor-pointer hover:border-accent-blue/50 transition-colors group"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-lg bg-accent-blue/10 flex items-center justify-center">
          <FileText size={20} className="text-accent-blue" />
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="opacity-0 group-hover:opacity-100 text-text-secondary hover:text-red-400 transition-opacity"
        >
          <Trash2 size={14} />
        </button>
      </div>
      <h3 className="text-sm font-medium text-text-primary truncate mb-1">
        {doc.title || 'Untitled'}
      </h3>
      <div className="flex items-center gap-3 text-xs text-text-secondary">
        <span>{doc.wordCount} words</span>
        <span>{timeAgo(doc.updatedAt)}</span>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// Main: DocumentsPage
// ──────────────────────────────────────────────

export function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const [fontSize, setFontSize] = useState('16');
  const [sidePanel, setSidePanel] = useState<'none' | 'versions' | 'collaborators' | 'comments'>('none');
  const editorRef = useRef<HTMLDivElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fileToOpen = useUIStore((s) => s.fileToOpen);
  const clearFileToOpen = useUIStore((s) => s.clearFileToOpen);

  // Load documents from API
  useEffect(() => {
    api.get('/documents').then((res) => {
      const data = res.data?.data ?? res.data;
      if (Array.isArray(data)) setDocuments(data);
    }).catch(() => {});
  }, []);

  // Handle file opened from Files module
  useEffect(() => {
    if (!fileToOpen) return;
    const doc: Document = {
      id: fileToOpen.fileId,
      title: fileToOpen.fileName.replace(/\.\w+$/, ''),
      content: '<p>Loading document content...</p>',
      wordCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      versions: [],
      collaborators: [],
      comments: [],
    };
    setDocuments((prev) => {
      const exists = prev.find((d) => d.id === fileToOpen.fileId);
      return exists ? prev : [doc, ...prev];
    });
    setActiveDocId(fileToOpen.fileId);
    clearFileToOpen();
  }, [fileToOpen, clearFileToOpen]);

  const activeDoc = documents.find((d) => d.id === activeDocId) ?? null;

  // Auto-save logic
  const triggerAutoSave = useCallback(
    (docId: string, content: string) => {
      setSaveStatus('unsaved');
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        setSaveStatus('saving');
        const wc = countWords(content);
        setDocuments((prev) =>
          prev.map((d) =>
            d.id === docId
              ? { ...d, content, wordCount: wc, updatedAt: new Date().toISOString() }
              : d
          )
        );
        api.put(`/documents/${docId}`, { content, wordCount: wc }).catch(() => {});
        setTimeout(() => setSaveStatus('saved'), 500);
      }, 1000);
    },
    []
  );

  // Handlers
  const createDocument = () => {
    const doc: Document = {
      id: generateId(),
      title: 'Untitled Document',
      content: '',
      wordCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      versions: [],
      collaborators: [],
      comments: [],
    };
    setDocuments((prev) => [doc, ...prev]);
    setActiveDocId(doc.id);
    api.post('/documents', doc).catch(() => {});
  };

  const deleteDocument = (id: string) => {
    setDocuments((prev) => prev.filter((d) => d.id !== id));
    if (activeDocId === id) setActiveDocId(null);
    api.delete(`/documents/${id}`).catch(() => {});
  };

  const updateDocTitle = (title: string) => {
    if (!activeDocId) return;
    setDocuments((prev) =>
      prev.map((d) =>
        d.id === activeDocId
          ? { ...d, title, updatedAt: new Date().toISOString() }
          : d
      )
    );
  };

  const saveVersion = () => {
    if (!activeDoc) return;
    const version: DocVersion = {
      id: generateId(),
      timestamp: new Date().toISOString(),
      wordCount: activeDoc.wordCount,
      content: activeDoc.content,
    };
    setDocuments((prev) =>
      prev.map((d) =>
        d.id === activeDocId
          ? { ...d, versions: [version, ...d.versions] }
          : d
      )
    );
  };

  const restoreVersion = (version: DocVersion) => {
    if (!activeDocId) return;
    setDocuments((prev) =>
      prev.map((d) =>
        d.id === activeDocId
          ? {
              ...d,
              content: version.content,
              wordCount: version.wordCount,
              updatedAt: new Date().toISOString(),
            }
          : d
      )
    );
    if (editorRef.current) {
      editorRef.current.innerHTML = version.content;
    }
  };

  const addCollaborator = (email: string) => {
    if (!activeDocId) return;
    const collab: Collaborator = {
      id: generateId(),
      name: email.split('@')[0],
      email,
    };
    setDocuments((prev) =>
      prev.map((d) =>
        d.id === activeDocId
          ? { ...d, collaborators: [...d.collaborators, collab] }
          : d
      )
    );
  };

  const removeCollaborator = (collabId: string) => {
    if (!activeDocId) return;
    setDocuments((prev) =>
      prev.map((d) =>
        d.id === activeDocId
          ? { ...d, collaborators: d.collaborators.filter((c) => c.id !== collabId) }
          : d
      )
    );
  };

  const addComment = (text: string) => {
    if (!activeDocId) return;
    const comment: Comment = {
      id: generateId(),
      author: 'You',
      text,
      timestamp: new Date().toISOString(),
      resolved: false,
    };
    setDocuments((prev) =>
      prev.map((d) =>
        d.id === activeDocId
          ? { ...d, comments: [...d.comments, comment] }
          : d
      )
    );
  };

  const resolveComment = (commentId: string) => {
    if (!activeDocId) return;
    setDocuments((prev) =>
      prev.map((d) =>
        d.id === activeDocId
          ? {
              ...d,
              comments: d.comments.map((c) =>
                c.id === commentId ? { ...c, resolved: true } : c
              ),
            }
          : d
      )
    );
  };

  // Filter documents
  const filteredDocs = documents.filter((d) =>
    d.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // ──────────────────────────────────────────────
  // Document List View
  // ──────────────────────────────────────────────

  if (!activeDoc) {
    return (
      <div className="flex flex-col h-full bg-bg-primary text-text-primary">
        {/* Header */}
        <header className="px-6 pt-6 pb-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Documents</h1>
          <button
            onClick={createDocument}
            className="flex items-center gap-2 px-4 py-2 bg-accent-blue text-white rounded-lg text-sm font-medium hover:bg-accent-blue/90 transition-colors"
          >
            <Plus size={16} />
            New Document
          </button>
        </header>

        {/* Search */}
        <div className="px-6 pb-4">
          <div className="flex items-center gap-2 bg-bg-secondary border border-border-primary rounded-lg px-3 py-2">
            <Search size={16} className="text-text-secondary" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search documents..."
              className="flex-1 bg-transparent text-sm text-text-primary placeholder-text-secondary outline-none"
            />
          </div>
        </div>

        {/* Document grid */}
        <div className="flex-1 overflow-y-auto px-6 pb-6">
          {filteredDocs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-text-secondary">
              <FileText size={48} className="mb-3 opacity-30" />
              <p className="text-sm">
                {documents.length === 0
                  ? 'No documents yet. Create one to get started.'
                  : 'No documents match your search.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredDocs.map((doc) => (
                <DocumentCard
                  key={doc.id}
                  doc={doc}
                  onOpen={() => setActiveDocId(doc.id)}
                  onDelete={() => deleteDocument(doc.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ──────────────────────────────────────────────
  // Editor View
  // ──────────────────────────────────────────────

  return (
    <div className="flex h-full bg-bg-primary text-text-primary">
      <div className="flex-1 flex flex-col min-w-0">
        {/* Editor header */}
        <header className="flex items-center justify-between px-4 py-3 border-b border-border-primary bg-bg-secondary">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setActiveDocId(null);
                setSidePanel('none');
              }}
              className="text-text-secondary hover:text-text-primary transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            <input
              value={activeDoc.title}
              onChange={(e) => updateDocTitle(e.target.value)}
              className="text-lg font-semibold bg-transparent text-text-primary outline-none border-none min-w-0"
              placeholder="Untitled Document"
            />
          </div>
          <div className="flex items-center gap-2">
            {/* Save status */}
            <span
              className={cn(
                'text-xs px-2 py-1 rounded',
                saveStatus === 'saved' && 'text-green-400',
                saveStatus === 'saving' && 'text-yellow-400',
                saveStatus === 'unsaved' && 'text-text-secondary'
              )}
            >
              {saveStatus === 'saved' && 'Saved'}
              {saveStatus === 'saving' && 'Saving...'}
              {saveStatus === 'unsaved' && 'Unsaved'}
            </span>

            {/* Save version */}
            <button
              onClick={saveVersion}
              className="p-2 text-text-secondary hover:text-text-primary hover:bg-bg-primary rounded transition-colors"
              title="Save version"
            >
              <Save size={16} />
            </button>

            {/* Version history */}
            <button
              onClick={() =>
                setSidePanel(sidePanel === 'versions' ? 'none' : 'versions')
              }
              className={cn(
                'p-2 rounded transition-colors',
                sidePanel === 'versions'
                  ? 'text-accent-blue bg-accent-blue/10'
                  : 'text-text-secondary hover:text-text-primary hover:bg-bg-primary'
              )}
              title="Version history"
            >
              <Clock size={16} />
            </button>

            {/* Collaborators */}
            <button
              onClick={() =>
                setSidePanel(sidePanel === 'collaborators' ? 'none' : 'collaborators')
              }
              className={cn(
                'p-2 rounded transition-colors',
                sidePanel === 'collaborators'
                  ? 'text-accent-blue bg-accent-blue/10'
                  : 'text-text-secondary hover:text-text-primary hover:bg-bg-primary'
              )}
              title="Collaborators"
            >
              <Users size={16} />
            </button>

            {/* Comments */}
            <button
              onClick={() =>
                setSidePanel(sidePanel === 'comments' ? 'none' : 'comments')
              }
              className={cn(
                'p-2 rounded transition-colors relative',
                sidePanel === 'comments'
                  ? 'text-accent-blue bg-accent-blue/10'
                  : 'text-text-secondary hover:text-text-primary hover:bg-bg-primary'
              )}
              title="Comments"
            >
              <MessageSquare size={16} />
              {activeDoc.comments.filter((c) => !c.resolved).length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-accent-blue text-white text-[10px] rounded-full flex items-center justify-center">
                  {activeDoc.comments.filter((c) => !c.resolved).length}
                </span>
              )}
            </button>
          </div>
        </header>

        {/* Toolbar */}
        <EditorToolbar editorRef={editorRef} fontSize={fontSize} onFontSizeChange={setFontSize} />

        {/* Editor area */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto px-8 py-6">
            <div
              ref={editorRef}
              contentEditable
              suppressContentEditableWarning
              onInput={(e) => {
                const content = (e.target as HTMLDivElement).innerHTML;
                triggerAutoSave(activeDoc.id, content);
              }}
              dangerouslySetInnerHTML={{ __html: activeDoc.content }}
              className="min-h-[60vh] outline-none text-text-primary prose prose-invert max-w-none"
              style={{ fontSize: `${fontSize}px` }}
            />
          </div>
        </div>

        {/* Status bar */}
        <footer className="flex items-center justify-between px-4 py-2 border-t border-border-primary bg-bg-secondary text-xs text-text-secondary">
          <span>{activeDoc.wordCount} words</span>
          <span>Last edited {timeAgo(activeDoc.updatedAt)}</span>
        </footer>
      </div>

      {/* Side panels */}
      {sidePanel === 'versions' && (
        <VersionHistoryPanel
          versions={activeDoc.versions}
          onRestore={restoreVersion}
          onClose={() => setSidePanel('none')}
        />
      )}
      {sidePanel === 'collaborators' && (
        <CollaboratorsPanel
          collaborators={activeDoc.collaborators}
          onAdd={addCollaborator}
          onRemove={removeCollaborator}
          onClose={() => setSidePanel('none')}
        />
      )}
      {sidePanel === 'comments' && (
        <CommentsPanel
          comments={activeDoc.comments}
          onAdd={addComment}
          onResolve={resolveComment}
          onClose={() => setSidePanel('none')}
        />
      )}
    </div>
  );
}
