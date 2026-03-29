import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { cn, formatRelativeTime } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Skeleton, CardSkeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/empty-state';
import { toast } from '@/components/ui/toast';
import {
  FileText,
  Plus,
  Search,
  MoreHorizontal,
  Trash2,
  Pencil,
  Eye,
  EyeOff,
  Copy,
  GripVertical,
  ChevronLeft,
  BarChart3,
  Send,
  ClipboardList,
  Type,
  AlignLeft,
  ListChecks,
  CircleDot,
  ChevronDown as SelectIcon,
  ToggleLeft,
  Star,
  Hash,
  Calendar,
  Upload,
  X,
  Check,
  ExternalLink,
  Users,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Form {
  id: string;
  title: string;
  description?: string;
  type: 'FORM' | 'QUIZ';
  status: 'DRAFT' | 'PUBLISHED' | 'CLOSED';
  questions: Question[];
  responseCount: number;
  createdAt: string;
  updatedAt: string;
}

interface Question {
  id: string;
  type: QuestionType;
  label: string;
  description?: string;
  required: boolean;
  options?: string[];
  order: number;
}

type QuestionType =
  | 'SHORT_TEXT'
  | 'LONG_TEXT'
  | 'MULTIPLE_CHOICE'
  | 'CHECKBOX'
  | 'DROPDOWN'
  | 'TOGGLE'
  | 'RATING'
  | 'NUMBER'
  | 'DATE'
  | 'FILE_UPLOAD';

interface FormResponse {
  id: string;
  formId: string;
  answers: Record<string, any>;
  submittedAt: string;
  respondentName?: string;
  respondentEmail?: string;
}

type PageView = 'list' | 'builder' | 'responses';

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const QUESTION_TYPES: { type: QuestionType; label: string; icon: React.ComponentType<any> }[] = [
  { type: 'SHORT_TEXT', label: 'Short Text', icon: Type },
  { type: 'LONG_TEXT', label: 'Long Text', icon: AlignLeft },
  { type: 'MULTIPLE_CHOICE', label: 'Multiple Choice', icon: CircleDot },
  { type: 'CHECKBOX', label: 'Checkboxes', icon: ListChecks },
  { type: 'DROPDOWN', label: 'Dropdown', icon: SelectIcon },
  { type: 'TOGGLE', label: 'Toggle', icon: ToggleLeft },
  { type: 'RATING', label: 'Rating', icon: Star },
  { type: 'NUMBER', label: 'Number', icon: Hash },
  { type: 'DATE', label: 'Date', icon: Calendar },
  { type: 'FILE_UPLOAD', label: 'File Upload', icon: Upload },
];

const STATUS_STYLES: Record<Form['status'], { label: string; bg: string; text: string }> = {
  DRAFT: { label: 'Draft', bg: 'bg-text-tertiary/15', text: 'text-[var(--cx-text-2)]' },
  PUBLISHED: { label: 'Published', bg: 'bg-accent-emerald/15', text: 'text-accent-emerald' },
  CLOSED: { label: 'Closed', bg: 'bg-accent-red/15', text: 'text-accent-red' },
};

/* ------------------------------------------------------------------ */
/*  Forms Page                                                         */
/* ------------------------------------------------------------------ */

export function FormsPage() {
  const queryClient = useQueryClient();

  const [view, setView] = useState<PageView>('list');
  const [activeFormId, setActiveFormId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showAddQuestion, setShowAddQuestion] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);

  /* -- Queries -- */

  const { data: forms = [], isLoading: formsLoading } = useQuery({
    queryKey: ['forms'],
    queryFn: async () => {
      const { data } = await api.get('/forms');
      return data.data as Form[];
    },
  });

  const { data: activeForm, isLoading: formLoading } = useQuery({
    queryKey: ['form', activeFormId],
    queryFn: async () => {
      const { data } = await api.get(`/forms/${activeFormId}`);
      return data.data as Form;
    },
    enabled: !!activeFormId && view !== 'list',
  });

  const { data: responses = [], isLoading: responsesLoading } = useQuery({
    queryKey: ['form-responses', activeFormId],
    queryFn: async () => {
      const { data } = await api.get(`/forms/${activeFormId}/responses`);
      return data.data as FormResponse[];
    },
    enabled: !!activeFormId && view === 'responses',
  });

  /* -- Mutations -- */

  const createForm = useMutation({
    mutationFn: async (payload: { title: string; description?: string; type: 'FORM' | 'QUIZ' }) => {
      const { data } = await api.post('/forms', payload);
      return data.data as Form;
    },
    onSuccess: (form) => {
      queryClient.invalidateQueries({ queryKey: ['forms'] });
      setShowCreateModal(false);
      setActiveFormId(form.id);
      setView('builder');
      toast.success('Form created');
    },
    onError: () => toast.error('Failed to create form'),
  });

  const updateForm = useMutation({
    mutationFn: async ({ id, ...payload }: { id: string; title?: string; description?: string; isPublished?: boolean; status?: Form['status'] }) => {
      const { data } = await api.patch(`/forms/${id}`, payload);
      return data.data as Form;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forms'] });
      queryClient.invalidateQueries({ queryKey: ['form', activeFormId] });
    },
    onError: () => toast.error('Failed to update form'),
  });

  const deleteForm = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/forms/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forms'] });
      setShowDeleteConfirm(null);
      if (activeFormId === showDeleteConfirm) {
        setView('list');
        setActiveFormId(null);
      }
      toast.success('Form deleted');
    },
    onError: () => toast.error('Failed to delete form'),
  });

  const addQuestion = useMutation({
    mutationFn: async (payload: Omit<Question, 'id' | 'order'>) => {
      const { data } = await api.post(`/forms/${activeFormId}/questions`, payload);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['form', activeFormId] });
      setShowAddQuestion(false);
      toast.success('Question added');
    },
    onError: () => toast.error('Failed to add question'),
  });

  const updateQuestion = useMutation({
    mutationFn: async ({ questionId, ...payload }: Partial<Question> & { questionId: string }) => {
      const { data } = await api.patch(`/forms/${activeFormId}/questions/${questionId}`, payload);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['form', activeFormId] });
      setEditingQuestion(null);
      toast.success('Question updated');
    },
    onError: () => toast.error('Failed to update question'),
  });

  const deleteQuestion = useMutation({
    mutationFn: async (questionId: string) => {
      await api.delete(`/forms/${activeFormId}/questions/${questionId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['form', activeFormId] });
      toast.success('Question removed');
    },
    onError: () => toast.error('Failed to remove question'),
  });

  const reorderQuestions = useMutation({
    mutationFn: async (questionIds: string[]) => {
      await api.patch(`/forms/${activeFormId}/questions/reorder`, { questionIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['form', activeFormId] });
    },
  });

  /* -- Filtering -- */

  const filteredForms = useMemo(() => {
    if (!searchQuery.trim()) return forms;
    const q = searchQuery.toLowerCase();
    return forms.filter(
      (f) =>
        f.title.toLowerCase().includes(q) ||
        f.description?.toLowerCase().includes(q)
    );
  }, [forms, searchQuery]);

  /* -- Navigation helpers -- */

  const openBuilder = useCallback((formId: string) => {
    setActiveFormId(formId);
    setView('builder');
  }, []);

  const openResponses = useCallback((formId: string) => {
    setActiveFormId(formId);
    setView('responses');
  }, []);

  const goBack = useCallback(() => {
    setView('list');
    setActiveFormId(null);
  }, []);

  /* -- Move question up/down -- */

  const moveQuestion = useCallback(
    (questionId: string, direction: 'up' | 'down') => {
      if (!activeForm) return;
      const sorted = [...activeForm.questions].sort((a, b) => a.order - b.order);
      const idx = sorted.findIndex((q) => q.id === questionId);
      if (idx < 0) return;
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= sorted.length) return;
      [sorted[idx], sorted[swapIdx]] = [sorted[swapIdx], sorted[idx]];
      reorderQuestions.mutate(sorted.map((q) => q.id));
    },
    [activeForm, reorderQuestions]
  );

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  if (view === 'builder') {
    return (
      <FormBuilder
        form={activeForm ?? null}
        loading={formLoading}
        onBack={goBack}
        onViewResponses={() => setView('responses')}
        onUpdateForm={(payload) => activeFormId && updateForm.mutate({ id: activeFormId, ...payload })}
        onTogglePublish={() => {
          if (!activeForm) return;
          const shouldPublish = activeForm.status !== 'PUBLISHED';
          updateForm.mutate({ id: activeForm.id, isPublished: shouldPublish } as any);
        }}
        onAddQuestion={() => setShowAddQuestion(true)}
        onEditQuestion={setEditingQuestion}
        onDeleteQuestion={(id) => deleteQuestion.mutate(id)}
        onMoveQuestion={moveQuestion}
        showAddQuestion={showAddQuestion}
        onCloseAddQuestion={() => setShowAddQuestion(false)}
        onSubmitAddQuestion={(q) => addQuestion.mutate(q)}
        editingQuestion={editingQuestion}
        onCloseEditQuestion={() => setEditingQuestion(null)}
        onSubmitEditQuestion={(q) => updateQuestion.mutate(q)}
        saving={updateForm.isPending}
      />
    );
  }

  if (view === 'responses') {
    return (
      <ResponsesView
        form={activeForm ?? null}
        responses={responses}
        loading={responsesLoading || formLoading}
        onBack={() => setView('builder')}
        onBackToList={goBack}
      />
    );
  }

  /* -- List View -- */

  return (
    <div className="flex-1 overflow-auto bg-cx-bg">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-cx-bg/80 backdrop-blur-xl border-b border-[var(--cx-border-1)]">
        <div className="flex items-center justify-between px-6 h-14">
          <div className="flex items-center gap-3">
            <ClipboardList size={20} className="text-[var(--cx-text-3)]" />
            <h1 className="text-lg font-display text-[var(--cx-text-1)]">Forms</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--cx-text-3)]" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search forms..."
                className="h-8 w-56 pl-9 pr-3 rounded-lg bg-cx-raised border border-[var(--cx-border-2)] text-sm text-[var(--cx-text-1)] placeholder:text-[var(--cx-text-3)] focus:border-accent-blue focus:ring-1 focus:ring-accent-blue/30 focus:outline-none transition-all"
              />
            </div>
            <Button size="sm" onClick={() => setShowCreateModal(true)}>
              <Plus size={14} /> New Form
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {formsLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        ) : filteredForms.length === 0 ? (
          <EmptyState
            icon={<ClipboardList size={48} />}
            title={searchQuery ? 'No forms found' : 'No forms yet'}
            description={searchQuery ? 'Try a different search term.' : 'Create your first form to start collecting responses.'}
            action={
              !searchQuery ? (
                <Button size="sm" onClick={() => setShowCreateModal(true)}>
                  <Plus size={14} /> Create Form
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredForms.map((form) => (
              <FormCard
                key={form.id}
                form={form}
                onEdit={() => openBuilder(form.id)}
                onViewResponses={() => openResponses(form.id)}
                onDelete={() => setShowDeleteConfirm(form.id)}
                onDuplicate={() => {
                  createForm.mutate({
                    title: `${form.title} (copy)`,
                    description: form.description,
                    type: form.type,
                  });
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create Modal */}
      <CreateFormModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={(data) => createForm.mutate(data)}
        loading={createForm.isPending}
      />

      {/* Delete Confirmation */}
      <Modal
        open={!!showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(null)}
        title="Delete Form"
        size="sm"
      >
        <p className="text-sm text-[var(--cx-text-2)] mb-4">
          Are you sure you want to delete this form? All responses will be permanently removed. This action cannot be undone.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={() => setShowDeleteConfirm(null)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            size="sm"
            loading={deleteForm.isPending}
            onClick={() => showDeleteConfirm && deleteForm.mutate(showDeleteConfirm)}
          >
            Delete
          </Button>
        </div>
      </Modal>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Form Card                                                          */
/* ------------------------------------------------------------------ */

function FormCard({
  form,
  onEdit,
  onViewResponses,
  onDelete,
  onDuplicate,
}: {
  form: Form;
  onEdit: () => void;
  onViewResponses: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const status = STATUS_STYLES[form.status];

  return (
    <div
      className="bg-cx-surface border border-[var(--cx-border-1)] rounded-xl p-4 hover:border-border-hover transition-colors group cursor-pointer"
      onClick={onEdit}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0 mr-2">
          <h3 className="text-sm font-medium text-[var(--cx-text-1)] truncate">{form.title}</h3>
          {form.description && (
            <p className="text-xs text-[var(--cx-text-3)] truncate mt-0.5">{form.description}</p>
          )}
        </div>
        <div className="relative flex-shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen(!menuOpen);
            }}
            className="p-1 rounded-md hover:bg-[rgba(255,255,255,0.04)] text-[var(--cx-text-3)] hover:text-[var(--cx-text-1)] transition-colors opacity-0 group-hover:opacity-100"
          >
            <MoreHorizontal size={16} />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-20" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-full mt-1 w-40 bg-cx-surface border border-[var(--cx-border-1)] rounded-lg shadow-lg z-30 py-1">
                <MenuButton icon={<Pencil size={14} />} label="Edit" onClick={() => { setMenuOpen(false); onEdit(); }} />
                <MenuButton icon={<BarChart3 size={14} />} label="Responses" onClick={() => { setMenuOpen(false); onViewResponses(); }} />
                <MenuButton icon={<Copy size={14} />} label="Duplicate" onClick={() => { setMenuOpen(false); onDuplicate(); }} />
                <div className="border-t border-[var(--cx-border-1)] my-1" />
                <MenuButton icon={<Trash2 size={14} />} label="Delete" onClick={() => { setMenuOpen(false); onDelete(); }} danger />
              </div>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 text-xs">
        <span className={cn('px-2 py-0.5 rounded-full font-medium', status.bg, status.text)}>
          {status.label}
        </span>
        <span className="text-[var(--cx-text-3)] capitalize">{form.type.toLowerCase()}</span>
        <span className="text-[var(--cx-text-3)] ml-auto flex items-center gap-1">
          <Users size={12} /> {form.responseCount}
        </span>
      </div>

      <div className="text-xs text-[var(--cx-text-3)] mt-3">
        Updated {formatRelativeTime(form.updatedAt)}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Menu Button (context menu item)                                    */
/* ------------------------------------------------------------------ */

function MenuButton({
  icon,
  label,
  onClick,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        'w-full flex items-center gap-2 px-3 py-1.5 text-sm transition-colors',
        danger
          ? 'text-accent-red hover:bg-accent-red/10'
          : 'text-[var(--cx-text-2)] hover:bg-[rgba(255,255,255,0.04)] hover:text-[var(--cx-text-1)]'
      )}
    >
      {icon}
      {label}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Create Form Modal                                                  */
/* ------------------------------------------------------------------ */

function CreateFormModal({
  open,
  onClose,
  onSubmit,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: { title: string; description?: string; type: 'FORM' | 'QUIZ' }) => void;
  loading: boolean;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<'FORM' | 'QUIZ'>('FORM');

  const handleSubmit = () => {
    if (!title.trim()) return;
    onSubmit({ title: title.trim(), description: description.trim() || undefined, type });
    setTitle('');
    setDescription('');
    setType('FORM');
  };

  return (
    <Modal open={open} onClose={onClose} title="Create Form">
      <div className="space-y-4">
        <Input
          label="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Form title"
          autoFocus
        />
        <Input
          label="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Brief description"
        />
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-[var(--cx-text-2)]">Type</label>
          <div className="flex gap-2">
            {(['FORM', 'QUIZ'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={cn(
                  'px-4 py-2 rounded-lg text-sm border transition-colors',
                  type === t
                    ? 'bg-accent-blue/15 border-accent-blue text-accent-blue'
                    : 'bg-cx-raised border-[var(--cx-border-2)] text-[var(--cx-text-2)] hover:bg-[rgba(255,255,255,0.04)]'
                )}
              >
                {t === 'FORM' ? 'Form' : 'Quiz'}
              </button>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSubmit} loading={loading} disabled={!title.trim()}>
            Create
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/*  Form Builder                                                       */
/* ------------------------------------------------------------------ */

function FormBuilder({
  form,
  loading,
  onBack,
  onViewResponses,
  onUpdateForm,
  onTogglePublish,
  onAddQuestion,
  onEditQuestion,
  onDeleteQuestion,
  onMoveQuestion,
  showAddQuestion,
  onCloseAddQuestion,
  onSubmitAddQuestion,
  editingQuestion,
  onCloseEditQuestion,
  onSubmitEditQuestion,
  saving,
}: {
  form: Form | null;
  loading: boolean;
  onBack: () => void;
  onViewResponses: () => void;
  onUpdateForm: (payload: { title?: string; description?: string }) => void;
  onTogglePublish: () => void;
  onAddQuestion: () => void;
  onEditQuestion: (q: Question) => void;
  onDeleteQuestion: (id: string) => void;
  onMoveQuestion: (id: string, dir: 'up' | 'down') => void;
  showAddQuestion: boolean;
  onCloseAddQuestion: () => void;
  onSubmitAddQuestion: (q: Omit<Question, 'id' | 'order'>) => void;
  editingQuestion: Question | null;
  onCloseEditQuestion: () => void;
  onSubmitEditQuestion: (q: Partial<Question> & { questionId: string }) => void;
  saving: boolean;
}) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [editingDesc, setEditingDesc] = useState(false);
  const [descDraft, setDescDraft] = useState('');

  if (loading || !form) {
    return (
      <div className="flex-1 overflow-auto bg-cx-bg p-6">
        <Skeleton className="h-8 w-48 mb-4" />
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const questions = [...form.questions].sort((a, b) => a.order - b.order);
  const statusCfg = STATUS_STYLES[form.status];

  return (
    <div className="flex-1 overflow-auto bg-cx-bg">
      {/* Builder Header */}
      <div className="sticky top-0 z-10 bg-cx-bg/80 backdrop-blur-xl border-b border-[var(--cx-border-1)]">
        <div className="flex items-center justify-between px-6 h-14">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-1.5 rounded-lg hover:bg-[rgba(255,255,255,0.04)] text-[var(--cx-text-3)] hover:text-[var(--cx-text-1)] transition-colors"
            >
              <ChevronLeft size={18} />
            </button>
            <ClipboardList size={18} className="text-[var(--cx-text-3)]" />
            <span className="text-sm font-semibold text-[var(--cx-text-1)] truncate max-w-xs">
              {form.title}
            </span>
            <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-bold', statusCfg.bg, statusCfg.text)}>
              {statusCfg.label}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onViewResponses}>
              <BarChart3 size={14} /> Responses ({form.responseCount})
            </Button>
            <Button
              variant={form.status === 'PUBLISHED' ? 'secondary' : 'primary'}
              size="sm"
              onClick={onTogglePublish}
              loading={saving}
            >
              {form.status === 'PUBLISHED' ? (
                <><EyeOff size={14} /> Unpublish</>
              ) : (
                <><Send size={14} /> Publish</>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Builder Body */}
      <div className="max-w-2xl mx-auto p-6 space-y-4">
        {/* Title */}
        <div className="bg-cx-surface border border-[var(--cx-border-1)] rounded-xl p-5">
          {editingTitle ? (
            <div className="flex items-center gap-2">
              <input
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                className="flex-1 text-lg font-semibold bg-transparent text-[var(--cx-text-1)] border-b border-accent-blue pb-1 focus:outline-none"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    onUpdateForm({ title: titleDraft });
                    setEditingTitle(false);
                  }
                  if (e.key === 'Escape') setEditingTitle(false);
                }}
              />
              <button
                onClick={() => {
                  onUpdateForm({ title: titleDraft });
                  setEditingTitle(false);
                }}
                className="p-1 text-accent-emerald hover:bg-accent-emerald/10 rounded"
              >
                <Check size={16} />
              </button>
              <button onClick={() => setEditingTitle(false)} className="p-1 text-[var(--cx-text-3)] hover:bg-[rgba(255,255,255,0.04)] rounded">
                <X size={16} />
              </button>
            </div>
          ) : (
            <h2
              className="text-lg font-semibold text-[var(--cx-text-1)] cursor-pointer hover:text-accent-blue transition-colors"
              onClick={() => {
                setTitleDraft(form.title);
                setEditingTitle(true);
              }}
            >
              {form.title}
            </h2>
          )}

          {editingDesc ? (
            <div className="flex items-center gap-2 mt-2">
              <input
                value={descDraft}
                onChange={(e) => setDescDraft(e.target.value)}
                className="flex-1 text-sm bg-transparent text-[var(--cx-text-2)] border-b border-accent-blue pb-1 focus:outline-none"
                placeholder="Add a description..."
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    onUpdateForm({ description: descDraft });
                    setEditingDesc(false);
                  }
                  if (e.key === 'Escape') setEditingDesc(false);
                }}
              />
              <button
                onClick={() => {
                  onUpdateForm({ description: descDraft });
                  setEditingDesc(false);
                }}
                className="p-1 text-accent-emerald hover:bg-accent-emerald/10 rounded"
              >
                <Check size={16} />
              </button>
              <button onClick={() => setEditingDesc(false)} className="p-1 text-[var(--cx-text-3)] hover:bg-[rgba(255,255,255,0.04)] rounded">
                <X size={16} />
              </button>
            </div>
          ) : (
            <p
              className="text-sm text-[var(--cx-text-3)] mt-1 cursor-pointer hover:text-[var(--cx-text-2)] transition-colors"
              onClick={() => {
                setDescDraft(form.description || '');
                setEditingDesc(true);
              }}
            >
              {form.description || 'Click to add description...'}
            </p>
          )}
        </div>

        {/* Questions */}
        {questions.length === 0 ? (
          <div className="bg-cx-surface border border-[var(--cx-border-1)] border-dashed rounded-xl p-8 text-center">
            <ClipboardList size={32} className="text-[var(--cx-text-3)] mx-auto mb-2" />
            <p className="text-sm text-[var(--cx-text-3)] mb-3">No questions yet</p>
            <Button size="sm" onClick={onAddQuestion}>
              <Plus size={14} /> Add Question
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {questions.map((q, idx) => {
              const qType = QUESTION_TYPES.find((t) => t.type === q.type);
              const Icon = qType?.icon || Type;
              return (
                <div
                  key={q.id}
                  className="bg-cx-surface border border-[var(--cx-border-1)] rounded-xl p-4 group hover:border-border-hover transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex flex-col items-center gap-1 pt-0.5">
                      <GripVertical size={14} className="text-[var(--cx-text-3)]/40 cursor-grab" />
                      <button
                        onClick={() => onMoveQuestion(q.id, 'up')}
                        disabled={idx === 0}
                        className="p-0.5 text-[var(--cx-text-3)] hover:text-[var(--cx-text-1)] disabled:opacity-20 transition-colors"
                        title="Move up"
                      >
                        <ChevronLeft size={12} className="rotate-90" />
                      </button>
                      <button
                        onClick={() => onMoveQuestion(q.id, 'down')}
                        disabled={idx === questions.length - 1}
                        className="p-0.5 text-[var(--cx-text-3)] hover:text-[var(--cx-text-1)] disabled:opacity-20 transition-colors"
                        title="Move down"
                      >
                        <ChevronLeft size={12} className="-rotate-90" />
                      </button>
                    </div>

                    <div className="w-8 h-8 rounded-lg bg-accent-blue/10 flex items-center justify-center flex-shrink-0">
                      <Icon size={14} className="text-accent-blue" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-[var(--cx-text-1)]">{q.label}</span>
                        {q.required && (
                          <span className="text-[10px] font-bold text-accent-red">*</span>
                        )}
                      </div>
                      <div className="text-xs text-[var(--cx-text-3)] mt-0.5">
                        {qType?.label || q.type}
                        {q.options && q.options.length > 0 && (
                          <span> &middot; {q.options.length} option{q.options.length !== 1 ? 's' : ''}</span>
                        )}
                      </div>
                      {q.description && (
                        <p className="text-xs text-[var(--cx-text-3)]/70 mt-1">{q.description}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => onEditQuestion(q)}
                        className="p-1.5 rounded-md hover:bg-[rgba(255,255,255,0.04)] text-[var(--cx-text-3)] hover:text-[var(--cx-text-1)] transition-colors"
                        title="Edit question"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => onDeleteQuestion(q.id)}
                        className="p-1.5 rounded-md hover:bg-accent-red/10 text-[var(--cx-text-3)] hover:text-accent-red transition-colors"
                        title="Delete question"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Add Question Button */}
        {questions.length > 0 && (
          <button
            onClick={onAddQuestion}
            className="w-full py-3 rounded-xl border border-dashed border-[var(--cx-border-2)] text-sm text-[var(--cx-text-3)] hover:text-accent-blue hover:border-accent-blue/40 transition-colors flex items-center justify-center gap-2"
          >
            <Plus size={16} /> Add Question
          </button>
        )}
      </div>

      {/* Add Question Modal */}
      <QuestionModal
        open={showAddQuestion}
        onClose={onCloseAddQuestion}
        onSubmit={(q) => onSubmitAddQuestion(q)}
        title="Add Question"
      />

      {/* Edit Question Modal */}
      <QuestionModal
        open={!!editingQuestion}
        onClose={onCloseEditQuestion}
        onSubmit={(q) => editingQuestion && onSubmitEditQuestion({ ...q, questionId: editingQuestion.id })}
        title="Edit Question"
        initial={editingQuestion}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Question Modal (Add / Edit)                                        */
/* ------------------------------------------------------------------ */

function QuestionModal({
  open,
  onClose,
  onSubmit,
  title,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (q: Omit<Question, 'id' | 'order'>) => void;
  title: string;
  initial?: Question | null;
}) {
  const [type, setType] = useState<QuestionType>(initial?.type || 'SHORT_TEXT');
  const [label, setLabel] = useState(initial?.label || '');
  const [description, setDescription] = useState(initial?.description || '');
  const [required, setRequired] = useState(initial?.required ?? false);
  const [options, setOptions] = useState<string[]>(initial?.options || ['']);

  // Reset state when modal opens with different data
  const key = initial?.id || 'new';
  useState(() => {
    setType(initial?.type || 'SHORT_TEXT');
    setLabel(initial?.label || '');
    setDescription(initial?.description || '');
    setRequired(initial?.required ?? false);
    setOptions(initial?.options || ['']);
  });

  const hasOptions = ['MULTIPLE_CHOICE', 'CHECKBOX', 'DROPDOWN'].includes(type);

  const handleSubmit = () => {
    if (!label.trim()) return;
    const validOptions = hasOptions ? options.filter((o) => o.trim()) : undefined;
    onSubmit({ type, label: label.trim(), description: description.trim() || undefined, required, options: validOptions });
    // Reset
    setType('SHORT_TEXT');
    setLabel('');
    setDescription('');
    setRequired(false);
    setOptions(['']);
  };

  return (
    <Modal open={open} onClose={onClose} title={title} size="lg">
      <div className="space-y-4">
        {/* Question Type Picker */}
        <div>
          <label className="text-sm font-medium text-[var(--cx-text-2)] mb-2 block">Question Type</label>
          <div className="grid grid-cols-5 gap-2">
            {QUESTION_TYPES.map((qt) => (
              <button
                key={qt.type}
                onClick={() => setType(qt.type)}
                className={cn(
                  'flex flex-col items-center gap-1.5 p-2.5 rounded-lg border text-xs transition-colors',
                  type === qt.type
                    ? 'bg-accent-blue/15 border-accent-blue text-accent-blue'
                    : 'bg-cx-raised border-[var(--cx-border-2)] text-[var(--cx-text-3)] hover:bg-[rgba(255,255,255,0.04)] hover:text-[var(--cx-text-2)]'
                )}
              >
                <qt.icon size={16} />
                <span className="truncate w-full text-center">{qt.label}</span>
              </button>
            ))}
          </div>
        </div>

        <Input
          label="Question Label"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Enter your question..."
          autoFocus
        />

        <Input
          label="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Help text for the respondent"
        />

        {/* Options (for applicable types) */}
        {hasOptions && (
          <div>
            <label className="text-sm font-medium text-[var(--cx-text-2)] mb-2 block">Options</label>
            <div className="space-y-2">
              {options.map((opt, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="text-xs text-[var(--cx-text-3)] w-5 text-right">{idx + 1}.</span>
                  <input
                    value={opt}
                    onChange={(e) => {
                      const next = [...options];
                      next[idx] = e.target.value;
                      setOptions(next);
                    }}
                    placeholder={`Option ${idx + 1}`}
                    className="flex-1 h-8 px-3 rounded-lg bg-cx-raised border border-[var(--cx-border-2)] text-sm text-[var(--cx-text-1)] placeholder:text-[var(--cx-text-3)] focus:border-accent-blue focus:ring-1 focus:ring-accent-blue/30 focus:outline-none transition-all"
                  />
                  {options.length > 1 && (
                    <button
                      onClick={() => setOptions(options.filter((_, i) => i !== idx))}
                      className="p-1 text-[var(--cx-text-3)] hover:text-accent-red transition-colors"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))}
              <button
                onClick={() => setOptions([...options, ''])}
                className="text-xs text-accent-blue hover:brightness-125 transition-all flex items-center gap-1"
              >
                <Plus size={12} /> Add option
              </button>
            </div>
          </div>
        )}

        {/* Required toggle */}
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-[var(--cx-text-2)]">Required</label>
          <button
            onClick={() => setRequired(!required)}
            className={cn(
              'w-10 h-6 rounded-full transition-colors relative',
              required ? 'bg-accent-blue' : 'bg-[rgba(255,255,255,0.06)]'
            )}
          >
            <div
              className={cn(
                'w-4 h-4 bg-white rounded-full absolute top-1 transition-transform',
                required ? 'translate-x-5' : 'translate-x-1'
              )}
            />
          </button>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={!label.trim()}>
            {initial ? 'Save Changes' : 'Add Question'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/*  Responses View                                                     */
/* ------------------------------------------------------------------ */

function ResponsesView({
  form,
  responses,
  loading,
  onBack,
  onBackToList,
}: {
  form: Form | null;
  responses: FormResponse[];
  loading: boolean;
  onBack: () => void;
  onBackToList: () => void;
}) {
  if (loading || !form) {
    return (
      <div className="flex-1 overflow-auto bg-cx-bg p-6">
        <Skeleton className="h-8 w-48 mb-4" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  const questions = [...form.questions].sort((a, b) => a.order - b.order);
  const latestResponse = responses.length > 0
    ? responses.reduce((latest, r) =>
        new Date(r.submittedAt) > new Date(latest.submittedAt) ? r : latest
      )
    : null;

  return (
    <div className="flex-1 overflow-auto bg-cx-bg">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-cx-bg/80 backdrop-blur-xl border-b border-[var(--cx-border-1)]">
        <div className="flex items-center justify-between px-6 h-14">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-1.5 rounded-lg hover:bg-[rgba(255,255,255,0.04)] text-[var(--cx-text-3)] hover:text-[var(--cx-text-1)] transition-colors"
            >
              <ChevronLeft size={18} />
            </button>
            <BarChart3 size={18} className="text-[var(--cx-text-3)]" />
            <span className="text-sm font-semibold text-[var(--cx-text-1)] truncate max-w-xs">
              {form.title} &mdash; Responses
            </span>
          </div>
          <Button variant="ghost" size="sm" onClick={onBackToList}>
            <ChevronLeft size={14} /> All Forms
          </Button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-6 space-y-6">
        {/* Analytics Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard label="Total Responses" value={responses.length.toString()} />
          <StatCard label="Questions" value={questions.length.toString()} />
          <StatCard
            label="Latest Response"
            value={latestResponse ? formatRelativeTime(latestResponse.submittedAt) : 'None'}
          />
        </div>

        {/* Responses Table */}
        {responses.length === 0 ? (
          <EmptyState
            icon={<BarChart3 size={48} />}
            title="No responses yet"
            description={
              form.status === 'PUBLISHED'
                ? 'Share your form to start collecting responses.'
                : 'Publish your form first to start collecting responses.'
            }
          />
        ) : (
          <div className="bg-cx-surface border border-[var(--cx-border-1)] rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--cx-border-1)]">
                    <th className="px-4 py-3 text-left text-xs font-medium text-[var(--cx-text-3)] uppercase tracking-wider">
                      #
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[var(--cx-text-3)] uppercase tracking-wider">
                      Respondent
                    </th>
                    {questions.map((q) => (
                      <th
                        key={q.id}
                        className="px-4 py-3 text-left text-xs font-medium text-[var(--cx-text-3)] uppercase tracking-wider max-w-[200px]"
                      >
                        <span className="truncate block">{q.label}</span>
                      </th>
                    ))}
                    <th className="px-4 py-3 text-left text-xs font-medium text-[var(--cx-text-3)] uppercase tracking-wider">
                      Submitted
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {responses.map((response, idx) => (
                    <tr
                      key={response.id}
                      className="border-b border-[var(--cx-border-1)] last:border-b-0 hover:bg-[rgba(255,255,255,0.04)] transition-colors"
                    >
                      <td className="px-4 py-3 text-[var(--cx-text-3)]">{idx + 1}</td>
                      <td className="px-4 py-3 text-[var(--cx-text-1)]">
                        {response.respondentName || response.respondentEmail || 'Anonymous'}
                      </td>
                      {questions.map((q) => {
                        const value = response.answers?.[q.id];
                        const display = Array.isArray(value) ? value.join(', ') : (value ?? '');
                        return (
                          <td
                            key={q.id}
                            className="px-4 py-3 text-[var(--cx-text-2)] max-w-[200px] truncate"
                            title={String(display)}
                          >
                            {String(display) || <span className="text-[var(--cx-text-3)]/40">&mdash;</span>}
                          </td>
                        );
                      })}
                      <td className="px-4 py-3 text-[var(--cx-text-3)] whitespace-nowrap">
                        {formatRelativeTime(response.submittedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Stat Card                                                          */
/* ------------------------------------------------------------------ */

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-cx-surface border border-[var(--cx-border-1)] rounded-xl p-4">
      <div className="text-xs text-[var(--cx-text-3)] mb-1">{label}</div>
      <div className="text-xl font-semibold text-[var(--cx-text-1)]">{value}</div>
    </div>
  );
}
