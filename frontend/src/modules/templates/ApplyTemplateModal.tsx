import { useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useTemplate, useApplyTemplate } from '@/hooks/useTemplates';
import { useSpaces } from '@/hooks/useSpaces';
import { useListsBySpace, type TaskList } from '@/hooks/useLists';

// ==========================================
// Component
// ==========================================

interface ApplyTemplateModalProps {
  templateId: string;
  onClose: () => void;
  workspaceId?: string;
}

export function ApplyTemplateModal({ templateId, onClose, workspaceId }: ApplyTemplateModalProps) {
  const [selectedSpaceId, setSelectedSpaceId] = useState('');
  const [selectedListId, setSelectedListId] = useState('');
  const [remapDates, setRemapDates] = useState(false);
  const [dateOffset, setDateOffset] = useState(0);

  const { data: template, isLoading: loadingTemplate } = useTemplate(templateId);
  const { data: spaces } = useSpaces(workspaceId ?? template?.workspaceId);
  const { data: lists } = useListsBySpace(selectedSpaceId || undefined);
  const applyTemplate = useApplyTemplate();

  const handleApply = async () => {
    if (!selectedListId) return;

    await applyTemplate.mutateAsync({
      templateId,
      targetListId: selectedListId,
      remapDates: remapDates || undefined,
      dateOffset: remapDates ? dateOffset : undefined,
    });

    onClose();
  };

  // Build preview from template data
  const previewItems: string[] = [];
  if (template?.templateData) {
    const data = template.templateData as any;
    if (template.templateType === 'TASK') {
      previewItems.push(`Task: ${data.title ?? 'Untitled'}`);
      if (data.subtasks?.length) {
        previewItems.push(`  + ${data.subtasks.length} subtask(s)`);
      }
      if (data.checklists?.length) {
        const totalItems = data.checklists.reduce((sum: number, cl: any) => sum + (cl.items?.length ?? 0), 0);
        previewItems.push(`  + ${data.checklists.length} checklist(s), ${totalItems} item(s)`);
      }
    } else if (template.templateType === 'LIST') {
      previewItems.push(`List: ${data.listName ?? 'Untitled'}`);
      if (data.tasks?.length) {
        previewItems.push(`  + ${data.tasks.length} task(s)`);
      }
    }
  }

  return (
    <Modal open={true} onClose={onClose} title="Apply Template" size="md">
      <div className="flex flex-col gap-4">
        {loadingTemplate ? (
          <div className="text-sm text-[var(--cx-text-2)]">Loading template...</div>
        ) : template ? (
          <>
            {/* Template info */}
            <div className="p-3 rounded-lg bg-cx-surface/50 border border-[var(--cx-border-1)]">
              <h4 className="text-sm font-medium text-[var(--cx-text-1)]">{template.name}</h4>
              {template.description && (
                <p className="text-xs text-[var(--cx-text-2)] mt-1">{template.description}</p>
              )}
              <span className="inline-block text-[10px] mt-2 px-1.5 py-0.5 rounded bg-cx-raised text-[var(--cx-text-1)]">
                {template.templateType}
              </span>
            </div>

            {/* Target selection */}
            <div>
              <label className="block text-xs font-medium text-[var(--cx-text-1)] mb-1">Select Space</label>
              <select
                value={selectedSpaceId}
                onChange={(e) => {
                  setSelectedSpaceId(e.target.value);
                  setSelectedListId('');
                }}
                className="w-full h-9 rounded-md border border-[var(--cx-border-1)] bg-cx-surface px-3 text-sm text-[var(--cx-text-1)] focus:outline-none focus:ring-1 focus:ring-cx-brand"
              >
                <option value="">Choose a space...</option>
                {spaces?.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--cx-text-1)] mb-1">Select Target List</label>
              <select
                value={selectedListId}
                onChange={(e) => setSelectedListId(e.target.value)}
                disabled={!selectedSpaceId}
                className="w-full h-9 rounded-md border border-[var(--cx-border-1)] bg-cx-surface px-3 text-sm text-[var(--cx-text-1)] focus:outline-none focus:ring-1 focus:ring-cx-brand disabled:opacity-50"
              >
                <option value="">Choose a list...</option>
                {lists?.map((l: TaskList) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>

            {/* Date remapping */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="remapDates"
                checked={remapDates}
                onChange={(e) => setRemapDates(e.target.checked)}
                className="rounded border-[var(--cx-border-2)]"
              />
              <label htmlFor="remapDates" className="text-xs text-[var(--cx-text-1)]">
                Remap dates relative to today
              </label>
            </div>

            {remapDates && (
              <div>
                <label className="block text-xs font-medium text-[var(--cx-text-1)] mb-1">Date offset (days)</label>
                <Input
                  type="number"
                  value={dateOffset}
                  onChange={(e) => setDateOffset(parseInt(e.target.value, 10) || 0)}
                  placeholder="0"
                />
                <p className="text-[10px] text-[var(--cx-text-3)] mt-1">
                  Positive = future, negative = past
                </p>
              </div>
            )}

            {/* Preview */}
            {previewItems.length > 0 && (
              <div className="p-3 rounded-lg bg-cx-surface/50 border border-[var(--cx-border-1)]">
                <h4 className="text-xs font-medium text-[var(--cx-text-1)] mb-2">Will Create</h4>
                <ul className="space-y-0.5">
                  {previewItems.map((item, i) => (
                    <li key={i} className="text-xs text-[var(--cx-text-2)]">{item}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button
                onClick={handleApply}
                disabled={!selectedListId || applyTemplate.isPending}
              >
                {applyTemplate.isPending ? 'Applying...' : 'Apply'}
              </Button>
            </div>
          </>
        ) : (
          <div className="text-sm text-cx-danger">Template not found</div>
        )}
      </div>
    </Modal>
  );
}
