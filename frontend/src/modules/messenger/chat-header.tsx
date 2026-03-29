import { useState, useRef, useCallback, useEffect } from 'react';
import { Search, Pin, BellOff, Bell, Video, MoreVertical, Phone, ChevronLeft, Hash, Trash2, Archive } from 'lucide-react';
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
  members?: Array<{ id: string; displayName: string; username?: string }>;
  isMuted?: boolean;
  /** For DM chats, the other user's ID */
  dmUserId?: string | null;
}

interface ChatHeaderProps {
  chat: ChatInfo;
  onSearchMessages: () => void;
  onToggleMute: () => void;
  onVideoCall: () => void;
  onPhoneCall: () => void;
  onShowPinned: () => void;
  onDeleteChat?: () => void;
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
  onPhoneCall,
  onShowPinned,
  onDeleteChat,
  onClickProfile,
  onBack,
}: ChatHeaderProps) {
  const currentUser = useAuthStore((s) => s.user);
  const getUserStatus = usePresenceStore((s) => s.getUserStatus);
  const getTypingUsers = usePresenceStore((s) => s.getTypingUsers);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  // Close more menu on outside click
  useEffect(() => {
    if (!showMoreMenu) return;
    const handler = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setShowMoreMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showMoreMenu]);

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
    <div className="h-14 flex items-center gap-3 px-4 border-b border-[rgba(255,255,255,0.08)] bg-[#0C0C0E] flex-shrink-0">
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

      {/* Avatar / Channel icon — clickable to open profile */}
      <button onClick={onClickProfile} className="flex-shrink-0 hover:opacity-80 transition-opacity">
        {chat.type === 'CHANNEL' ? (
          <div className="h-9 w-9 rounded-full bg-accent-blue/10 flex items-center justify-center">
            <Hash size={18} className="text-accent-blue" />
          </div>
        ) : (
          <Avatar
            src={chat.avatarUrl}
            name={chat.name}
            size="sm"
            userId={chat.dmUserId ?? undefined}
            showStatus={chat.type === 'DM'}
          />
        )}
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
          onClick={onPhoneCall}
          aria-label="Phone call"
          className="text-text-secondary hover:text-text-primary"
        >
          <Phone size={18} />
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

        {/* More options dropdown */}
        <div className="relative" ref={moreMenuRef}>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowMoreMenu(!showMoreMenu)}
            aria-label="More options"
            className="text-text-secondary hover:text-text-primary"
          >
            <MoreVertical size={18} />
          </Button>

          {showMoreMenu && (
            <div className="absolute right-0 top-full mt-1 w-48 bg-[#161618] border border-[rgba(255,255,255,0.12)] rounded-lg shadow-lg py-1 z-50 animate-scale-in">
              <button
                onClick={() => { onShowPinned(); setShowMoreMenu(false); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-[rgba(255,255,255,0.65)] hover:bg-[rgba(255,255,255,0.06)] hover:text-white transition-colors"
              >
                <Pin size={15} /> Pinned Messages
              </button>
              <button
                onClick={() => { onToggleMute(); setShowMoreMenu(false); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-[rgba(255,255,255,0.65)] hover:bg-[rgba(255,255,255,0.06)] hover:text-white transition-colors"
              >
                {chat.isMuted ? <Bell size={15} /> : <BellOff size={15} />}
                {chat.isMuted ? 'Unmute' : 'Mute'} Notifications
              </button>
              {onDeleteChat && (
                <button
                  onClick={() => { onDeleteChat(); setShowMoreMenu(false); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-[#EF4444] hover:bg-[rgba(239,68,68,0.1)] transition-colors"
                >
                  <Trash2 size={15} /> Delete Chat
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
