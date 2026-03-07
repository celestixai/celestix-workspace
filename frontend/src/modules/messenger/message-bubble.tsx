import { useState, useRef, useCallback } from 'react';
import { Check, CheckCheck, Reply, Forward, Edit3, Trash2, Pin, SmilePlus, Copy, CornerUpLeft } from 'lucide-react';
import { Avatar } from '@/components/shared/avatar';
import { cn, formatMessageTime } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth.store';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface Reaction {
  emoji: string;
  userIds: string[];
  userNames: string[];
}

export interface ReplyTo {
  id: string;
  senderName: string;
  content: string;
}

export interface MessageData {
  id: string;
  chatId: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string | null;
  content: string;
  type: 'text' | 'image' | 'file' | 'system';
  createdAt: string;
  updatedAt?: string;
  readBy?: string[];
  deliveredTo?: string[];
  reactions?: Reaction[];
  replyTo?: ReplyTo | null;
  isPinned?: boolean;
  isEdited?: boolean;
}

interface MessageBubbleProps {
  message: MessageData;
  isGrouped: boolean;              // previous message same sender within 2 min
  chatType: 'DM' | 'GROUP' | 'CHANNEL';
  totalMembers: number;
  onReply: (msg: MessageData) => void;
  onEdit: (msg: MessageData) => void;
  onDelete: (msgId: string) => void;
  onPin: (msgId: string) => void;
  onReact: (msgId: string, emoji: string) => void;
  onForward: (msg: MessageData) => void;
}

/* ------------------------------------------------------------------ */
/*  Quick-react emoji set                                              */
/* ------------------------------------------------------------------ */

const QUICK_REACTIONS = ['\u{1F44D}', '\u{2764}\u{FE0F}', '\u{1F602}', '\u{1F62E}', '\u{1F622}', '\u{1F64F}'];

