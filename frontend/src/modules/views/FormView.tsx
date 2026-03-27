import { useState, useMemo, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useCustomFieldsAtLocation } from '@/hooks/useCustomFields';
import {
  FileText,
  Eye,
  Pencil,
  ToggleLeft,
  ToggleRight,
  Share2,
  Plus,
  Loader2,
  CheckCircle2,
  ClipboardList,
  Calendar,
  Flag,
  User,
  AlignLeft,
  Type,
} from 'lucide-react';

// -----------------------------------------------
// Types
// -----------------------------------------------

interface FormViewProps {
  listId?: string;
  spaceId?: string;
  onTaskClick?: (taskId: string) => void;
}

interface FormField {
  key: string;
  label: string;
  icon: React.ReactNode;
  enabled: boolean;
  required: boolean;
  type: 'text' | 'textarea' | 'select' | 'date' | 'custom';
  options?: string[];
}

type FormTab = 'build' | 'submissions';

// -----------------------------------------------
// Constants
// -----------------------------------------------

const PRIORITY_OPTIONS = ['URGENT', 'HIGH', 'MEDIUM', 'LOW', 'NONE'];

const DEFAULT_FIELDS: FormField[] = [
  { key: 'title', label: 'Title', icon: <Type size={14} />, enabled: true, required: true, type: 'text' },
  { key: 'description', label: 'Description', icon: <AlignLeft size={14} />, enabled: true, required: false, type: 'textarea' },
  { key: 'priority', label: 'Priority', icon: <Flag size={14} />, enabled: true, required: false, type: 'select', options: PRIORITY_OPTIONS },
  { key: 'dueDate', label: 'Due Date', icon: <Calendar size={14} />, enabled: false, required: false, type: 'date' },
  { key: 'assignee', label: 'Assignee', icon: <User size={14} />, enabled: false, required: false, type: 'text' },
];

// -----------------------------------------------
// Component
// -----------------------------------------------

