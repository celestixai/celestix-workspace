import { useState, useRef, useEffect } from 'react';
import { useTaskTypes, type TaskType } from '@/hooks/useTaskTypes';
import { cn } from '@/lib/utils';
import { ChevronDown, CheckSquare, Bug, Star, Flag, Circle } from 'lucide-react';

const ICON_MAP: Record<string, React.ElementType> = {
  'check-square': CheckSquare,
  bug: Bug,
  star: Star,
  flag: Flag,
};

interface TaskTypeSelectorProps {
  spaceId: string;
  value?: string;
  onChange: (typeId: string) => void;
}

export function TaskTypeSelector({ spaceId, value, onChange }: TaskTypeSelectorProps) {
  const { data: taskTypes = [] } = useTaskTypes(spaceId);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selected = taskTypes.find((t) => t.id === value);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function renderIcon(taskType: TaskType, size = 14) {
    const IconComp = taskType.icon ? ICON_MAP[taskType.icon] : null;
    if (IconComp) {
      return <IconComp size={size} style={{ color: taskType.color || undefined }} />;
    }
    return <Circle size={size} style={{ color: taskType.color || undefined, fill: taskType.color || undefined }} />;
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-border-secondary bg-bg-tertiary text-sm text-text-primary hover:border-border-primary transition-colors min-w-[120px]"
      >
        {selected ? (
          <>
            {renderIcon(selected)}
            <span className="truncate">{selected.name}</span>
          </>
        ) : (
          <span className="text-text-tertiary">Select type...</span>
        )}
        <ChevronDown size={12} className="ml-auto text-text-tertiary flex-shrink-0" />
      </button>

      {open && taskTypes.length > 0 && (
        <div className="absolute z-50 mt-1 w-full min-w-[160px] py-1 rounded-lg border border-border-secondary bg-bg-secondary shadow-lg">
          {taskTypes.map((tt) => (
            <button
              key={tt.id}
              type="button"
              onClick={() => {
                onChange(tt.id);
                setOpen(false);
              }}
              className={cn(
                'flex items-center gap-2 w-full px-3 py-1.5 text-sm text-left transition-colors',
                tt.id === value
                  ? 'bg-accent-blue/10 text-accent-blue'
                  : 'text-text-primary hover:bg-bg-hover'
              )}
            >
              {renderIcon(tt)}
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: tt.color || '#888' }}
              />
              <span className="truncate">{tt.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
