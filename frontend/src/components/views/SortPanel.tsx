import { useCallback } from 'react';
import type { SortCondition } from '@/hooks/useViews';
import { Plus, X, ArrowUp, ArrowDown } from 'lucide-react';

const SORT_FIELD_OPTIONS = [
  { value: 'status', label: 'Status' },
  { value: 'priority', label: 'Priority' },
  { value: 'assignee', label: 'Assignee' },
  { value: 'dueDate', label: 'Due Date' },
  { value: 'startDate', label: 'Start Date' },
  { value: 'tags', label: 'Tags' },
  { value: 'taskType', label: 'Task Type' },
  { value: 'createdAt', label: 'Created Date' },
  { value: 'updatedAt', label: 'Updated Date' },
  { value: 'position', label: 'Position' },
];

interface SortPanelProps {
  sorts: SortCondition[];
  onChange: (sorts: SortCondition[]) => void;
  onClose: () => void;
}

export function SortPanel({ sorts, onChange, onClose }: SortPanelProps) {
  const addSort = useCallback(() => {
    onChange([...sorts, { field: 'priority', direction: 'desc' }]);
  }, [sorts, onChange]);

  const updateSort = useCallback(
    (index: number, updates: Partial<SortCondition>) => {
      onChange(sorts.map((s, i) => (i === index ? { ...s, ...updates } : s)));
    },
    [sorts, onChange],
  );

  const removeSort = useCallback(
    (index: number) => {
      onChange(sorts.filter((_, i) => i !== index));
    },
    [sorts, onChange],
  );

  return (
    <div
      className="absolute top-full left-0 mt-1 z-50 bg-bg-secondary border border-border-secondary rounded-lg shadow-lg p-3 min-w-[300px]"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-text-primary">Sort</span>
        {sorts.length > 0 && (
          <button
            onClick={() => onChange([])}
            className="text-[10px] text-text-tertiary hover:text-accent-red transition-colors"
          >
            Clear all
          </button>
        )}
      </div>

      <div className="space-y-2">
        {sorts.map((sort, index) => (
          <div key={index} className="flex items-center gap-1.5">
            {index > 0 && (
              <span className="text-[10px] text-text-tertiary mr-1">then</span>
            )}

            {/* Field */}
            <select
              value={sort.field}
              onChange={(e) => updateSort(index, { field: e.target.value })}
              className="bg-bg-tertiary border border-border-secondary rounded px-2 py-1 text-xs text-text-primary outline-none flex-1"
            >
              {SORT_FIELD_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>

            {/* Direction toggle */}
            <button
              onClick={() => updateSort(index, { direction: sort.direction === 'asc' ? 'desc' : 'asc' })}
              className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-bg-tertiary border border-border-secondary text-text-primary hover:bg-bg-hover transition-colors"
              title={sort.direction === 'asc' ? 'Ascending' : 'Descending'}
            >
              {sort.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
              {sort.direction === 'asc' ? 'Asc' : 'Desc'}
            </button>

            {/* Remove */}
            <button
              onClick={() => removeSort(index)}
              className="text-text-tertiary hover:text-accent-red p-0.5 transition-colors"
            >
              <X size={12} />
            </button>
          </div>
        ))}
      </div>

      <button
        onClick={addSort}
        className="flex items-center gap-1.5 mt-2 text-xs text-text-tertiary hover:text-accent-blue transition-colors"
      >
        <Plus size={12} />
        Add sort
      </button>
    </div>
  );
}
