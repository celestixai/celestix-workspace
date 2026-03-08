import { Search, Pin, BellOff, Bell, Video, MoreVertical, Phone, ChevronLeft } from 'lucide-react';
import { Avatar } from '@/components/shared/avatar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { usePresenceStore } from '@/stores/presence.store';
import { useAuthStore } from '@/stores/auth.store';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface ChatInfo {
  id: string;
  name: string;
  type: 'DM' | 'GROUP' | 'CHANNEL';
  avatarUrl?: string | null;
  memberCount?: number;
  members?: Array<{ id: string; displayName: string }>;
  isMuted?: boolean;
  /** For DM chats, the other user's ID */
  dmUserId?: string | null;
}

interface ChatHeaderProps {
  chat: ChatInfo;
  onSearchMessages: () => void;
  onToggleMute: () => void;
  onVideoCall: () => void;
  onShowPinned: () => void;
  onClickProfile?: () => void;
  onBack?: () => void;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function ChatHeader({
  chat,
  onSearchMessages,
  onToggleMute,
  onVideoCall,
  onShowPinned,
  onClickProfile,
  onBack,
}: ChatHeaderProps) {
  const currentUser = useAuthStore((s) => s.user);
  const getUserStatus = usePresenceStore((s) => s.getUserStatus);
  const getTypingUsers = usePresenceStore((s) => s.getTypingUsers);

  const typingUserIds = getTypingUsers(chat.id);
  const typingNames = chat.members
    ? typingUserIds
        .filter((uid) => uid !== currentUser?.id)
        .map((uid) => chat.members!.find((m) => m.id === uid)?.displayName ?? 'Someone')
    : [];

  /* Status subtitle */
  const renderSubtitle = () => {
    // Typing indicator takes priority
    if (typingNames.length > 0) {
      const label =
        typingNames.length === 1
          ? `${typingNames[0]} is typing...`
          : typingNames.length <= 3
            ? `${typingNames.join(', ')} are typing...`
            : `${typingNames.length} people are typing...`;
      return <span className="text-accent-blue animate-pulse">{label}</span>;
    }

    if (chat.type === 'DM' && chat.dmUserId) {
      const status = getUserStatus(chat.dmUserId);
      const statusLabels: Record<string, string> = {
        ONLINE: 'online',
        AWAY: 'away',
        DND: 'do not disturb',
        OFFLINE: 'offline',
        INVISIBLE: 'offline',
      };
      return (
        <span
          className={cn(
            status === 'ONLINE' && 'text-accent-emerald',
            status === 'AWAY' && 'text-accent-amber',
            status === 'DND' && 'text-accent-red',
            (status === 'OFFLINE' || status === 'INVISIBLE') && 'text-text-tertiary',
          )}
        >
          {statusLabels[status] ?? 'offline'}
        </span>
      );
    }

    // Group / Channel
    if (chat.memberCount !== undefined) {
      const onlineCount = chat.members
        ? chat.members.filter((m) => getUserStatus(m.id) === 'ONLINE').length
        : 0;
      return (
        <span className="text-text-tertiary">
          {chat.memberCount} member{chat.memberCount !== 1 ? 's' : ''}
          {onlineCount > 0 && `, ${onlineCount} online`}
        </span>
      );
    }

    return null;
  };

  return (
    <div className="h-14 flex items-center gap-3 px-4 border-b border-border-primary bg-bg-secondary flex-shrink-0">
      {/* Back button (mobile or optional) */}
      {onBack && (
        <button
          onClick={onBack}
          aria-label="Back"
          className="p-1.5 rounded-lg hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-colors focus-visible:outline-2 focus-visible:outline-accent-blue"
        >
          <ChevronLeft size={20} />
        </button>
      )}

      {/* Avatar — clickable to open profile */}
      <button onClick={onClickProfile} className="flex-shrink-0 hover:opacity-80 transition-opacity">
        <Avatar
          src={chat.avatarUrl}
          name={chat.name}
          size="sm"
          userId={chat.dmUserId ?? undefined}
          showStatus={chat.type === 'DM'}
        />
      </button>

      {/* Name + subtitle — clickable to open profile */}
      <button onClick={onClickProfile} className="flex-1 min-w-0 text-left hover:opacity-80 transition-opacity">
        <h2 className="text-sm font-semibold text-text-primary truncate">{chat.name}</h2>
        <p className="text-xs truncate">{renderSubtitle()}</p>
      </button>

      {/* Action buttons */}
      <div className="flex items-center gap-0.5 flex-shrink-0">
        <Button
          variant="ghost"
          size="icon"
          onClick={onSearchMessages}
          aria-label="Search in chat"
          className="text-text-secondary hover:text-text-primary"
        >
          <Search size={18} />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={onShowPinned}
          aria-label="Pinned messages"
          className="text-text-secondary hover:text-text-primary"
        >
          <Pin size={18} />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleMute}
          aria-label={chat.isMuted ? 'Unmute notifications' : 'Mute notifications'}
          className="text-text-secondary hover:text-text-primary"
        >
          {chat.isMuted ? <BellOff size={18} /> : <Bell size={18} />}
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={onVideoCall}
          aria-label="Video call"
          className="text-text-secondary hover:text-text-primary"
        >
          <Video size={18} />
        </Button>
      </div>
    </div>
  );
}
