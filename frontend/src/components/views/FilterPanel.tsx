import { useCallback } from 'react';
import type { FilterCondition } from '@/hooks/useViews';
import { Plus, X } from 'lucide-react';

const FIELD_OPTIONS = [
  { value: 'status', label: 'Status' },
  { value: 'priority', label: 'Priority' },
  { value: 'assignee', label: 'Assignee' },
  { value: 'dueDate', label: 'Due Date' },
  { value: 'startDate', label: 'Start Date' },
  { value: 'tags', label: 'Tags' },
  { value: 'taskType', label: 'Task Type' },
];

const OPERATORS_BY_TYPE: Record<string, { value: string; label: string }[]> = {
  text: [
    { value: 'is', label: 'is' },
    { value: 'is_not', label: 'is not' },
    { value: 'contains', label: 'contains' },
    { value: 'is_set', label: 'is set' },
    { value: 'is_not_set', label: 'is not set' },
  ],
  number: [
    { value: 'eq', label: '=' },
    { value: 'neq', label: '!=' },
    { value: 'gt', label: '>' },
    { value: 'lt', label: '<' },
    { value: 'gte', label: '>=' },
    { value: 'lte', label: '<=' },
  ],
  date: [
    { value: 'is_before', label: 'is before' },
    { value: 'is_after', label: 'is after' },
    { value: 'between', label: 'between' },
    { value: 'is_within', label: 'is within' },
  ],
  select: [
    { value: 'is', label: 'is' },
    { value: 'is_not', label: 'is not' },
  ],
};

function getFieldType(field: string): string {
  if (['dueDate', 'startDate'].includes(field)) return 'date';
  if (['status', 'priority', 'assignee', 'tags', 'taskType'].includes(field)) return 'select';
  return 'text';
}

const PRIORITY_OPTIONS = ['urgent', 'high', 'medium', 'low', 'none'];
const STATUS_OPTIONS = ['open', 'in_progress', 'review', 'done', 'closed'];

interface FilterPanelProps {
  filters: FilterCondition[];
  onChange: (filters: FilterCondition[]) => void;
  onClose: () => void;
}

export function FilterPanel({ filters, onChange, onClose }: FilterPanelProps) {
  const addFilter = useCallback(() => {
    onChange([...filters, { field: 'status', operator: 'is', value: '' }]);
  }, [filters, onChange]);

  const updateFilter = useCallback(
    (index: number, updates: Partial<FilterCondition>) => {
      const next = filters.map((f, i) => (i === index ? { ...f, ...updates } : f));
      // If field changed, reset operator and value
      if (updates.field) {
        const fieldType = getFieldType(updates.field);
        const operators = OPERATORS_BY_TYPE[fieldType] ?? OPERATORS_BY_TYPE.text;
        next[index] = { ...next[index], operator: operators[0].value, value: '' };
      }
      onChange(next);
    },
    [filters, onChange],
  );

  const removeFilter = useCallback(
    (index: number) => {
      onChange(filters.filter((_, i) => i !== index));
    },
    [filters, onChange],
  );

  return (
    <div
      className="absolute top-full left-0 mt-1 z-50 bg-bg-secondary border border-border-secondary rounded-lg shadow-lg p-3 min-w-[380px]"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-text-primary">Filters</span>
        {filters.length > 0 && (
          <button
            onClick={() => onChange([])}
            className="text-[10px] text-text-tertiary hover:text-accent-red transition-colors"
          >
            Clear all
          </button>
        )}
      </div>

      <div className="space-y-2">
        {filters.map((filter, index) => {
          const fieldType = getFieldType(filter.field);
          const operators = OPERATORS_BY_TYPE[fieldType] ?? OPERATORS_BY_TYPE.text;
          const needsValue = !['is_set', 'is_not_set'].includes(filter.operator);

          return (
            <div key={index} className="flex items-center gap-1.5">
              {/* Field */}
              <select
                value={filter.field}
                onChange={(e) => updateFilter(index, { field: e.target.value })}
                className="bg-bg-tertiary border border-border-secondary rounded px-2 py-1 text-xs text-text-primary outline-none min-w-[90px]"
              >
                {FIELD_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>

              {/* Operator */}
              <select
                value={filter.operator}
                onChange={(e) => updateFilter(index, { operator: e.target.value })}
                className="bg-bg-tertiary border border-border-secondary rounded px-2 py-1 text-xs text-text-primary outline-none min-w-[80px]"
              >
                {operators.map((op) => (
                  <option key={op.value} value={op.value}>{op.label}</option>
                ))}
              </select>

              {/* Value */}
              {needsValue && (
                <>
                  {filter.field === 'priority' ? (
                    <select
                      value={String(filter.value)}
                      onChange={(e) => updateFilter(index, { value: e.target.value })}
                      className="bg-bg-tertiary border border-border-secondary rounded px-2 py-1 text-xs text-text-primary outline-none flex-1 min-w-[80px]"
                    >
                      <option value="">Select...</option>
                      {PRIORITY_OPTIONS.map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  ) : filter.field === 'status' ? (
                    <select
                      value={String(filter.value)}
                      onChange={(e) => updateFilter(index, { value: e.target.value })}
                      className="bg-bg-tertiary border border-border-secondary rounded px-2 py-1 text-xs text-text-primary outline-none flex-1 min-w-[80px]"
                    >
                      <option value="">Select...</option>
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  ) : ['dueDate', 'startDate'].includes(filter.field) ? (
                    <input
                      type="date"
                      value={String(filter.value ?? '')}
                      onChange={(e) => updateFilter(index, { value: e.target.value })}
                      className="bg-bg-tertiary border border-border-secondary rounded px-2 py-1 text-xs text-text-primary outline-none flex-1 min-w-[100px]"
                    />
                  ) : (
                    <input
                      type="text"
                      value={String(filter.value ?? '')}
                      onChange={(e) => updateFilter(index, { value: e.target.value })}
                      placeholder="Value..."
                      className="bg-bg-tertiary border border-border-secondary rounded px-2 py-1 text-xs text-text-primary placeholder:text-text-tertiary outline-none flex-1 min-w-[80px]"
                    />
                  )}
                </>
              )}

              {/* Remove */}
              <button
                onClick={() => removeFilter(index)}
                className="text-text-tertiary hover:text-accent-red p-0.5 transition-colors"
              >
                <X size={12} />
              </button>
            </div>
          );
        })}
      </div>

      <button
        onClick={addFilter}
        className="flex items-center gap-1.5 mt-2 text-xs text-text-tertiary hover:text-accent-blue transition-colors"
      >
        <Plus size={12} />
        Add filter
      </button>
    </div>
  );
}
