import { useState, useCallback, useRef, useEffect } from 'react';
import { Sparkles, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useAIGenerate, useAIStatus } from '@/hooks/useAI';

interface AIWriteAssistProps {
  selectedText?: string;
  onInsert: (text: string) => void;
  onReplace: (text: string) => void;
}

const actions = [
  { id: 'write', label: 'Write with AI', promptPrefix: 'Write the following: ' },
  { id: 'improve', label: 'Improve writing', promptPrefix: 'Improve the following text, keeping meaning intact:\n\n' },
  { id: 'shorter', label: 'Make shorter', promptPrefix: 'Make the following text shorter and more concise:\n\n' },
  { id: 'longer', label: 'Make longer', promptPrefix: 'Expand and elaborate on the following text:\n\n' },
  { id: 'tone', label: 'Change tone', promptPrefix: 'Rewrite the following text in a more professional tone:\n\n' },
  { id: 'translate', label: 'Translate', promptPrefix: 'Translate the following text to English:\n\n' },
] as const;

export function AIWriteAssist({ selectedText, onInsert, onReplace }: AIWriteAssistProps) {
  const { data: status } = useAIStatus();
  const generate = useAIGenerate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isAvailable = status?.isAvailable ?? false;

  // Close dropdown on outside click
  useEffect(() => {
    if (!dropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [dropdownOpen]);

  const handleAction = useCallback(
    async (action: (typeof actions)[number]) => {
      setDropdownOpen(false);
      const text = selectedText || '';
      const prompt = action.promptPrefix + text;
      try {
        const res = await generate.mutateAsync({ prompt, type: action.id });
        setResult(typeof res === 'string' ? res : res.text ?? res.content ?? JSON.stringify(res));
      } catch {
        setResult(null);
      }
    },
    [selectedText, generate],
  );

  const handleInsert = useCallback(() => {
    if (result) {
      onInsert(result);
      setResult(null);
    }
  }, [result, onInsert]);

  const handleReplace = useCallback(() => {
    if (result) {
      onReplace(result);
      setResult(null);
    }
  }, [result, onReplace]);

  return (
    <div ref={dropdownRef} className="relative inline-block">
      {/* Trigger */}
      <button
        onClick={() => setDropdownOpen(!dropdownOpen)}
        disabled={!isAvailable}
        title={isAvailable ? 'AI Writing Assist' : 'Requires AI'}
        className={cn(
          'inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md transition-colors',
          isAvailable
            ? 'text-accent-purple hover:bg-bg-hover'
            : 'text-text-quaternary cursor-not-allowed',
        )}
      >
        <Sparkles size={12} />
        <ChevronDown size={10} />
      </button>

      {/* Dropdown */}
      {dropdownOpen && isAvailable && (
        <div className="absolute right-0 top-full mt-1 w-48 bg-bg-secondary border border-border-primary rounded-lg shadow-lg z-50 py-1">
          {actions.map((action) => (
            <button
              key={action.id}
              onClick={() => handleAction(action)}
              disabled={generate.isPending}
              className="w-full text-left px-3 py-1.5 text-xs text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors disabled:opacity-50"
            >
              {action.label}
            </button>
          ))}
        </div>
      )}

      {/* Result preview */}
      {result && (
        <div className="absolute right-0 top-full mt-1 w-72 bg-bg-secondary border border-border-primary rounded-lg shadow-lg z-50 p-3">
          <p className="text-xs text-text-primary whitespace-pre-wrap max-h-40 overflow-y-auto mb-3">
            {result}
          </p>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setResult(null)}>
              Discard
            </Button>
            <Button size="sm" variant="secondary" onClick={handleReplace}>
              Replace
            </Button>
            <Button size="sm" onClick={handleInsert}>
              Insert
            </Button>
          </div>
        </div>
      )}

      {/* Loading overlay */}
      {generate.isPending && (
        <div className="absolute right-0 top-full mt-1 w-48 bg-bg-secondary border border-border-primary rounded-lg shadow-lg z-50 py-3 flex justify-center">
          <svg className="animate-spin h-4 w-4 text-accent-purple" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      )}
    </div>
  );
}
