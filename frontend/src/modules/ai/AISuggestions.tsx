import { useState, useCallback } from 'react';
import { Sparkles, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAIAutofill, useAIStatus } from '@/hooks/useAI';

interface Suggestions {
  description?: string;
  priority?: string;
  estimatedHours?: number;
  taskType?: string;
}

interface AISuggestionsProps {
  taskTitle: string;
  onApply: (suggestions: Partial<Suggestions>) => void;
}

const suggestionFields: Array<{ key: keyof Suggestions; label: string }> = [
  { key: 'description', label: 'Description' },
  { key: 'priority', label: 'Priority' },
  { key: 'estimatedHours', label: 'Estimated Hours' },
  { key: 'taskType', label: 'Task Type' },
];

export function AISuggestions({ taskTitle, onApply }: AISuggestionsProps) {
  const { data: status } = useAIStatus();
  const autofill = useAIAutofill();
  const [suggestions, setSuggestions] = useState<Suggestions | null>(null);
  const [selected, setSelected] = useState<Set<keyof Suggestions>>(
    new Set(['description', 'priority', 'estimatedHours', 'taskType']),
  );

  const isAvailable = status?.isAvailable ?? false;

  const handleAutofill = useCallback(async () => {
    if (!taskTitle.trim()) return;
    const result = await autofill.mutateAsync({ title: taskTitle });
    setSuggestions(result);
  }, [taskTitle, autofill]);

  const toggleField = useCallback((key: keyof Suggestions) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const handleApply = useCallback(() => {
    if (!suggestions) return;
    const partial: Partial<Suggestions> = {};
    for (const key of selected) {
      if (suggestions[key] !== undefined) {
        (partial as Record<string, unknown>)[key] = suggestions[key];
      }
    }
    onApply(partial);
    setSuggestions(null);
  }, [suggestions, selected, onApply]);

  return (
    <div className="inline-flex flex-col">
      {/* Trigger button */}
      <button
        onClick={handleAutofill}
        disabled={!isAvailable || autofill.isPending || !taskTitle.trim()}
        title={isAvailable ? 'AI Autofill' : 'Requires AI'}
        className={cn(
          'inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md transition-colors',
          isAvailable
            ? 'text-accent-purple hover:bg-bg-hover'
            : 'text-text-quaternary cursor-not-allowed',
        )}
      >
        {autofill.isPending ? (
          <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : (
          <Sparkles size={12} />
        )}
        AI Autofill
      </button>

      {/* Suggestions panel */}
      {suggestions && (
        <div className="mt-2 rounded-lg border border-border-primary bg-bg-secondary p-3 text-sm space-y-2 w-72">
          {suggestionFields.map(({ key, label }) => {
            const value = suggestions[key];
            if (value === undefined) return null;
            const isSelected = selected.has(key);
            return (
              <label
                key={key}
                className="flex items-start gap-2 cursor-pointer hover:bg-bg-hover rounded-md p-1.5 -mx-1.5 transition-colors"
              >
                <span
                  className={cn(
                    'mt-0.5 w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors',
                    isSelected
                      ? 'bg-accent-blue border-accent-blue text-white'
                      : 'border-border-secondary',
                  )}
                  onClick={(e) => {
                    e.preventDefault();
                    toggleField(key);
                  }}
                >
                  {isSelected && <Check size={10} />}
                </span>
                <div className="min-w-0">
                  <span className="text-text-tertiary text-xs">{label}</span>
                  <p className="text-text-primary text-xs break-words">
                    {String(value)}
                  </p>
                </div>
              </label>
            );
          })}

          <div className="flex justify-end gap-2 pt-1">
            <Button size="sm" variant="ghost" onClick={() => setSuggestions(null)}>
              Discard
            </Button>
            <Button size="sm" onClick={handleApply} disabled={selected.size === 0}>
              Apply Selected
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