export function FormView({ listId, spaceId, onTaskClick }: FormViewProps) {
  const [activeTab, setActiveTab] = useState<FormTab>('build');
  const [formTitle, setFormTitle] = useState('Submit a Task');
  const [formDescription, setFormDescription] = useState('');
  const [fields, setFields] = useState<FormField[]>(DEFAULT_FIELDS);
  const [showShareToast, setShowShareToast] = useState(false);

  // Form submission state
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [isPreview, setIsPreview] = useState(false);
  const [submissions, setSubmissions] = useState<Array<{ id: string; title: string; status: string; createdAt: string }>>([]);

  // Custom fields
  const locationType = listId ? 'LIST' : spaceId ? 'SPACE' : undefined;
  const locationId = listId || spaceId;
  const { data: customFields } = useCustomFieldsAtLocation(locationType as any, locationId);

  // Build custom field entries
  const customFieldEntries: FormField[] = useMemo(() => {
    if (!customFields) return [];
    return customFields.map((cf: any) => ({
      key: `cf_${cf.id}`,
      label: cf.name,
      icon: <ClipboardList size={14} />,
      enabled: false,
      required: false,
      type: 'text' as const,
    }));
  }, [customFields]);

  const allFields = useMemo(() => {
    // Merge custom fields that aren't already in the fields list
    const existingKeys = new Set(fields.map(f => f.key));
    const newCustom = customFieldEntries.filter(cf => !existingKeys.has(cf.key));
    return [...fields, ...newCustom];
  }, [fields, customFieldEntries]);

  const toggleField = useCallback((key: string) => {
    setFields(prev => {
      const existing = prev.find(f => f.key === key);
      if (existing) {
        if (existing.required) return prev; // can't disable required
        return prev.map(f => f.key === key ? { ...f, enabled: !f.enabled } : f);
      }
      // Might be a custom field, add it as enabled
      const cf = customFieldEntries.find(c => c.key === key);
      if (cf) return [...prev, { ...cf, enabled: true }];
      return prev;
    });
  }, [customFieldEntries]);

  const queryClient = useQueryClient();

  // Create task mutation
  const createTask = useMutation({
    mutationFn: async (values: Record<string, string>) => {
      const body: any = {
        title: values.title,
        description: values.description,
        priority: values.priority || 'NONE',
        listId,
      };
      if (values.dueDate) body.dueDate = values.dueDate;
      const { data } = await api.post('/tasks', body);
      return data.data;
    },
    onSuccess: (data) => {
      setSubmissions(prev => [
        { id: data.id, title: data.title, status: data.statusName ?? data.status ?? 'To Do', createdAt: new Date().toISOString() },
        ...prev,
      ]);
      setFormValues({});
      queryClient.invalidateQueries({ queryKey: ['view-query'] });
    },
  });

  const handleSubmit = useCallback(() => {
    if (!formValues.title?.trim()) return;
    createTask.mutate(formValues);
  }, [formValues, createTask]);

  const handleShare = useCallback(() => {
    // Placeholder: copy a "share" URL
    const shareUrl = `${window.location.origin}/form/${listId ?? 'draft'}`;
    navigator.clipboard.writeText(shareUrl).catch(() => {});
    setShowShareToast(true);
    setTimeout(() => setShowShareToast(false), 2000);
  }, [listId]);

  const enabledFields = allFields.filter(f => f.enabled);

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* Tab bar */}
      <div className="flex items-center gap-1 px-4 py-2 border-b border-border bg-bg-secondary/50">
        <button
          onClick={() => { setActiveTab('build'); setIsPreview(false); }}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors',
            activeTab === 'build'
              ? 'bg-brand-primary/10 text-brand-primary'
              : 'text-text-tertiary hover:text-text-secondary hover:bg-bg-secondary',
          )}
        >
          <Pencil size={12} />
          Build Form
        </button>
        <button
          onClick={() => setActiveTab('submissions')}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors',
            activeTab === 'submissions'
              ? 'bg-brand-primary/10 text-brand-primary'
              : 'text-text-tertiary hover:text-text-secondary hover:bg-bg-secondary',
          )}
        >
          <Eye size={12} />
          Submissions ({submissions.length})
        </button>

        <div className="ml-auto flex items-center gap-2">
          {activeTab === 'build' && (
            <>
              <button
                onClick={() => setIsPreview(p => !p)}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1 text-xs rounded border transition-colors',
                  isPreview
                    ? 'border-brand-primary bg-brand-primary/10 text-brand-primary'
                    : 'border-border bg-bg-primary hover:bg-bg-secondary text-text-secondary',
                )}
              >
                <Eye size={12} />
                {isPreview ? 'Editing' : 'Preview'}
              </button>
              <button
                onClick={handleShare}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded border border-border bg-bg-primary hover:bg-bg-secondary transition-colors relative"
              >
                <Share2 size={12} />
                Share
                {showShareToast && (
                  <span className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 text-[10px] bg-green-600 text-white rounded shadow whitespace-nowrap">
                    Link copied!
                  </span>
                )}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeTab === 'build' ? (
          isPreview ? (
            /* ---- Form Preview / Submission ---- */
            <div className="max-w-lg mx-auto py-8 px-4">
              <div className="border border-border rounded-lg bg-bg-primary p-6">
                <h2 className="text-lg font-semibold text-text-primary">{formTitle || 'Untitled Form'}</h2>
                {formDescription && (
                  <p className="text-sm text-text-secondary mt-1">{formDescription}</p>
                )}

                <div className="mt-6 space-y-4">
                  {enabledFields.map(field => (
                    <div key={field.key}>
                      <label className="flex items-center gap-1.5 text-xs font-medium text-text-secondary mb-1">
                        {field.icon}
                        {field.label}
                        {field.required && <span className="text-red-500">*</span>}
                      </label>
                      {field.type === 'textarea' ? (
                        <textarea
                          value={formValues[field.key] ?? ''}
                          onChange={e => setFormValues(prev => ({ ...prev, [field.key]: e.target.value }))}
                          rows={3}
                          className="w-full px-3 py-2 text-sm rounded-md border border-border bg-bg-primary text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-brand-primary/50 resize-none"
                          placeholder={`Enter ${field.label.toLowerCase()}...`}
                        />
                      ) : field.type === 'select' ? (
                        <select
                          value={formValues[field.key] ?? ''}
                          onChange={e => setFormValues(prev => ({ ...prev, [field.key]: e.target.value }))}
                          className="w-full px-3 py-2 text-sm rounded-md border border-border bg-bg-primary text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/50"
                        >
                          <option value="">Select {field.label.toLowerCase()}</option>
                          {field.options?.map(opt => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      ) : field.type === 'date' ? (
                        <input
                          type="date"
                          value={formValues[field.key] ?? ''}
                          onChange={e => setFormValues(prev => ({ ...prev, [field.key]: e.target.value }))}
                          className="w-full px-3 py-2 text-sm rounded-md border border-border bg-bg-primary text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/50"
                        />
                      ) : (
                        <input
                          type="text"
                          value={formValues[field.key] ?? ''}
                          onChange={e => setFormValues(prev => ({ ...prev, [field.key]: e.target.value }))}
                          className="w-full px-3 py-2 text-sm rounded-md border border-border bg-bg-primary text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-brand-primary/50"
                          placeholder={`Enter ${field.label.toLowerCase()}...`}
                        />
                      )}
                    </div>
                  ))}
                </div>

                <button
                  onClick={handleSubmit}
                  disabled={createTask.isPending || !formValues.title?.trim()}
                  className="mt-6 w-full py-2 text-sm font-medium rounded-md bg-brand-primary text-white hover:bg-brand-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {createTask.isPending ? (
                    <>
                      <Loader2 size={14} className="animate-spin" /> Submitting...
                    </>
                  ) : createTask.isSuccess ? (
                    <>
                      <CheckCircle2 size={14} /> Submitted! Submit another
                    </>
                  ) : (
                    <>
                      <Plus size={14} /> Submit
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            /* ---- Form Builder ---- */
            <div className="max-w-lg mx-auto py-8 px-4">
              <div className="space-y-6">
                {/* Form title */}
                <div>
                  <label className="text-xs font-medium text-text-secondary mb-1 block">Form Title</label>
                  <input
                    type="text"
                    value={formTitle}
                    onChange={e => setFormTitle(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-md border border-border bg-bg-primary text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-brand-primary/50"
                    placeholder="Enter form title..."
                  />
                </div>

                {/* Form description */}
                <div>
                  <label className="text-xs font-medium text-text-secondary mb-1 block">Description</label>
                  <textarea
                    value={formDescription}
                    onChange={e => setFormDescription(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 text-sm rounded-md border border-border bg-bg-primary text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-brand-primary/50 resize-none"
                    placeholder="Describe what this form is for..."
                  />
                </div>

                {/* Fields */}
                <div>
                  <label className="text-xs font-medium text-text-secondary mb-2 block">Form Fields</label>
                  <div className="space-y-1">
                    {allFields.map(field => (
                      <div
                        key={field.key}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-md border border-border bg-bg-primary"
                      >
                        <span className="text-text-tertiary">{field.icon}</span>
                        <span className="text-sm text-text-primary flex-1">{field.label}</span>
                        {field.required && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-500 font-medium">
                            Required
                          </span>
                        )}
                        <button
                          onClick={() => toggleField(field.key)}
                          disabled={field.required}
                          className={cn(
                            'transition-colors',
                            field.required && 'opacity-40 cursor-not-allowed',
                          )}
                        >
                          {field.enabled ? (
                            <ToggleRight size={20} className="text-brand-primary" />
                          ) : (
                            <ToggleLeft size={20} className="text-text-tertiary" />
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {customFieldEntries.length > 0 && (
                  <p className="text-[11px] text-text-tertiary">
                    Custom fields from this location are shown above. Toggle them on to include in the form.
                  </p>
                )}
              </div>
            </div>
          )
        ) : (
          /* ---- Submissions tab ---- */
          <div className="max-w-2xl mx-auto py-6 px-4">
            {submissions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-text-tertiary">
                <FileText size={32} className="mb-2 opacity-30" />
                <p className="text-sm font-medium">No submissions yet</p>
                <p className="text-xs opacity-70 mt-1">Tasks created via this form will appear here</p>
              </div>
            ) : (
              <div className="space-y-1">
                <div className="grid grid-cols-[1fr_100px_140px] gap-2 px-3 py-2 text-[11px] font-medium text-text-tertiary uppercase tracking-wider">
                  <span>Title</span>
                  <span>Status</span>
                  <span>Created</span>
                </div>
                {submissions.map(sub => (
                  <button
                    key={sub.id}
                    onClick={() => onTaskClick?.(sub.id)}
                    className="w-full grid grid-cols-[1fr_100px_140px] gap-2 px-3 py-2.5 rounded-md hover:bg-bg-secondary/50 transition-colors text-left"
                  >
                    <span className="text-sm text-text-primary truncate">{sub.title}</span>
                    <span className="text-xs text-text-secondary">{sub.status}</span>
                    <span className="text-xs text-text-tertiary">
                      {new Date(sub.createdAt).toLocaleDateString()}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
