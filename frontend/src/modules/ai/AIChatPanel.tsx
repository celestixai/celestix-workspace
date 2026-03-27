import { useState, useRef, useEffect, useCallback, type KeyboardEvent } from 'react';
import { X, Sparkles, Send, Plus, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useAIChat, useAIStatus, type ChatMessage } from '@/hooks/useAI';

interface AIChatPanelProps {
  open: boolean;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Chat message bubble
// ---------------------------------------------------------------------------

function ChatBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';

  return (
    <div className={cn('flex w-full', isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[85%] rounded-xl px-3 py-2 text-sm whitespace-pre-wrap break-words',
          isUser
            ? 'bg-accent-blue text-white rounded-br-sm'
            : 'bg-bg-tertiary text-text-primary rounded-bl-sm',
        )}
      >
        {message.content || <PulsingDots />}
      </div>
    </div>
  );
}

function PulsingDots() {
  return (
    <span className="inline-flex gap-1 py-1" aria-label="AI is thinking">
      <span className="w-1.5 h-1.5 rounded-full bg-text-tertiary animate-pulse" />
      <span className="w-1.5 h-1.5 rounded-full bg-text-tertiary animate-pulse [animation-delay:150ms]" />
      <span className="w-1.5 h-1.5 rounded-full bg-text-tertiary animate-pulse [animation-delay:300ms]" />
    </span>
  );
}

// ---------------------------------------------------------------------------
// Quick action buttons
// ---------------------------------------------------------------------------

const quickActions = [
  { label: 'Summarize', prompt: 'Summarize my recent activity and open tasks.' },
  { label: 'Write Description', prompt: 'Help me write a task description.' },
  { label: 'Generate Subtasks', prompt: 'Generate subtasks for my current task.' },
];

// ---------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------

export function AIChatPanel({ open, onClose }: AIChatPanelProps) {
  const { data: status } = useAIStatus();
  const { messages, isStreaming, error, sendMessage, clearMessages } = useAIChat();
  const [input, setInput] = useState('');
  const [conversationId] = useState<string | undefined>(undefined);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Focus textarea when panel opens
  useEffect(() => {
    if (open) {
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [open]);

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;
    setInput('');
    sendMessage(trimmed, conversationId);
  }, [input, isStreaming, sendMessage, conversationId]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const handleQuickAction = useCallback(
    (prompt: string) => {
      if (isStreaming) return;
      sendMessage(prompt, conversationId);
    },
    [isStreaming, sendMessage, conversationId],
  );

  const isAvailable = status?.isAvailable ?? false;

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40" onClick={onClose} />

      {/* Panel */}
      <div
        className="fixed right-0 top-0 h-full w-[calc(100vw-3rem)] sm:w-[400px] bg-bg-secondary border-l border-border-primary z-50 animate-slide-in-right flex flex-col shadow-lg"
        role="dialog"
        aria-modal="true"
        aria-label="AI Chat Panel"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-primary flex-shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-accent-purple" />
            <h2 className="text-sm font-semibold text-text-primary">Celestix Brain</h2>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => clearMessages()}
              aria-label="New conversation"
              className="p-1.5 rounded-lg hover:bg-bg-hover text-text-tertiary hover:text-text-primary transition-colors"
              title="New conversation"
            >
              <Plus size={14} />
            </button>
            <button
              onClick={onClose}
              aria-label="Close AI panel"
              className="p-1.5 rounded-lg hover:bg-bg-hover text-text-tertiary hover:text-text-primary transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Body */}
        {!isAvailable ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 text-center">
            <Sparkles size={32} className="text-text-quaternary" />
            <p className="text-sm text-text-tertiary">
              AI is offline — Start Ollama to enable AI features
            </p>
          </div>
        ) : (
          <>
            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
                  <MessageSquare size={28} className="text-text-quaternary" />
                  <p className="text-sm text-text-tertiary">
                    Ask Celestix Brain anything about your workspace.
                  </p>
                </div>
              )}
              {messages.map((msg, i) => (
                <ChatBubble key={i} message={msg} />
              ))}
              {error && (
                <p className="text-xs text-accent-red text-center">{error}</p>
              )}
            </div>

            {/* Quick actions */}
            <div className="px-4 pb-2 flex gap-1.5 flex-wrap">
              {quickActions.map((a) => (
                <button
                  key={a.label}
                  onClick={() => handleQuickAction(a.prompt)}
                  disabled={isStreaming}
                  className="text-xs px-2.5 py-1 rounded-full bg-bg-tertiary text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors disabled:opacity-50"
                >
                  {a.label}
                </button>
              ))}
            </div>

            {/* Input */}
            <div className="px-4 pb-4 flex gap-2 items-end border-t border-border-primary pt-3">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask Celestix Brain..."
                rows={1}
                className="flex-1 resize-none rounded-lg bg-bg-tertiary border border-border-primary text-text-primary text-sm px-3 py-2 focus:outline-none focus:border-accent-blue placeholder:text-text-quaternary max-h-32"
              />
              <Button
                size="icon"
                variant="primary"
                onClick={handleSend}
                disabled={!input.trim() || isStreaming}
                aria-label="Send message"
                className="flex-shrink-0 h-9 w-9"
              >
                <Send size={14} />
              </Button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
