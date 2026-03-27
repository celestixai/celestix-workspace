import { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  ChevronRight,
  ChevronDown,
  FileText,
  Plus,
} from 'lucide-react';
import {
  useSubPages,
  useCreateSubPage,
  type DocSubPage,
} from '@/hooks/useDocs';

// ==========================================
// Tree Node
// ==========================================

function TreeNode({
  page,
  level,
  onOpen,
  onCreateChild,
}: {
  page: DocSubPage;
  level: number;
  onOpen: (docId: string) => void;
  onCreateChild: (parentId: string) => void;
}) {
  const [expanded, setExpanded] = useState(level < 2);
  const hasChildren = page.subPages && page.subPages.length > 0;

  return (
    <div>
      <div
        className={cn(
          'flex items-center gap-1 py-1.5 px-2 rounded-md cursor-pointer group hover:bg-bg-primary/50 transition-colors',
        )}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
      >
        {/* Expand/collapse toggle */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(!expanded);
          }}
          className={cn(
            'w-5 h-5 flex items-center justify-center rounded text-text-secondary hover:text-text-primary transition-colors',
            !hasChildren && 'invisible'
          )}
        >
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>

        {/* Icon + title */}
        <div
          className="flex-1 flex items-center gap-1.5 min-w-0"
          onClick={() => onOpen(page.id)}
        >
          {page.icon ? (
            <span className="text-sm">{page.icon}</span>
          ) : (
            <FileText size={14} className="text-text-secondary flex-shrink-0" />
          )}
          <span className="text-sm text-text-primary truncate">
            {page.title || 'Untitled'}
          </span>
        </div>

        {/* Add sub-page button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onCreateChild(page.id);
          }}
          className="w-5 h-5 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 text-text-secondary hover:text-accent-blue transition-all"
          title="Add sub-page"
        >
          <Plus size={12} />
        </button>
      </div>

      {/* Children */}
      {expanded && hasChildren && (
        <div>
          {page.subPages!.map((child) => (
            <TreeNode
              key={child.id}
              page={child}
              level={level + 1}
              onOpen={onOpen}
              onCreateChild={onCreateChild}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ==========================================
// DocSubPageTree
// ==========================================

export function DocSubPageTree({
  docId,
  docTitle,
  onOpen,
}: {
  docId: string;
  docTitle: string;
  onOpen: (docId: string) => void;
}) {
  const { data: subPages = [], isLoading } = useSubPages(docId);
  const createSubPage = useCreateSubPage();

  const handleCreateChild = (parentId: string) => {
    createSubPage.mutate({
      parentDocId: parentId,
      data: { title: 'Untitled Sub-page' },
    });
  };

  return (
    <aside className="w-64 bg-bg-secondary border-r border-border-primary flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border-primary">
        <h3 className="text-sm font-semibold text-text-primary truncate">{docTitle}</h3>
        <p className="text-xs text-text-secondary mt-0.5">Pages</p>
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-y-auto py-2">
        {isLoading ? (
          <div className="flex items-center justify-center h-20">
            <div className="w-4 h-4 border-2 border-accent-blue/30 border-t-accent-blue rounded-full animate-spin" />
          </div>
        ) : subPages.length === 0 ? (
          <p className="text-xs text-text-secondary text-center py-6 px-4">
            No sub-pages yet.
          </p>
        ) : (
          subPages.map((page) => (
            <TreeNode
              key={page.id}
              page={page}
              level={0}
              onOpen={onOpen}
              onCreateChild={handleCreateChild}
            />
          ))
        )}
      </div>

      {/* Add sub-page button */}
      <div className="p-3 border-t border-border-primary">
        <button
          onClick={() => handleCreateChild(docId)}
          disabled={createSubPage.isPending}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-sm text-text-secondary hover:text-accent-blue border border-dashed border-border-primary hover:border-accent-blue/50 rounded-lg transition-colors"
        >
          <Plus size={14} />
          Add Sub-page
        </button>
      </div>
    </aside>
  );
}
