const GROUP_OPTIONS = [
  { value: '', label: 'None' },
  { value: 'status', label: 'Status' },
  { value: 'priority', label: 'Priority' },
  { value: 'assignee', label: 'Assignee' },
  { value: 'tags', label: 'Tag' },
  { value: 'taskType', label: 'Task Type' },
  { value: 'dueDate:day', label: 'Due Date (Day)' },
  { value: 'dueDate:week', label: 'Due Date (Week)' },
  { value: 'dueDate:month', label: 'Due Date (Month)' },
];

interface GroupBySelectorProps {
  groupBy?: string;
  subGroupBy?: string;
  onChange: (groupBy: string | undefined, subGroupBy?: string | undefined) => void;
  onClose: () => void;
}

export function GroupBySelector({ groupBy, subGroupBy, onChange, onClose }: GroupBySelectorProps) {
  return (
    <div
      className="absolute top-full left-0 mt-1 z-50 bg-bg-secondary border border-border-secondary rounded-lg shadow-lg p-3 min-w-[220px]"
      onClick={(e) => e.stopPropagation()}
    >
      <span className="text-xs font-medium text-text-primary block mb-2">Group by</span>

      <div className="space-y-0.5">
        {GROUP_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => {
              const newGroupBy = opt.value || undefined;
              // Clear sub-group if primary is cleared
              const newSubGroupBy = newGroupBy ? subGroupBy : undefined;
              onChange(newGroupBy, newSubGroupBy);
            }}
            className={`w-full text-left px-2.5 py-1.5 text-xs rounded transition-colors ${
              (groupBy ?? '') === opt.value
                ? 'text-accent-blue bg-accent-blue/10'
                : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Sub-group */}
      {groupBy && (
        <>
          <div className="border-t border-border-secondary my-2" />
          <span className="text-xs font-medium text-text-primary block mb-2">Sub-group by</span>
          <div className="space-y-0.5">
            {GROUP_OPTIONS.filter((opt) => opt.value !== groupBy).map((opt) => (
              <button
                key={opt.value}
                onClick={() => {
                  onChange(groupBy, opt.value || undefined);
                }}
                className={`w-full text-left px-2.5 py-1.5 text-xs rounded transition-colors ${
                  (subGroupBy ?? '') === opt.value
                    ? 'text-accent-blue bg-accent-blue/10'
                    : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </>
      )}

      {/* Collapse/Expand actions */}
      {groupBy && (
        <>
          <div className="border-t border-border-secondary my-2" />
          <div className="flex items-center gap-2">
            <button className="text-[10px] text-text-tertiary hover:text-text-primary transition-colors">
              Collapse All
            </button>
            <span className="text-text-tertiary text-[10px]">/</span>
            <button className="text-[10px] text-text-tertiary hover:text-text-primary transition-colors">
              Expand All
            </button>
          </div>
        </>
      )}
    </div>
  );
}