/* Render inline markdown: **bold**, _italic_, ~~strike~~, `code` */
function renderInlineMarkdown(text: string) {
  const parts: (string | JSX.Element)[] = [];
  const regex = /(\*\*(.+?)\*\*|__(.+?)__|_(.+?)_|~~(.+?)~~|`(.+?)`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    if (match[2] || match[3]) {
      parts.push(<strong key={key++} className="font-bold">{match[2] || match[3]}</strong>);
    } else if (match[4]) {
      parts.push(<em key={key++}>{match[4]}</em>);
    } else if (match[5]) {
      parts.push(<del key={key++} className="line-through">{match[5]}</del>);
    } else if (match[6]) {
      parts.push(<code key={key++} className="px-1 py-0.5 rounded bg-white/10 text-xs font-mono">{match[6]}</code>);
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function MessageBubble({
  message,
  isGrouped,
  chatType,
  totalMembers,
  onReply,
  onEdit,
  onDelete,
  onPin,
  onReact,
  onForward,
}: MessageBubbleProps) {
  const currentUser = useAuthStore((s) => s.user);
  const isOwn = message.senderId === currentUser?.id;

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [showReactions, setShowReactions] = useState(false);
  const [hoveredReaction, setHoveredReaction] = useState<string | null>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);

  /* ---- system messages ---- */
  if (message.type === 'system') {
    return (
      <div className="flex justify-center py-1.5">
        <span className="text-xs text-text-tertiary bg-bg-tertiary/50 px-3 py-1 rounded-full">
          {message.content}
        </span>
      </div>
    );
  }

  /* ---- read-receipt icon ---- */
  const renderReceipt = () => {
    if (!isOwn) return null;
    const readCount = message.readBy?.length ?? 0;
    const deliveredCount = message.deliveredTo?.length ?? 0;

    if (chatType === 'DM') {
      if (readCount > 0) return <CheckCheck size={14} className="text-accent-blue flex-shrink-0" />;
      if (deliveredCount > 0) return <CheckCheck size={14} className="text-text-tertiary flex-shrink-0" />;
      return <Check size={14} className="text-text-tertiary flex-shrink-0" />;
    }
    // group / channel
    if (readCount >= totalMembers - 1) return <CheckCheck size={14} className="text-accent-blue flex-shrink-0" />;
    if (deliveredCount > 0 || readCount > 0) return <CheckCheck size={14} className="text-text-tertiary flex-shrink-0" />;
    return <Check size={14} className="text-text-tertiary flex-shrink-0" />;
  };

  /* ---- context menu ---- */
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    // Clamp to viewport so menu doesn't overflow off-screen
    const x = Math.min(e.clientX, window.innerWidth - 180);
    const y = Math.min(e.clientY, window.innerHeight - 250);
    setContextMenu({ x, y });
  }, []);

  const closeContextMenu = useCallback(() => setContextMenu(null), []);

  const contextActions = [
    { label: 'Reply', icon: Reply, action: () => onReply(message) },
    { label: 'Forward', icon: Forward, action: () => onForward(message) },
    ...(isOwn ? [{ label: 'Edit', icon: Edit3, action: () => onEdit(message) }] : []),
    { label: 'Copy text', icon: Copy, action: () => navigator.clipboard.writeText(message.content) },
    { label: message.isPinned ? 'Unpin' : 'Pin', icon: Pin, action: () => onPin(message.id) },
    { label: 'React', icon: SmilePlus, action: () => setShowReactions(true) },
    ...(isOwn ? [{ label: 'Delete', icon: Trash2, action: () => onDelete(message.id), danger: true }] : []),
  ];

  return (
    <>
      {/* Backdrop to close context menu */}
      {contextMenu && (
        <div className="fixed inset-0 z-40" onClick={closeContextMenu} onContextMenu={(e) => { e.preventDefault(); closeContextMenu(); }} />
      )}

      <div
        className={cn(
          'group flex gap-2.5 px-4 relative',
          isOwn ? 'flex-row-reverse' : 'flex-row',
          isGrouped ? 'mt-0.5' : 'mt-3',
        )}
        ref={bubbleRef}
      >
        {/* Avatar */}
        <div className="w-9 flex-shrink-0">
          {!isGrouped && !isOwn && (
            <Avatar
              src={message.senderAvatar}
              name={message.senderName}
              size="sm"
              userId={message.senderId}
            />
          )}
        </div>

        {/* Bubble */}
        <div
          className={cn(
            'max-w-[min(520px,75vw)] min-w-[80px] rounded-lg px-3 py-1.5 relative',
            'transition-colors duration-150 ease-out',
            isOwn
              ? 'bg-accent-blue/90 text-white'
              : 'bg-bg-tertiary text-text-primary',
          )}
          onContextMenu={handleContextMenu}
        >
          {/* Sender name (groups, not own, not grouped) */}
          {!isOwn && !isGrouped && chatType !== 'DM' && (
            <p className="text-xs font-semibold text-accent-blue mb-0.5">
              {message.senderName}
            </p>
          )}

          {/* Reply preview */}
          {message.replyTo && (
            <div
              className={cn(
                'flex gap-2 mb-1 px-2 py-1 rounded border-l-2 text-xs',
                isOwn
                  ? 'bg-white/10 border-white/40 text-white/80'
                  : 'bg-bg-active border-accent-blue text-text-secondary',
              )}
            >
              <CornerUpLeft size={12} className="flex-shrink-0 mt-0.5" />
              <div className="min-w-0 overflow-hidden">
                <span className="font-semibold truncate block">{message.replyTo.senderName}</span>
                <p className="line-clamp-1">{message.replyTo.content}</p>
              </div>
            </div>
          )}

          {/* Content */}
          <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
            {renderInlineMarkdown(message.content)}
          </p>

          {/* Time + edited + receipt */}
          <div
            className={cn(
              'flex items-center gap-1 mt-0.5 select-none',
              isOwn ? 'justify-end' : 'justify-end',
            )}
          >
            {message.isEdited && (
              <span className={cn('text-[10px]', isOwn ? 'text-white/50' : 'text-text-tertiary')}>
                edited
              </span>
            )}
            <span className={cn('text-[10px]', isOwn ? 'text-white/60' : 'text-text-tertiary')}>
              {formatMessageTime(message.createdAt)}
            </span>
            {renderReceipt()}
          </div>
        </div>

        {/* Hover actions */}
        <div
          className={cn(
            'opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex items-start pt-1 gap-0.5',
            isOwn ? 'flex-row-reverse' : 'flex-row',
          )}
        >
          <button
            onClick={() => onReply(message)}
            className="p-1 rounded-lg hover:bg-bg-hover text-text-tertiary hover:text-text-secondary transition-colors"
            aria-label="Reply"
          >
            <Reply size={14} />
          </button>
          <button
            onClick={() => setShowReactions(!showReactions)}
            className="p-1 rounded-lg hover:bg-bg-hover text-text-tertiary hover:text-text-secondary transition-colors"
            aria-label="React"
          >
            <SmilePlus size={14} />
          </button>
        </div>

        {/* Quick-react picker */}
        {showReactions && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setShowReactions(false)} />
            <div
              className={cn(
                'absolute z-40 flex gap-1 bg-bg-secondary border border-border-secondary rounded-full px-2 py-1 shadow-lg',
                isOwn ? 'right-16' : 'left-16',
                'top-0',
              )}
            >
              {QUICK_REACTIONS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => { onReact(message.id, emoji); setShowReactions(false); }}
                  className="hover:scale-125 transition-transform duration-100 text-base px-0.5"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </>
        )}

        {/* Context menu */}
        {contextMenu && (
          <div
            className="fixed z-50 bg-bg-secondary border border-border-secondary rounded-lg shadow-lg py-1 min-w-[160px] animate-scale-in"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            {contextActions.map((item) => (
              <button
                key={item.label}
                onClick={() => { item.action(); closeContextMenu(); }}
                className={cn(
                  'w-full flex items-center gap-2.5 px-3 py-1.5 text-sm transition-colors duration-100',
                  (item as { danger?: boolean }).danger
                    ? 'text-accent-red hover:bg-accent-red/10'
                    : 'text-text-primary hover:bg-bg-hover',
                )}
              >
                <item.icon size={15} />
                {item.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Reactions row */}
      {message.reactions && message.reactions.length > 0 && (
        <div className={cn('flex flex-wrap gap-1 mt-1 px-4', isOwn ? 'justify-end mr-12' : 'ml-14')}>
          {message.reactions.map((r) => {
            const hasReacted = currentUser ? r.userIds.includes(currentUser.id) : false;
            return (
              <button
                key={r.emoji}
                onClick={() => onReact(message.id, r.emoji)}
                onMouseEnter={() => setHoveredReaction(r.emoji)}
                onMouseLeave={() => setHoveredReaction(null)}
                className={cn(
                  'relative inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs border transition-colors duration-100',
                  hasReacted
                    ? 'bg-accent-blue/15 border-accent-blue/40 text-accent-blue'
                    : 'bg-bg-tertiary border-border-secondary text-text-secondary hover:border-border-primary',
                )}
              >
                <span>{r.emoji}</span>
                <span>{r.userIds.length}</span>

                {/* Tooltip showing who reacted */}
                {hoveredReaction === r.emoji && (
                  <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-bg-secondary border border-border-secondary text-text-secondary text-[10px] rounded px-2 py-1 whitespace-nowrap shadow-md z-50">
                    {r.userNames.slice(0, 5).join(', ')}
                    {r.userNames.length > 5 && ` +${r.userNames.length - 5}`}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}
