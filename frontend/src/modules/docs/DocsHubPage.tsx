import { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  FileText,
  Plus,
  Search,
  BookOpen,
  User,
  Share2,
  Clock,
  Star,
  Globe,
  ChevronRight,
  MessageSquare,
  LayoutTemplate,
  X,
} from 'lucide-react';
import {
  useDocsHub,
  useToggleWiki,
  useDocTemplates,
  useCreateDocFromTemplate,
  type DocHubItem,
  type DocTemplate,
} from '@/hooks/useDocs';

// ==========================================
// Types
// ==========================================

type FilterKey = 'all' | 'wikis' | 'myDocs' | 'shared' | 'recent' | 'favorites';

interface FilterItem {
  key: FilterKey;
  label: string;
  icon: React.ReactNode;
}

const FILTERS: FilterItem[] = [
  { key: 'all', label: 'All Docs', icon: <FileText size={16} /> },
  { key: 'wikis', label: 'Wikis', icon: <BookOpen size={16} /> },
  { key: 'myDocs', label: 'My Docs', icon: <User size={16} /> },
  { key: 'shared', label: 'Shared', icon: <Share2 size={16} /> },
  { key: 'recent', label: 'Recent', icon: <Clock size={16} /> },
  { key: 'favorites', label: 'Favorites', icon: <Star size={16} /> },
];

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

// ==========================================
// Template Picker Modal
// ==========================================

