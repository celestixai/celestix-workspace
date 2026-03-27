import { memo, useCallback } from 'react';
import {
  UserPlus, AtSign, MessageCircle, ArrowRightLeft,
  Clock, Eye, RotateCcw, Check, Bookmark, Bell,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { InboxItem as InboxItemT, InboxItemType } from '@/hooks/useInbox';

const typeIcons: Record<InboxItemType, React.ElementType> = {
  TASK_ASSIGNED: UserPlus,
  TASK_MENTIONED: AtSign,
  COMMENT_ASSIGNED: MessageCircle,
  COMMENT_MENTION: AtSign,
  STATUS_CHANGED: ArrowRightLeft,
  DUE_DATE_REMINDER: Clock,
  CUSTOM_REMINDER: Bell,
  WATCHER_UPDATE: Eye,
  FOLLOW_UP: RotateCcw,
};

const typeColors: Record<InboxItemType, string> = {
  TASK_ASSIGNED: 'text-accent-blue',
  TASK_MENTIONED: 'text-accent-purple',
  COMMENT_ASSIGNED: 'text-accent-emerald',
  COMMENT_MENTION: 'text-accent-purple',
  STATUS_CHANGED: 'text-accent-amber',
  DUE_DATE_REMINDER: 'text-accent-red',
  CUSTOM_REMINDER: 'text-accent-amber',
  WATCHER_UPDATE: 'text-text-tertiary',
  FOLLOW_UP: 'text-accent-blue',
};

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffS = Math.floor((now - then) / 1000);
  if (diffS < 60) return 'just now';
  const diffM = Math.floor(diffS / 60);
  if (diffM < 60) return `${diffM}m ago`;
  const diffH = Math.floor(diffM / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  if (diffD === 1) return 'yesterday';
  if (diffD < 7) return `${diffD}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

interface Props {
  item: InboxItemT;
  onMarkDone: (id: string) => void;
  onSnooze: (id: string) => void;
  onSave: (id: string) => void;
  onClick: (item: InboxItemT) => void;
}

export const InboxItemRow = memo(function InboxItemRow({ item, onMarkDone, onSnooze, onSave, onClick }: Props) {
  const Icon = typeIcons[item.itemType] || Bell;
  const colorClass = typeColors[item.itemType] || 'text-text-tertiary';

  const handleClick = useCallback(() => onClick(item), [item, onClick]);
  const handleDone = useCallback((e: React.MouseEvent) => { e.stopPropagation(); onMarkDone(item.id); }, [item.id, onMarkDone]);
  const handleSnooze = useCallback((e: React.MouseEvent) => { e.stopPropagation(); onSnooze(item.id); }, [item.id, onSnooze]);
  const handleSave = useCallback((e: React.MouseEvent) => { e.stopPropagation(); onSave(item.id); }, [item.id, onSave]);

  return (
    <div
      onClick={handleClick}
      className={cn(
        'group flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-bg-hover border-b border-border-primary',
        !item.isRead && 'bg-bg-active/30',
      )}
    >
      {/* Type icon */}
      <div className={cn('mt-0.5 flex-shrink-0', colorClass)}>
        <Icon size={18} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={cn('text-sm truncate', !item.isRead ? 'font-semibold text-text-primary' : 'text-text-secondary')}>
          {item.title}
        </p>
        {item.preview && (
          <p className="text-xs text-text-tertiary truncate mt-0.5">{item.preview}</p>
        )}
      </div>

      {/* Timestamp */}
      <span className="text-[11px] text-text-tertiary flex-shrink-0 mt-0.5">
        {relativeTime(item.createdAt)}
      </span>

      {/* Action buttons — visible on hover */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        <button
          onClick={handleDone}
          className="p-1 rounded hover:bg-bg-tertiary text-text-tertiary hover:text-accent-emerald"
          title="Mark done"
        >
          <Check size={14} />
        </button>
        <button
          onClick={handleSnooze}
          className="p-1 rounded hover:bg-bg-tertiary text-text-tertiary hover:text-accent-amber"
          title="Snooze"
        >
          <Clock size={14} />
        </button>
        <button
          onClick={handleSave}
          className={cn(
            'p-1 rounded hover:bg-bg-tertiary',
            item.isSaved ? 'text-accent-blue' : 'text-text-tertiary hover:text-accent-blue',
          )}
          title={item.isSaved ? 'Unsave' : 'Save'}
        >
          <Bookmark size={14} fill={item.isSaved ? 'currentColor' : 'none'} />
        </button>
      </div>

      {/* Unread dot */}
      {!item.isRead && (
        <div className="w-2 h-2 rounded-full bg-accent-blue flex-shrink-0 mt-1.5" />
      )}
    </div>
  );
});
