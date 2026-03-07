import { useState, useRef, useCallback, useEffect, KeyboardEvent } from 'react';
import {
  Send,
  Paperclip,
  Smile,
  Bold,
  Italic,
  Strikethrough,
  Code,
  X,
  CornerUpLeft,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { MessageData } from './message-bubble';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface MessageInputProps {
  onSend: (content: string, replyToId?: string) => void;
  onTyping: () => void;
  onAttach: () => void;
  replyTo: MessageData | null;
  editingMessage: MessageData | null;
  onCancelReply: () => void;
  onCancelEdit: () => void;
  onSaveEdit: (messageId: string, content: string) => void;
  disabled?: boolean;
}

/* ------------------------------------------------------------------ */
/*  Emoji palette (compact)                                            */
/* ------------------------------------------------------------------ */

const EMOJI_SECTIONS: { label: string; emojis: string[] }[] = [
  {
    label: 'Smileys',
    emojis: [
      '\u{1F600}','\u{1F603}','\u{1F604}','\u{1F601}','\u{1F606}','\u{1F605}','\u{1F602}','\u{1F923}',
      '\u{1F60A}','\u{1F607}','\u{1F642}','\u{1F643}','\u{1F609}','\u{1F60C}','\u{1F60D}','\u{1F618}',
      '\u{1F617}','\u{1F914}','\u{1F928}','\u{1F610}','\u{1F611}','\u{1F636}','\u{1F644}','\u{1F62C}',
      '\u{1F62E}','\u{1F632}','\u{1F631}','\u{1F622}','\u{1F62D}','\u{1F621}','\u{1F620}','\u{1F92C}',
    ],
  },
  {
    label: 'Gestures',
    emojis: [
      '\u{1F44D}','\u{1F44E}','\u{1F44A}','\u{270C}\u{FE0F}','\u{1F44B}','\u{1F44F}','\u{1F64F}','\u{1F4AA}',
      '\u{2764}\u{FE0F}','\u{1F494}','\u{1F525}','\u{2B50}','\u{1F389}','\u{1F38A}','\u{1F4AF}','\u{2705}',
    ],
  },
];

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function MessageInput({
  onSend,
  onTyping,
  onAttach,
  replyTo,
  editingMessage,
  onCancelReply,
  onCancelEdit,
  onSaveEdit,
  disabled = false,
}: MessageInputProps) {
  const [text, setText] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [showFormatting, setShowFormatting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* Pre-fill when editing */
  useEffect(() => {
    if (editingMessage) {
      setText(editingMessage.content);
      textareaRef.current?.focus();
    }
  }, [editingMessage]);

  /* Focus when replying */
  useEffect(() => {
    if (replyTo) textareaRef.current?.focus();
  }, [replyTo]);

  /* Auto-resize textarea (up to 6 lines ~144px) */
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 144) + 'px';
  }, [text]);

  /* ---- handlers ---- */

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed) return;

    if (editingMessage) {
      onSaveEdit(editingMessage.id, trimmed);
      onCancelEdit();
    } else {
      onSend(trimmed, replyTo?.id);
      if (replyTo) onCancelReply();
    }

    setText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [text, editingMessage, replyTo, onSend, onSaveEdit, onCancelEdit, onCancelReply]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setText(e.target.value);

      // Debounced typing indicator
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      onTyping();
      typingTimeoutRef.current = setTimeout(() => {}, 2000);
    },
    [onTyping],
  );

  /* Formatting helpers */
  const wrapSelection = useCallback((before: string, after: string) => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = text.substring(start, end);
    const newText = text.substring(0, start) + before + selected + after + text.substring(end);
    setText(newText);
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + before.length, end + before.length);
    }, 0);
  }, [text]);

  const insertEmoji = useCallback((emoji: string) => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const newText = text.substring(0, start) + emoji + text.substring(start);
    setText(newText);
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + emoji.length, start + emoji.length);
    }, 0);
    setShowEmoji(false);
  }, [text]);

  const handleEscape = useCallback(() => {
    if (editingMessage) onCancelEdit();
    else if (replyTo) onCancelReply();
  }, [editingMessage, replyTo, onCancelEdit, onCancelReply]);

  return (
    <div className="border-t border-border-primary bg-bg-secondary">
      {/* Reply / Edit preview bar */}
      {(replyTo || editingMessage) && (
        <div className="flex items-center gap-2 px-4 py-2 bg-bg-tertiary/50 border-b border-border-primary">
          <CornerUpLeft size={16} className="text-accent-blue flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-accent-blue">
              {editingMessage ? 'Editing message' : `Reply to ${replyTo!.senderName}`}
            </p>
            <p className="text-xs text-text-secondary line-clamp-1">
              {editingMessage ? editingMessage.content : replyTo!.content}
            </p>
          </div>
          <button
            onClick={editingMessage ? onCancelEdit : onCancelReply}
            aria-label={editingMessage ? 'Cancel editing' : 'Cancel reply'}
            className="p-1 rounded-lg hover:bg-bg-hover text-text-tertiary hover:text-text-primary transition-colors focus-visible:outline-2 focus-visible:outline-accent-blue flex-shrink-0"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Formatting toolbar */}
      {showFormatting && (
        <div className="flex items-center gap-0.5 px-4 py-1.5 border-b border-border-primary" role="toolbar" aria-label="Text formatting">
          <button
            onClick={() => wrapSelection('**', '**')}
            className="p-1.5 rounded-lg hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-colors focus-visible:outline-2 focus-visible:outline-accent-blue"
            aria-label="Bold"
          >
            <Bold size={15} />
          </button>
          <button
            onClick={() => wrapSelection('_', '_')}
            className="p-1.5 rounded-lg hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-colors focus-visible:outline-2 focus-visible:outline-accent-blue"
            aria-label="Italic"
          >
            <Italic size={15} />
          </button>
          <button
            onClick={() => wrapSelection('~~', '~~')}
            className="p-1.5 rounded-lg hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-colors focus-visible:outline-2 focus-visible:outline-accent-blue"
            aria-label="Strikethrough"
          >
            <Strikethrough size={15} />
          </button>
          <button
            onClick={() => wrapSelection('`', '`')}
            className="p-1.5 rounded-lg hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-colors focus-visible:outline-2 focus-visible:outline-accent-blue"
            aria-label="Inline code"
          >
            <Code size={15} />
          </button>
        </div>
      )}

      {/* Input row */}
      <div className="flex items-end gap-2 px-3 py-2">
        {/* Attach */}
        <button
          onClick={onAttach}
          disabled={disabled}
          className="p-2 rounded-lg hover:bg-bg-hover text-text-tertiary hover:text-text-secondary transition-colors disabled:opacity-40 flex-shrink-0 focus-visible:outline-2 focus-visible:outline-accent-blue"
          aria-label="Attach file"
        >
          <Paperclip size={18} />
        </button>

        {/* Textarea wrapper */}
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleChange}
            onKeyDown={(e) => {
              handleKeyDown(e);
              if (e.key === 'Escape') handleEscape();
            }}
            placeholder="Write a message..."
            disabled={disabled}
            rows={1}
            className={cn(
              'w-full resize-none rounded-lg bg-bg-tertiary border border-border-secondary px-3 py-2 text-sm text-text-primary',
              'placeholder:text-text-tertiary',
              'focus:border-accent-blue focus:ring-1 focus:ring-accent-blue/30 focus:outline-none',
              'transition-all duration-150 ease-out',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'leading-[22px]',
            )}
          />
        </div>

        {/* Formatting toggle */}
        <button
          onClick={() => setShowFormatting(!showFormatting)}
          className={cn(
            'p-2 rounded-lg transition-colors flex-shrink-0 focus-visible:outline-2 focus-visible:outline-accent-blue',
            showFormatting
              ? 'bg-accent-blue/10 text-accent-blue'
              : 'hover:bg-bg-hover text-text-tertiary hover:text-text-secondary',
          )}
          aria-label="Formatting"
          aria-pressed={showFormatting}
        >
          <Bold size={18} />
        </button>

        {/* Emoji */}
        <div className="relative flex-shrink-0">
          <button
            onClick={() => setShowEmoji(!showEmoji)}
            className={cn(
              'p-2 rounded-lg transition-colors focus-visible:outline-2 focus-visible:outline-accent-blue',
              showEmoji
                ? 'bg-accent-blue/10 text-accent-blue'
                : 'hover:bg-bg-hover text-text-tertiary hover:text-text-secondary',
            )}
            aria-label="Emoji"
            aria-pressed={showEmoji}
          >
            <Smile size={18} />
          </button>

          {/* Emoji picker */}
          {showEmoji && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setShowEmoji(false)} />
              <div className="absolute bottom-12 right-0 z-40 w-[min(320px,calc(100vw-2rem))] bg-bg-secondary border border-border-secondary rounded-xl shadow-lg p-3 animate-scale-in max-h-[50vh] overflow-y-auto">
                {EMOJI_SECTIONS.map((section) => (
                  <div key={section.label} className="mb-2">
                    <p className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wider mb-1">
                      {section.label}
                    </p>
                    <div className="grid grid-cols-8 gap-0.5">
                      {section.emojis.map((emoji) => (
                        <button
                          key={emoji}
                          onClick={() => insertEmoji(emoji)}
                          className="p-1 rounded hover:bg-bg-hover text-base transition-colors"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Send */}
        <Button
          size="icon"
          variant={text.trim() ? 'primary' : 'ghost'}
          onClick={handleSend}
          disabled={disabled || !text.trim()}
          className="rounded-lg flex-shrink-0"
          title="Send"
        >
          <Send size={18} />
        </Button>
      </div>
    </div>
  );
}
