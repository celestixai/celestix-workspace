import { useState, useRef, useEffect, useCallback, type KeyboardEvent } from 'react';
import { Sparkles, X } from 'lucide-react';
import { useAIChat, useAIStatus } from '@/hooks/useAI';

interface AICommandBarProps {
  open: boolean;
  onClose: () => void;
}

export function AICommandBar({ open, onClose }: AICommandBarProps) {
  const { data: status } = useAIStatus();
  const { messages, isStreaming, error, sendMessage, clearMessages } = useAIChat();
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const isAvailable = status?.isAvailable ?? false;

  // Focus input when opened
  useEffect(() => {
    if (open) {
      clearMessages();
      setInput('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const handleSubmit = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming || !isAvailable) return;
    setInput('');
    sendMessage(trimmed);
  }, [input, isStreaming, isAvailable, sendMessage]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  // Last assistant message for display
  const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant');

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-[60] bg-black/50" onClick={onClose} />

      {/* Command bar */}
      <div className="fixed inset-x-0 top-[20%] z-[61] flex justify-center px-4">
        <div className="w-full max-w-lg bg-bg-secondary border border-border-primary rounded-xl shadow-2xl overflow-hidden">
          {/* Input row */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border-primary">
            <Sparkles size={16} className="text-accent-purple flex-shrink-0" />
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isAvailable ? 'Ask Celestix Brain...' : 'AI is offline'}
              disabled={!isAvailable}
              className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-quaternary focus:outline-none disabled:opacity-50"
            />
            <button
              onClick={onClose}
              aria-label="Close AI command bar"
              className="p-1 rounded hover:bg-bg-hover text-text-tertiary hover:text-text-primary transition-colors"
            >
              <X size={14} />
            </button>
          </div>

          {/* Response area */}
          {!isAvailable && (
            <div className="px-4 py-4 text-sm text-text-tertiary text-center">
              AI is offline — Start Ollama to enable AI features
            </div>
          )}

          {isAvailable && lastAssistant && (
            <div className="px-4 py-3 max-h-64 overflow-y-auto">
              <p className="text-sm text-text-primary whitespace-pre-wrap">
                {lastAssistant.content || (
                  <span className="inline-flex gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-text-tertiary animate-pulse" />
                    <span className="w-1.5 h-1.5 rounded-full bg-text-tertiary animate-pulse [animation-delay:150ms]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-text-tertiary animate-pulse [animation-delay:300ms]" />
                  </span>
                )}
              </p>
            </div>
          )}

          {error && (
            <div className="px-4 py-2 text-xs text-accent-red">{error}</div>
          )}

          {/* Footer hint */}
          <div className="px-4 py-2 border-t border-border-primary flex items-center justify-between text-[10px] text-text-quaternary">
            <span>Enter to send</span>
            <span>Esc to close</span>
          </div>
        </div>
      </div>
    </>
  );
}
