import { useState, useMemo } from 'react';
import { Plus, Search, Pin, LayoutTemplate, List, Folder, Globe, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  useTemplates,
  useDeleteTemplate,
  useToggleTemplatePin,
  type TaskTemplate,
  type TemplateType,
  type TemplateFilters,
} from '@/hooks/useTemplates';
import { ApplyTemplateModal } from './ApplyTemplateModal';

// ==========================================
// Helpers
// ==========================================

const TYPE_LABELS: Record<TemplateType, string> = {
  TASK: 'Task',
  LIST: 'List',
  FOLDER: 'Folder',
  SPACE: 'Space',
};

const TYPE_ICONS: Record<TemplateType, typeof LayoutTemplate> = {
  TASK: LayoutTemplate,
  LIST: List,
  FOLDER: Folder,
  SPACE: Globe,
};

// ==========================================
// Component
// ==========================================

interface TemplateLibraryProps {
  workspaceId: string;
  onCreateTemplate?: () => void;
}

export function TemplateLibrary({ workspaceId, onCreateTemplate }: TemplateLibraryProps) {
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<TemplateType | ''>('');
  const [applyingTemplateId, setApplyingTemplateId] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<TaskTemplate | null>(null);

  const filters: TemplateFilters = useMemo(() => ({
    search: search || undefined,
    type: filterType || undefined,
  }), [search, filterType]);

  const { data: templates, isLoading } = useTemplates(workspaceId, filters);
  const deleteTemplate = useDeleteTemplate();
  const togglePin = useToggleTemplatePin();

  const handleDelete = (templateId: string) => {
    if (window.confirm('Are you sure you want to delete this template?')) {
      deleteTemplate.mutate(templateId);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-[var(--cx-text-1)]">Template Library</h2>
        {onCreateTemplate && (
          <Button size="sm" onClick={onCreateTemplate}>
            <Plus className="w-4 h-4 mr-1" />
            Create Template
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--cx-text-2)]" />
          <Input
            placeholder="Search templates..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as TemplateType | '')}
          className="h-9 rounded-md border border-[var(--cx-border-1)] bg-cx-surface px-3 text-sm text-[var(--cx-text-1)] focus:outline-none focus:ring-1 focus:ring-cx-brand"
        >
          <option value="">All Types</option>
          <option value="TASK">Task</option>
          <option value="LIST">List</option>
          <option value="FOLDER">Folder</option>
          <option value="SPACE">Space</option>
        </select>
      </div>

      {/* Templates Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-[var(--cx-text-2)]">Loading templates...</div>
      ) : !templates || templates.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-[var(--cx-text-2)]">
          <LayoutTemplate className="w-12 h-12 mb-3 opacity-40" />
          <p className="text-sm">No templates found</p>
          <p className="text-xs text-[var(--cx-text-3)] mt-1">Create one from a task or list to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 overflow-y-auto">
          {templates.map((template) => {
            const Icon = TYPE_ICONS[template.templateType] ?? LayoutTemplate;
            return (
              <div
                key={template.id}
                className="relative group border border-[var(--cx-border-1)] rounded-lg p-4 bg-cx-surface/50 hover:bg-cx-surface transition-colors cursor-pointer"
                onClick={() => setSelectedTemplate(template)}
              >
                {/* Pin indicator */}
                {template.isPinned && (
                  <Pin className="absolute top-2 right-2 w-3.5 h-3.5 text-cx-warning fill-yellow-400" />
                )}

                {/* Type badge */}
                <div className="flex items-center gap-2 mb-2">
                  <Icon className="w-4 h-4 text-cx-brand" />
                  <span className="text-xs px-1.5 py-0.5 rounded bg-cx-raised text-[var(--cx-text-1)]">
                    {TYPE_LABELS[template.templateType] ?? template.templateType}
                  </span>
                </div>

                {/* Name & Description */}
                <h3 className="text-sm font-medium text-[var(--cx-text-1)] truncate">{template.name}</h3>
                {template.description && (
                  <p className="text-xs text-[var(--cx-text-2)] mt-1 line-clamp-2">{template.description}</p>
                )}

                {/* Tags */}
                {template.tags && Array.isArray(template.tags) && template.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {(template.tags as string[]).slice(0, 3).map((tag) => (
                      <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-cx-raised/60 text-[var(--cx-text-2)]">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between mt-3 pt-2 border-t border-[var(--cx-border-1)]/50">
                  <span className="text-[10px] text-[var(--cx-text-3)]">
                    Used {template.usageCount} time{template.usageCount !== 1 ? 's' : ''}
                  </span>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => { e.stopPropagation(); togglePin.mutate(template.id); }}
                      className="p-1 rounded hover:bg-cx-highest"
                      title={template.isPinned ? 'Unpin' : 'Pin'}
                    >
                      <Pin className={`w-3.5 h-3.5 ${template.isPinned ? 'text-cx-warning' : 'text-[var(--cx-text-2)]'}`} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setApplyingTemplateId(template.id); }}
                      className="px-2 py-0.5 text-[10px] font-medium rounded bg-cx-brand hover:bg-[var(--cx-brand-hover)] text-[var(--cx-text-1)]"
                    >
                      Use
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(template.id); }}
                      className="p-1 rounded hover:bg-red-600/20"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-[var(--cx-text-2)] hover:text-cx-danger" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Preview panel for selected template */}
      {selectedTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setSelectedTemplate(null)}>
          <div className="bg-cx-bg border border-[var(--cx-border-1)] rounded-xl p-6 max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-[var(--cx-text-1)]">{selectedTemplate.name}</h3>
              <button onClick={() => setSelectedTemplate(null)} className="text-[var(--cx-text-2)] hover:text-[var(--cx-text-1)]">
                &times;
              </button>
            </div>
            {selectedTemplate.description && (
              <p className="text-sm text-[var(--cx-text-2)] mb-4">{selectedTemplate.description}</p>
            )}
            <div className="text-xs text-[var(--cx-text-3)] mb-2">
              Type: {TYPE_LABELS[selectedTemplate.templateType]} | Used {selectedTemplate.usageCount} times
              {selectedTemplate.createdBy && ` | By ${selectedTemplate.createdBy.displayName}`}
            </div>
            <div className="bg-cx-surface rounded-lg p-3 mb-4">
              <h4 className="text-xs font-medium text-[var(--cx-text-1)] mb-2">Template Data Preview</h4>
              <pre className="text-xs text-[var(--cx-text-2)] whitespace-pre-wrap break-words max-h-60 overflow-y-auto">
                {JSON.stringify(selectedTemplate.templateData, null, 2)}
              </pre>
            </div>
            <Button
              className="w-full"
              onClick={() => {
                setApplyingTemplateId(selectedTemplate.id);
                setSelectedTemplate(null);
              }}
            >
              Use Template
            </Button>
          </div>
        </div>
      )}

      {/* Apply modal */}
      {applyingTemplateId && (
        <ApplyTemplateModal
          templateId={applyingTemplateId}
          onClose={() => setApplyingTemplateId(null)}
        />
      )}
    </div>
  );
}
