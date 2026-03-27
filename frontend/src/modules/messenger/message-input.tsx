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

interface Attachment {
  file: File;
  preview?: string;
}

interface MessageInputProps {
  onSend: (content: string, replyToId?: string, attachments?: File[]) => void;
  onTyping: () => void;
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
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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
    if (!trimmed && attachments.length === 0) return;

    if (editingMessage) {
      onSaveEdit(editingMessage.id, trimmed);
      onCancelEdit();
    } else {
      onSend(trimmed || (attachments.length > 0 ? `📎 ${attachments.length} file(s)` : ''), replyTo?.id, attachments.map((a) => a.file));
      if (replyTo) onCancelReply();
    }

    setText('');
    setAttachments([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [text, attachments, editingMessage, replyTo, onSend, onSaveEdit, onCancelEdit, onCancelReply]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const newAttachments: Attachment[] = Array.from(files).map((file) => {
      const preview = file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined;
      return { file, preview };
    });
    setAttachments((prev) => [...prev, ...newAttachments]);
    e.target.value = '';
  }, []);

  const removeAttachment = useCallback((index: number) => {
    setAttachments((prev) => {
      const removed = prev[index];
      if (removed?.preview) URL.revokeObjectURL(removed.preview);
      return prev.filter((_, i) => i !== index);
    });
  }, []);

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

      {/* Attachment previews */}
      {attachments.length > 0 && (
        <div className="flex gap-2 px-4 py-2 overflow-x-auto border-b border-border-primary">
          {attachments.map((att, i) => (
            <div key={i} className="relative flex-shrink-0 group/att">
              {att.preview ? (
                <img src={att.preview} alt={att.file.name} className="h-16 w-16 object-cover rounded-lg border border-border-secondary" />
              ) : (
                <div className="h-16 w-16 rounded-lg border border-border-secondary bg-bg-tertiary flex flex-col items-center justify-center">
                  <Paperclip size={16} className="text-text-tertiary" />
                  <span className="text-[9px] text-text-tertiary mt-0.5 truncate max-w-[56px]">{att.file.name.split('.').pop()}</span>
                </div>
              )}
              <button
                onClick={() => removeAttachment(i)}
                className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-accent-red text-white flex items-center justify-center opacity-0 group-hover/att:opacity-100 transition-opacity"
              >
                <X size={10} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input row — buttons level with message box */}
      <div className="flex items-end gap-1.5 px-3 py-2">
        {/* Message box with inline buttons */}
        <div className="flex-1 flex items-end bg-bg-tertiary border border-border-secondary rounded-xl focus-within:border-accent-blue focus-within:ring-1 focus-within:ring-accent-blue/30 transition-all duration-150">
          {/* Attach button - inside box, left side */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
            className="p-2.5 text-text-tertiary hover:text-text-secondary transition-colors disabled:opacity-40 flex-shrink-0"
            aria-label="Attach file"
          >
            <Paperclip size={20} />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileSelect}
          />

          {/* Textarea */}
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
              'flex-1 resize-none bg-transparent py-2.5 text-sm text-text-primary',
              'placeholder:text-text-tertiary',
              'focus:outline-none',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'leading-[22px]',
            )}
          />

          {/* Formatting toggle - inside box */}
          <button
            onClick={() => setShowFormatting(!showFormatting)}
            className={cn(
              'p-2.5 transition-colors flex-shrink-0',
              showFormatting
                ? 'text-accent-blue'
                : 'text-text-tertiary hover:text-text-secondary',
            )}
            aria-label="Formatting"
            aria-pressed={showFormatting}
          >
            <Bold size={20} />
          </button>

          {/* Emoji - inside box */}
          <div className="relative flex-shrink-0">
            <button
              onClick={() => setShowEmoji(!showEmoji)}
              className={cn(
                'p-2.5 transition-colors',
                showEmoji
                  ? 'text-accent-blue'
                  : 'text-text-tertiary hover:text-text-secondary',
              )}
              aria-label="Emoji"
              aria-pressed={showEmoji}
            >
              <Smile size={20} />
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
        </div>

        {/* Send button - outside box, level with it */}
        <Button
          size="icon"
          variant={(text.trim() || attachments.length > 0) ? 'primary' : 'ghost'}
          onClick={handleSend}
          disabled={disabled || (!text.trim() && attachments.length === 0)}
          className="rounded-xl h-[44px] w-[44px] flex-shrink-0"
          title="Send"
        >
          <Send size={20} />
        </Button>
      </div>
    </div>
  );
}