function TemplatePicker({
  templates,
  onSelect,
  onClose,
}: {
  templates: DocTemplate[];
  onSelect: (templateId: string) => void;
  onClose: () => void;
}) {
  const categories = Array.from(new Set(templates.map((t) => t.category || 'General')));

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-bg-secondary border border-border-primary rounded-xl w-full max-w-lg max-h-[70vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-primary">
          <h3 className="text-base font-semibold text-text-primary">Choose a Template</h3>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {categories.map((cat) => (
            <div key={cat}>
              <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2">{cat}</h4>
              <div className="grid grid-cols-2 gap-2">
                {templates.filter((t) => (t.category || 'General') === cat).map((t) => (
                  <button
                    key={t.id}
                    onClick={() => onSelect(t.id)}
                    className="text-left p-3 bg-bg-primary border border-border-primary rounded-lg hover:border-accent-blue/50 transition-colors"
                  >
                    <p className="text-sm font-medium text-text-primary truncate">{t.name}</p>
                    {t.description && <p className="text-xs text-text-secondary mt-1 line-clamp-2">{t.description}</p>}
                  </button>
                ))}
              </div>
            </div>
          ))}
          {templates.length === 0 && (
            <p className="text-sm text-text-secondary text-center py-8">No templates yet. Save a doc as template to get started.</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ==========================================
// Doc Card
// ==========================================

function DocCard({ doc, onOpen }: { doc: DocHubItem; onOpen: () => void }) {
  return (
    <div
      onClick={onOpen}
      className="bg-bg-secondary border border-border-primary rounded-xl p-4 cursor-pointer hover:border-accent-blue/50 transition-colors group"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-lg bg-accent-blue/10 flex items-center justify-center">
          {doc.icon ? (
            <span className="text-lg">{doc.icon}</span>
          ) : doc.isWiki ? (
            <BookOpen size={20} className="text-purple-400" />
          ) : (
            <FileText size={20} className="text-accent-blue" />
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {doc.isWiki && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 font-medium">Wiki</span>
          )}
          {doc.isPublished && (
            <Globe size={14} className="text-cx-success" />
          )}
        </div>
      </div>
      <h3 className="text-sm font-medium text-text-primary truncate mb-1">
        {doc.title || 'Untitled'}
      </h3>
      <div className="flex items-center gap-3 text-xs text-text-secondary">
        <span>{doc.wordCount} words</span>
        <span>{timeAgo(doc.updatedAt)}</span>
        {doc._count.subPages > 0 && (
          <span className="flex items-center gap-0.5">
            <ChevronRight size={10} />
            {doc._count.subPages}
          </span>
        )}
        {doc._count.enhancedComments > 0 && (
          <span className="flex items-center gap-0.5">
            <MessageSquare size={10} />
            {doc._count.enhancedComments}
          </span>
        )}
      </div>
      <div className="mt-2 flex items-center gap-1">
        <div className="w-5 h-5 rounded-full bg-accent-blue/20 flex items-center justify-center text-[10px] font-bold text-accent-blue">
          {doc.user.displayName?.charAt(0)?.toUpperCase() || '?'}
        </div>
        <span className="text-xs text-text-secondary truncate">{doc.user.displayName}</span>
      </div>
    </div>
  );
}

// ==========================================
// DocsHubPage
// ==========================================

export function DocsHubPage() {
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');
  const [search, setSearch] = useState('');
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);

  // TODO: get workspaceId from workspace context/store
  const workspaceId = undefined;

  const { data: docs = [], isLoading } = useDocsHub(workspaceId, activeFilter, search || undefined);
  const { data: templates = [] } = useDocTemplates(workspaceId);
  const toggleWiki = useToggleWiki();
  const createFromTemplate = useCreateDocFromTemplate();

  const handleCreateFromTemplate = (templateId: string) => {
    createFromTemplate.mutate({ templateId });
    setShowTemplatePicker(false);
  };

  return (
    <div className="flex h-full bg-bg-primary text-text-primary">
      {/* Left sidebar filters */}
      <aside className="w-56 border-r border-border-primary bg-bg-secondary flex flex-col">
        <div className="px-4 py-5">
          <h2 className="text-lg font-bold text-text-primary">Docs</h2>
        </div>
        <nav className="flex-1 px-2 space-y-0.5">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setActiveFilter(f.key)}
              className={cn(
                'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors',
                activeFilter === f.key
                  ? 'bg-accent-blue/10 text-accent-blue font-medium'
                  : 'text-text-secondary hover:text-text-primary hover:bg-bg-primary'
              )}
            >
              {f.icon}
              {f.label}
            </button>
          ))}
        </nav>
        <div className="p-3 border-t border-border-primary">
          <button
            onClick={() => setShowTemplatePicker(true)}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-primary rounded-lg transition-colors"
          >
            <LayoutTemplate size={16} />
            Templates
          </button>
        </div>
      </aside>

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="px-6 pt-5 pb-4 flex items-center justify-between">
          <h1 className="text-xl font-display capitalize">
            {FILTERS.find((f) => f.key === activeFilter)?.label || 'All Docs'}
          </h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowTemplatePicker(true)}
              className="flex items-center gap-2 px-3 py-2 border border-border-primary text-text-secondary rounded-lg text-sm hover:text-text-primary hover:border-accent-blue/50 transition-colors"
            >
              <LayoutTemplate size={14} />
              From Template
            </button>
            <button
              onClick={() => {
                // Create blank doc via existing /documents endpoint
                window.dispatchEvent(new CustomEvent('celestix:create-doc'));
              }}
              className="flex items-center gap-2 px-4 py-2 bg-accent-blue text-white rounded-lg text-sm font-medium hover:bg-accent-blue/90 transition-colors"
            >
              <Plus size={16} />
              New Doc
            </button>
          </div>
        </header>

        {/* Search bar */}
        <div className="px-6 pb-4">
          <div className="flex items-center gap-2 bg-bg-secondary border border-border-primary rounded-lg px-3 py-2">
            <Search size={16} className="text-text-secondary" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search docs..."
              className="flex-1 bg-transparent text-sm text-text-primary placeholder-text-secondary outline-none"
            />
          </div>
        </div>

        {/* Document grid */}
        <div className="flex-1 overflow-y-auto px-6 pb-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="w-6 h-6 border-2 border-accent-blue/30 border-t-accent-blue rounded-full animate-spin" />
            </div>
          ) : docs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-text-secondary">
              <FileText size={48} className="mb-3 opacity-30" />
              <p className="text-sm">
                {search ? 'No docs match your search.' : 'No documents yet. Create one to get started.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {docs.map((doc) => (
                <DocCard
                  key={doc.id}
                  doc={doc}
                  onOpen={() => {
                    // Navigate to doc editor - dispatch event for router or parent to handle
                    window.dispatchEvent(new CustomEvent('celestix:open-doc', { detail: { docId: doc.id } }));
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Template picker modal */}
      {showTemplatePicker && (
        <TemplatePicker
          templates={templates}
          onSelect={handleCreateFromTemplate}
          onClose={() => setShowTemplatePicker(false)}
        />
      )}
    </div>
  );
}
