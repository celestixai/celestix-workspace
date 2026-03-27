import { useState, useMemo, useCallback } from 'react';
import { Zap, Plus, Search, Filter } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useAutomations,
  useCreateAutomation,
  useUpdateAutomation,
  useToggleAutomation,
  useDeleteAutomation,
} from '@/hooks/useAutomations';
import type {
  Automation, AutomationTemplate,
  CreateAutomationPayload, UpdateAutomationPayload,
} from '@/hooks/useAutomations';
import { AutomationCard } from './AutomationCard';
import { AutomationBuilder } from './AutomationBuilder';
import { AutomationLogs } from './AutomationLogs';
import { AutomationTemplates } from './AutomationTemplates';

type FilterMode = 'all' | 'active' | 'inactive';

// Default workspace/location values — in a real app these would come from context
const DEFAULT_WORKSPACE_ID = 'default';
const DEFAULT_LOCATION_TYPE = 'WORKSPACE';
const DEFAULT_LOCATION_ID = 'default';

export function AutomationsPage() {
  // Data
  const { data: automations, isLoading } = useAutomations(DEFAULT_WORKSPACE_ID);
  const createMutation = useCreateAutomation();
  const [editingId, setEditingId] = useState<string | undefined>();
  const updateMutation = useUpdateAutomation(editingId);
  const [togglingId, setTogglingId] = useState<string | undefined>();
  const toggleMutation = useToggleAutomation(togglingId);
  const [deletingId, setDeletingId] = useState<string | undefined>();
  const deleteMutation = useDeleteAutomation(deletingId);

  // UI state
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingAutomation, setEditingAutomation] = useState<Automation | null>(null);
  const [logsAutomationId, setLogsAutomationId] = useState<string | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);

  // Filtered list
  const filtered = useMemo(() => {
    let list = automations ?? [];
    if (filterMode === 'active') list = list.filter((a) => a.isActive);
    if (filterMode === 'inactive') list = list.filter((a) => !a.isActive);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((a) => a.name.toLowerCase().includes(q));
    }
    return list;
  }, [automations, filterMode, searchQuery]);

  // Handlers
  const handleEdit = useCallback((automation: Automation) => {
    setEditingAutomation(automation);
    setEditingId(automation.id);
    setShowBuilder(true);
  }, []);

  const handleToggle = useCallback((automationId: string) => {
    setTogglingId(automationId);
    toggleMutation.mutate(undefined);
  }, [toggleMutation]);

  const handleDelete = useCallback((automationId: string) => {
    setDeletingId(automationId);
    deleteMutation.mutate(undefined);
  }, [deleteMutation]);

  const handleSave = useCallback(
    (payload: CreateAutomationPayload | UpdateAutomationPayload) => {
      if (editingAutomation) {
        updateMutation.mutate(payload as UpdateAutomationPayload, {
          onSuccess: () => {
            setShowBuilder(false);
            setEditingAutomation(null);
            setEditingId(undefined);
          },
        });
      } else {
        createMutation.mutate(payload as CreateAutomationPayload, {
          onSuccess: () => {
            setShowBuilder(false);
          },
        });
      }
    },
    [editingAutomation, createMutation, updateMutation]
  );

  const handleUseTemplate = useCallback((template: AutomationTemplate) => {
    setEditingAutomation({
      id: '',
      name: template.name,
      workspaceId: DEFAULT_WORKSPACE_ID,
      locationType: DEFAULT_LOCATION_TYPE,
      locationId: DEFAULT_LOCATION_ID,
      trigger: template.trigger,
      conditions: template.conditions,
      conditionLogic: template.conditionLogic,
      actions: template.actions,
      isActive: true,
      executionCount: 0,
      createdById: '',
      createdAt: '',
      updatedAt: '',
    } as Automation);
    setShowTemplates(false);
    setShowBuilder(true);
  }, []);

  const handleCloseBuilder = useCallback(() => {
    setShowBuilder(false);
    setEditingAutomation(null);
    setEditingId(undefined);
  }, []);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border-primary">
        <div className="flex items-center gap-3">
          <Zap size={20} className="text-accent-blue" />
          <h1 className="text-lg font-semibold text-text-primary">Automations</h1>
          {automations && (
            <span className="text-xs text-text-tertiary bg-bg-tertiary px-2 py-0.5 rounded-full">
              {automations.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowTemplates(true)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-text-secondary bg-bg-tertiary hover:bg-bg-hover transition-colors"
          >
            Templates
          </button>
          <button
            onClick={() => { setEditingAutomation(null); setEditingId(undefined); setShowBuilder(true); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-accent-blue text-white hover:bg-accent-blue/90 transition-colors"
          >
            <Plus size={14} />
            Create Automation
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-border-primary">
        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-tertiary" />
          <input
            type="text"
            placeholder="Search automations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-8 pl-8 pr-3 rounded-lg bg-bg-tertiary border border-border-primary text-text-primary text-xs placeholder:text-text-tertiary focus:outline-none focus:border-accent-blue"
          />
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-1 bg-bg-tertiary rounded-lg p-0.5">
          {(['all', 'active', 'inactive'] as FilterMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setFilterMode(mode)}
              className={cn(
                'px-3 py-1 rounded-md text-xs font-medium capitalize transition-colors',
                filterMode === mode
                  ? 'bg-bg-secondary text-text-primary shadow-sm'
                  : 'text-text-tertiary hover:text-text-secondary'
              )}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-8 h-8 border-2 border-accent-blue/30 border-t-accent-blue rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-60 text-text-tertiary">
            <Zap size={40} className="mb-3 opacity-30" />
            <p className="text-sm font-medium text-text-secondary">No automations yet</p>
            <p className="text-xs mt-1">Create one from scratch or start with a template.</p>
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setShowTemplates(true)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-text-secondary bg-bg-tertiary hover:bg-bg-hover transition-colors"
              >
                Browse Templates
              </button>
              <button
                onClick={() => { setEditingAutomation(null); setShowBuilder(true); }}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-accent-blue text-white hover:bg-accent-blue/90 transition-colors"
              >
                Create Automation
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((automation) => (
              <AutomationCard
                key={automation.id}
                automation={automation}
                onEdit={handleEdit}
                onToggle={handleToggle}
                onDelete={handleDelete}
                onViewLogs={setLogsAutomationId}
              />
            ))}
          </div>
        )}
      </div>

      {/* Builder modal */}
      {showBuilder && (
        <AutomationBuilder
          automation={editingAutomation}
          workspaceId={DEFAULT_WORKSPACE_ID}
          locationType={DEFAULT_LOCATION_TYPE}
          locationId={DEFAULT_LOCATION_ID}
          onSave={handleSave}
          onClose={handleCloseBuilder}
          isSaving={createMutation.isPending || updateMutation.isPending}
        />
      )}

      {/* Logs modal */}
      {logsAutomationId && (
        <AutomationLogs
          automationId={logsAutomationId}
          onClose={() => setLogsAutomationId(null)}
        />
      )}

      {/* Templates modal */}
      {showTemplates && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-2xl max-h-[80vh] bg-bg-secondary rounded-2xl border border-border-primary shadow-2xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border-primary">
              <h2 className="text-lg font-semibold text-text-primary">Automation Templates</h2>
              <button
                onClick={() => setShowTemplates(false)}
                className="p-2 rounded-lg hover:bg-bg-hover text-text-tertiary"
              >
                &times;
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <AutomationTemplates onUseTemplate={handleUseTemplate} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
