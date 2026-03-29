import { useState, useCallback, useMemo } from 'react';
import {
  ArrowRightLeft, Plus, Move, UserPlus, Flag, Clock,
  MessageSquare, Tag, Settings, X, ChevronRight, ChevronLeft,
  Trash2, GripVertical,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type {
  Automation, AutomationTrigger, AutomationCondition, AutomationAction,
  TriggerType, ActionType, ConditionOperator,
  CreateAutomationPayload, UpdateAutomationPayload,
} from '@/hooks/useAutomations';

// ==========================================
// Config maps
// ==========================================

const triggerOptions: { type: TriggerType; label: string; icon: React.ElementType; description: string }[] = [
  { type: 'STATUS_CHANGED', label: 'Status Changed', icon: ArrowRightLeft, description: 'When a task status changes' },
  { type: 'TASK_CREATED', label: 'Task Created', icon: Plus, description: 'When a new task is created' },
  { type: 'TASK_MOVED', label: 'Task Moved', icon: Move, description: 'When a task is moved to another list' },
  { type: 'ASSIGNEE_CHANGED', label: 'Assignee Changed', icon: UserPlus, description: 'When task assignee changes' },
  { type: 'PRIORITY_CHANGED', label: 'Priority Changed', icon: Flag, description: 'When task priority changes' },
  { type: 'DUE_DATE_ARRIVES', label: 'Due Date Arrives', icon: Clock, description: 'When a due date is reached' },
  { type: 'COMMENT_ADDED', label: 'Comment Added', icon: MessageSquare, description: 'When a comment is added' },
  { type: 'TAG_ADDED', label: 'Tag Added', icon: Tag, description: 'When a tag is added to a task' },
  { type: 'CUSTOM_FIELD_CHANGED', label: 'Custom Field Changed', icon: Settings, description: 'When a custom field value changes' },
];

const actionOptions: { type: ActionType; label: string; icon: React.ElementType }[] = [
  { type: 'CHANGE_STATUS', label: 'Change Status', icon: ArrowRightLeft },
  { type: 'CHANGE_PRIORITY', label: 'Change Priority', icon: Flag },
  { type: 'ADD_ASSIGNEE', label: 'Add Assignee', icon: UserPlus },
  { type: 'REMOVE_ASSIGNEE', label: 'Remove Assignee', icon: UserPlus },
  { type: 'SET_DUE_DATE', label: 'Set Due Date', icon: Clock },
  { type: 'ADD_TAG', label: 'Add Tag', icon: Tag },
  { type: 'MOVE_TO_LIST', label: 'Move to List', icon: Move },
  { type: 'CREATE_SUBTASK', label: 'Create Subtask', icon: Plus },
  { type: 'SET_CUSTOM_FIELD', label: 'Set Custom Field', icon: Settings },
  { type: 'SEND_NOTIFICATION', label: 'Send Notification', icon: MessageSquare },
  { type: 'ADD_COMMENT', label: 'Add Comment', icon: MessageSquare },
  { type: 'ARCHIVE', label: 'Archive', icon: Trash2 },
];

const conditionFields = ['Priority', 'Status', 'Assignee', 'Due Date', 'Tags', 'Custom Field'];
const conditionOperators: { value: ConditionOperator; label: string }[] = [
  { value: 'equals', label: 'equals' },
  { value: 'not_equals', label: 'does not equal' },
  { value: 'contains', label: 'contains' },
  { value: 'not_contains', label: 'does not contain' },
  { value: 'is_set', label: 'is set' },
  { value: 'is_not_set', label: 'is not set' },
  { value: 'greater_than', label: 'greater than' },
  { value: 'less_than', label: 'less than' },
];

// ==========================================
// Props
// ==========================================

interface AutomationBuilderProps {
  automation?: Automation | null;
  workspaceId: string;
  locationType: string;
  locationId: string;
  onSave: (payload: CreateAutomationPayload | UpdateAutomationPayload) => void;
  onClose: () => void;
  isSaving?: boolean;
}

type Step = 'trigger' | 'conditions' | 'actions';

// ==========================================
// Component
// ==========================================

export function AutomationBuilder({
  automation,
  workspaceId,
  locationType,
  locationId,
  onSave,
  onClose,
  isSaving,
}: AutomationBuilderProps) {
  const isEditing = !!automation;

  // Name
  const [name, setName] = useState(automation?.name ?? '');

  // Step navigation
  const [step, setStep] = useState<Step>('trigger');

  // WHEN — trigger
  const [trigger, setTrigger] = useState<AutomationTrigger | null>(
    automation?.trigger ?? null
  );
  const [triggerConfig, setTriggerConfig] = useState<Record<string, unknown>>(
    automation?.trigger?.config ?? {}
  );

  // IF — conditions
  const [conditions, setConditions] = useState<AutomationCondition[]>(
    automation?.conditions ?? []
  );
  const [conditionLogic, setConditionLogic] = useState<'AND' | 'OR'>(
    automation?.conditionLogic ?? 'AND'
  );

  // THEN — actions
  const [actions, setActions] = useState<AutomationAction[]>(
    automation?.actions ?? []
  );

  // ---- Trigger handlers ----
  const handleSelectTrigger = useCallback((type: TriggerType) => {
    setTrigger({ type, config: {} });
    setTriggerConfig({});
  }, []);

  const handleTriggerConfigChange = useCallback((key: string, value: unknown) => {
    setTriggerConfig((prev) => ({ ...prev, [key]: value }));
  }, []);

  // ---- Condition handlers ----
  const addCondition = useCallback(() => {
    setConditions((prev) => [...prev, { field: 'Status', operator: 'equals', value: '' }]);
  }, []);

  const updateCondition = useCallback((index: number, updates: Partial<AutomationCondition>) => {
    setConditions((prev) => prev.map((c, i) => (i === index ? { ...c, ...updates } : c)));
  }, []);

  const removeCondition = useCallback((index: number) => {
    setConditions((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // ---- Action handlers ----
  const addAction = useCallback((type: ActionType) => {
    setActions((prev) => [...prev, { type, config: {}, position: prev.length }]);
  }, []);

  const updateActionConfig = useCallback((index: number, key: string, value: unknown) => {
    setActions((prev) =>
      prev.map((a, i) =>
        i === index ? { ...a, config: { ...a.config, [key]: value } } : a
      )
    );
  }, []);

  const removeAction = useCallback((index: number) => {
    setActions((prev) => prev.filter((_, i) => i !== index).map((a, i) => ({ ...a, position: i })));
  }, []);

  const moveAction = useCallback((from: number, to: number) => {
    setActions((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next.map((a, i) => ({ ...a, position: i }));
    });
  }, []);

  // ---- Summary text ----
  const summaryText = useMemo(() => {
    if (!trigger) return '';
    const triggerLabel = triggerOptions.find((t) => t.type === trigger.type)?.label ?? trigger.type;
    let text = `When ${triggerLabel.toLowerCase()}`;

    if (triggerConfig.fromStatus) text += ` from "${triggerConfig.fromStatus}"`;
    if (triggerConfig.toStatus) text += ` to "${triggerConfig.toStatus}"`;

    if (conditions.length > 0) {
      const condTexts = conditions.map((c) => `${c.field} ${c.operator} ${c.value ?? ''}`);
      text += `, if ${condTexts.join(` ${conditionLogic.toLowerCase()} `)}`;
    }

    if (actions.length > 0) {
      const actTexts = actions.map((a) => {
        const label = actionOptions.find((o) => o.type === a.type)?.label ?? a.type;
        const configStr = Object.values(a.config).filter(Boolean).join(', ');
        return configStr ? `${label} (${configStr})` : label;
      });
      text += `, then ${actTexts.join(' and ')}`;
    }

    return text;
  }, [trigger, triggerConfig, conditions, conditionLogic, actions]);

  // ---- Save ----
  const handleSave = () => {
    if (!trigger || !name.trim() || actions.length === 0) return;

    const resolvedTrigger: AutomationTrigger = { type: trigger.type, config: triggerConfig };

    if (isEditing) {
      const payload: UpdateAutomationPayload = {
        name: name.trim(),
        trigger: resolvedTrigger,
        conditions,
        conditionLogic,
        actions,
      };
      onSave(payload);
    } else {
      const payload: CreateAutomationPayload = {
        name: name.trim(),
        workspaceId,
        locationType,
        locationId,
        trigger: resolvedTrigger,
        conditions,
        conditionLogic,
        actions,
        isActive: true,
      };
      onSave(payload);
    }
  };

  const canProceed = step === 'trigger' ? !!trigger : step === 'conditions' ? true : actions.length > 0;
  const steps: Step[] = ['trigger', 'conditions', 'actions'];
  const stepIndex = steps.indexOf(step);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-2xl max-h-[90vh] bg-[#111113] rounded-2xl border border-[rgba(255,255,255,0.08)] shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[rgba(255,255,255,0.08)]">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">
              {isEditing ? 'Edit Automation' : 'Create Automation'}
            </h2>
            <div className="flex items-center gap-1 mt-1">
              {steps.map((s, i) => {
                const stepColors = {
                  trigger: { active: 'bg-[#2563EB] text-white', done: 'bg-[#2563EB]/20 text-[#2563EB]', pending: 'bg-[rgba(255,255,255,0.06)] text-[rgba(255,255,255,0.40)]' },
                  conditions: { active: 'bg-[#f97316] text-white', done: 'bg-[#f97316]/20 text-[#f97316]', pending: 'bg-[rgba(255,255,255,0.06)] text-[rgba(255,255,255,0.40)]' },
                  actions: { active: 'bg-[#22c55e] text-white', done: 'bg-[#22c55e]/20 text-[#22c55e]', pending: 'bg-[rgba(255,255,255,0.06)] text-[rgba(255,255,255,0.40)]' },
                };
                const connectorColors = ['bg-[#2563EB]/40', 'bg-[#f97316]/40'];
                const colors = stepColors[s];
                return (
                  <div key={s} className="flex items-center gap-1">
                    {i > 0 && <span className={cn('w-4 h-[2px] rounded-full', i <= stepIndex ? connectorColors[i - 1] : 'bg-[rgba(255,255,255,0.08)]')} />}
                    <span
                      className={cn(
                        'text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full',
                        i === stepIndex ? colors.active : i < stepIndex ? colors.done : colors.pending
                      )}
                    >
                      {s === 'trigger' ? 'When' : s === 'conditions' ? 'If' : 'Then'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-bg-hover text-text-tertiary">
            <X size={18} />
          </button>
        </div>

        {/* Name input */}
        <div className="px-6 pt-4">
          <input
            type="text"
            placeholder="Automation name..."
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full h-9 px-3 rounded-lg bg-bg-tertiary border border-border-primary text-text-primary text-sm placeholder:text-text-tertiary focus:outline-none focus:border-accent-blue"
          />
        </div>

        {/* Step content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
          {/* WHEN — Trigger selection */}
          {step === 'trigger' && (
            <div>
              <h3 className="text-sm font-semibold text-text-secondary mb-3">When...</h3>
              <div className="grid grid-cols-3 gap-2">
                {triggerOptions.map((opt) => {
                  const Icon = opt.icon;
                  const selected = trigger?.type === opt.type;
                  return (
                    <button
                      key={opt.type}
                      onClick={() => handleSelectTrigger(opt.type)}
                      className={cn(
                        'flex flex-col items-center gap-1.5 p-3 rounded-[12px] border text-center transition-all',
                        selected
                          ? 'border-[#2563EB] bg-[#2563EB]/10 text-[#2563EB]'
                          : 'border-[rgba(255,255,255,0.08)] bg-[#111113] text-[rgba(255,255,255,0.65)] hover:border-[#2563EB]/40'
                      )}
                    >
                      <Icon size={20} />
                      <span className="text-xs font-medium leading-tight">{opt.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Trigger config (e.g., status_changed from/to) */}
              {trigger?.type === 'STATUS_CHANGED' && (
                <div className="mt-4 flex gap-3">
                  <div className="flex-1">
                    <label className="text-xs text-text-tertiary mb-1 block">From status (optional)</label>
                    <input
                      type="text"
                      placeholder="Any"
                      value={(triggerConfig.fromStatus as string) ?? ''}
                      onChange={(e) => handleTriggerConfigChange('fromStatus', e.target.value || undefined)}
                      className="w-full h-8 px-2 rounded-lg bg-bg-tertiary border border-border-primary text-text-primary text-xs focus:outline-none focus:border-accent-blue"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-text-tertiary mb-1 block">To status (optional)</label>
                    <input
                      type="text"
                      placeholder="Any"
                      value={(triggerConfig.toStatus as string) ?? ''}
                      onChange={(e) => handleTriggerConfigChange('toStatus', e.target.value || undefined)}
                      className="w-full h-8 px-2 rounded-lg bg-bg-tertiary border border-border-primary text-text-primary text-xs focus:outline-none focus:border-accent-blue"
                    />
                  </div>
                </div>
              )}

              {trigger?.type === 'PRIORITY_CHANGED' && (
                <div className="mt-4 flex gap-3">
                  <div className="flex-1">
                    <label className="text-xs text-text-tertiary mb-1 block">To priority (optional)</label>
                    <select
                      value={(triggerConfig.toPriority as string) ?? ''}
                      onChange={(e) => handleTriggerConfigChange('toPriority', e.target.value || undefined)}
                      className="w-full h-8 px-2 rounded-lg bg-bg-tertiary border border-border-primary text-text-primary text-xs focus:outline-none focus:border-accent-blue"
                    >
                      <option value="">Any</option>
                      <option value="URGENT">Urgent</option>
                      <option value="HIGH">High</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="LOW">Low</option>
                      <option value="NONE">None</option>
                    </select>
                  </div>
                </div>
              )}

              {trigger?.type === 'DUE_DATE_ARRIVES' && (
                <div className="mt-4">
                  <label className="text-xs text-text-tertiary mb-1 block">Offset (optional)</label>
                  <div className="flex gap-2 items-center">
                    <input
                      type="number"
                      placeholder="0"
                      value={(triggerConfig.offsetDays as number) ?? ''}
                      onChange={(e) => handleTriggerConfigChange('offsetDays', e.target.value ? Number(e.target.value) : undefined)}
                      className="w-20 h-8 px-2 rounded-lg bg-bg-tertiary border border-border-primary text-text-primary text-xs focus:outline-none focus:border-accent-blue"
                    />
                    <span className="text-xs text-text-tertiary">days before</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* IF — Conditions */}
          {step === 'conditions' && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-text-secondary">If... (optional)</h3>
                <button
                  onClick={addCondition}
                  className="text-xs text-accent-blue hover:underline"
                >
                  + Add condition
                </button>
              </div>

              {conditions.length === 0 && (
                <p className="text-xs text-text-tertiary italic">No conditions — automation will run for every trigger event.</p>
              )}

              {conditions.length > 1 && (
                <div className="flex gap-2 mb-3">
                  {(['AND', 'OR'] as const).map((logic) => (
                    <button
                      key={logic}
                      onClick={() => setConditionLogic(logic)}
                      className={cn(
                        'px-3 py-1 rounded-lg text-xs font-medium transition-colors',
                        conditionLogic === logic
                          ? 'bg-accent-blue text-white'
                          : 'bg-bg-tertiary text-text-secondary hover:bg-bg-hover'
                      )}
                    >
                      {logic}
                    </button>
                  ))}
                </div>
              )}

              <div className="space-y-2">
                {conditions.map((cond, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-3 rounded-[12px] border border-[#f97316]/30 bg-[#f97316]/5">
                    <select
                      value={cond.field}
                      onChange={(e) => updateCondition(idx, { field: e.target.value })}
                      className="h-8 px-2 rounded-lg bg-bg-tertiary border border-border-primary text-text-primary text-xs focus:outline-none focus:border-accent-blue"
                    >
                      {conditionFields.map((f) => (
                        <option key={f} value={f}>{f}</option>
                      ))}
                    </select>
                    <select
                      value={cond.operator}
                      onChange={(e) => updateCondition(idx, { operator: e.target.value as ConditionOperator })}
                      className="h-8 px-2 rounded-lg bg-bg-tertiary border border-border-primary text-text-primary text-xs focus:outline-none focus:border-accent-blue"
                    >
                      {conditionOperators.map((op) => (
                        <option key={op.value} value={op.value}>{op.label}</option>
                      ))}
                    </select>
                    {cond.operator !== 'is_set' && cond.operator !== 'is_not_set' && (
                      <input
                        type="text"
                        placeholder="Value"
                        value={(cond.value as string) ?? ''}
                        onChange={(e) => updateCondition(idx, { value: e.target.value })}
                        className="flex-1 h-8 px-2 rounded-lg bg-bg-tertiary border border-border-primary text-text-primary text-xs focus:outline-none focus:border-accent-blue"
                      />
                    )}
                    <button
                      onClick={() => removeCondition(idx)}
                      className="p-1 text-text-tertiary hover:text-accent-red"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* THEN — Actions */}
          {step === 'actions' && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-text-secondary">Then...</h3>
              </div>

              {/* Existing actions */}
              <div className="space-y-2 mb-4">
                {actions.map((action, idx) => {
                  const opt = actionOptions.find((o) => o.type === action.type);
                  const Icon = opt?.icon ?? Settings;
                  return (
                    <div key={idx} className="flex items-start gap-2 p-3 rounded-[12px] border border-[#22c55e]/30 bg-[#22c55e]/5">
                      <button
                        className="mt-0.5 text-text-tertiary cursor-grab"
                        onMouseDown={(e) => e.preventDefault()}
                        aria-label="Drag to reorder"
                      >
                        <GripVertical size={14} />
                      </button>
                      <span className="text-xs font-medium text-text-tertiary w-5 mt-0.5">{idx + 1}.</span>
                      <Icon size={16} className="text-accent-blue mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-text-primary">{opt?.label ?? action.type}</p>

                        {/* Inline config for common action types */}
                        {action.type === 'CHANGE_STATUS' && (
                          <input
                            type="text"
                            placeholder="New status..."
                            value={(action.config.status as string) ?? ''}
                            onChange={(e) => updateActionConfig(idx, 'status', e.target.value)}
                            className="mt-1 w-full h-7 px-2 rounded bg-bg-secondary border border-border-primary text-text-primary text-xs focus:outline-none focus:border-accent-blue"
                          />
                        )}
                        {action.type === 'CHANGE_PRIORITY' && (
                          <select
                            value={(action.config.priority as string) ?? ''}
                            onChange={(e) => updateActionConfig(idx, 'priority', e.target.value)}
                            className="mt-1 w-full h-7 px-2 rounded bg-bg-secondary border border-border-primary text-text-primary text-xs focus:outline-none focus:border-accent-blue"
                          >
                            <option value="">Select priority...</option>
                            <option value="URGENT">Urgent</option>
                            <option value="HIGH">High</option>
                            <option value="MEDIUM">Medium</option>
                            <option value="LOW">Low</option>
                            <option value="NONE">None</option>
                          </select>
                        )}
                        {(action.type === 'ADD_ASSIGNEE' || action.type === 'REMOVE_ASSIGNEE') && (
                          <input
                            type="text"
                            placeholder="User ID or email..."
                            value={(action.config.userId as string) ?? ''}
                            onChange={(e) => updateActionConfig(idx, 'userId', e.target.value)}
                            className="mt-1 w-full h-7 px-2 rounded bg-bg-secondary border border-border-primary text-text-primary text-xs focus:outline-none focus:border-accent-blue"
                          />
                        )}
                        {action.type === 'SET_DUE_DATE' && (
                          <div className="flex gap-2 mt-1">
                            <input
                              type="text"
                              placeholder="+N days or date"
                              value={(action.config.value as string) ?? ''}
                              onChange={(e) => updateActionConfig(idx, 'value', e.target.value)}
                              className="flex-1 h-7 px-2 rounded bg-bg-secondary border border-border-primary text-text-primary text-xs focus:outline-none focus:border-accent-blue"
                            />
                          </div>
                        )}
                        {action.type === 'ADD_TAG' && (
                          <input
                            type="text"
                            placeholder="Tag name..."
                            value={(action.config.tag as string) ?? ''}
                            onChange={(e) => updateActionConfig(idx, 'tag', e.target.value)}
                            className="mt-1 w-full h-7 px-2 rounded bg-bg-secondary border border-border-primary text-text-primary text-xs focus:outline-none focus:border-accent-blue"
                          />
                        )}
                        {action.type === 'MOVE_TO_LIST' && (
                          <input
                            type="text"
                            placeholder="List ID..."
                            value={(action.config.listId as string) ?? ''}
                            onChange={(e) => updateActionConfig(idx, 'listId', e.target.value)}
                            className="mt-1 w-full h-7 px-2 rounded bg-bg-secondary border border-border-primary text-text-primary text-xs focus:outline-none focus:border-accent-blue"
                          />
                        )}
                        {action.type === 'CREATE_SUBTASK' && (
                          <input
                            type="text"
                            placeholder="Subtask name..."
                            value={(action.config.name as string) ?? ''}
                            onChange={(e) => updateActionConfig(idx, 'name', e.target.value)}
                            className="mt-1 w-full h-7 px-2 rounded bg-bg-secondary border border-border-primary text-text-primary text-xs focus:outline-none focus:border-accent-blue"
                          />
                        )}
                        {action.type === 'ADD_COMMENT' && (
                          <textarea
                            placeholder="Comment text..."
                            value={(action.config.text as string) ?? ''}
                            onChange={(e) => updateActionConfig(idx, 'text', e.target.value)}
                            rows={2}
                            className="mt-1 w-full px-2 py-1 rounded bg-bg-secondary border border-border-primary text-text-primary text-xs focus:outline-none focus:border-accent-blue resize-none"
                          />
                        )}
                        {action.type === 'SEND_NOTIFICATION' && (
                          <input
                            type="text"
                            placeholder="Notification message..."
                            value={(action.config.message as string) ?? ''}
                            onChange={(e) => updateActionConfig(idx, 'message', e.target.value)}
                            className="mt-1 w-full h-7 px-2 rounded bg-bg-secondary border border-border-primary text-text-primary text-xs focus:outline-none focus:border-accent-blue"
                          />
                        )}
                      </div>
                      <button
                        onClick={() => removeAction(idx)}
                        className="p-1 text-text-tertiary hover:text-accent-red flex-shrink-0"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Add action grid */}
              <p className="text-xs text-text-tertiary mb-2">Add an action:</p>
              <div className="grid grid-cols-4 gap-1.5">
                {actionOptions.map((opt) => {
                  const Icon = opt.icon;
                  return (
                    <button
                      key={opt.type}
                      onClick={() => addAction(opt.type)}
                      className="flex flex-col items-center gap-1 p-2 rounded-[12px] border border-[rgba(255,255,255,0.08)] bg-[#111113] text-[rgba(255,255,255,0.65)] hover:border-[#22c55e]/40 hover:text-[#22c55e] transition-all text-center"
                    >
                      <Icon size={14} />
                      <span className="text-[10px] leading-tight">{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Summary */}
        {summaryText && (
          <div className="px-6 py-2 border-t border-border-primary bg-bg-tertiary/50">
            <p className="text-xs text-text-secondary italic">{summaryText}</p>
          </div>
        )}

        {/* Footer nav */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border-primary">
          <button
            onClick={() => {
              if (stepIndex > 0) setStep(steps[stepIndex - 1]);
              else onClose();
            }}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm text-text-secondary hover:bg-bg-hover"
          >
            <ChevronLeft size={14} />
            {stepIndex > 0 ? 'Back' : 'Cancel'}
          </button>

          <div className="flex gap-2">
            {stepIndex < steps.length - 1 ? (
              <button
                onClick={() => canProceed && setStep(steps[stepIndex + 1])}
                disabled={!canProceed}
                className={cn(
                  'flex items-center gap-1 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors',
                  canProceed
                    ? 'bg-accent-blue text-white hover:bg-accent-blue/90'
                    : 'bg-bg-tertiary text-text-tertiary cursor-not-allowed'
                )}
              >
                Next
                <ChevronRight size={14} />
              </button>
            ) : (
              <button
                onClick={handleSave}
                disabled={!name.trim() || !trigger || actions.length === 0 || isSaving}
                className={cn(
                  'px-4 py-1.5 rounded-lg text-sm font-medium transition-colors',
                  name.trim() && trigger && actions.length > 0 && !isSaving
                    ? 'bg-accent-blue text-white hover:bg-accent-blue/90'
                    : 'bg-bg-tertiary text-text-tertiary cursor-not-allowed'
                )}
              >
                {isSaving ? 'Saving...' : isEditing ? 'Update' : 'Create'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
