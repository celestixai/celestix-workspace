import { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Search, Plus, Hash } from 'lucide-react';
import { api } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { useAuthStore } from '@/stores/auth.store';
import { usePresenceStore } from '@/stores/presence.store';
import { cn, formatMessageTime, truncate } from '@/lib/utils';
import { Avatar } from '@/components/shared/avatar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/shared/badge';
import { ChatListSkeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/empty-state';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface ChatListItem {
  id: string;
  name: string;
  type: 'DM' | 'GROUP' | 'CHANNEL';
  avatarUrl?: string | null;
  lastMessage?: {
    content: string;
    senderName: string;
    senderId: string;
    createdAt: string;
  } | null;
  unreadCount: number;
  isMuted: boolean;
  dmUserId?: string | null;
  memberCount?: number;
}

type FilterTab = 'all' | 'unread' | 'groups' | 'channels';

interface ChatListProps {
  selectedChatId: string | null;
  onSelectChat: (chatId: string) => void;
  onCreateChat: () => void;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function ChatList({ selectedChatId, onSelectChat, onCreateChat }: ChatListProps) {
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);
  const getTypingUsers = usePresenceStore((s) => s.getTypingUsers);
  const getUserStatus = usePresenceStore((s) => s.getUserStatus);

  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<FilterTab>('all');

  /* ---- Fetch chats ---- */
  const { data: chats, isLoading } = useQuery<ChatListItem[]>({
    queryKey: ['messenger', 'chats'],
    queryFn: async () => {
      const { data } = await api.get('/messenger/chats');
      // Transform raw chat data — compute display name for DMs from the other member
      return (data.data as any[]).map((chat: any) => {
        let name = chat.name || '';
        let avatarUrl = chat.avatarUrl || null;
        let dmUserId: string | null = null;
        const isDM = chat.type === 'DIRECT' || chat.type === 'DM';

        if (isDM && chat.members) {
          const other = chat.members.find((m: any) => m.userId !== currentUser?.id);
          if (other?.user) {
            name = name || other.user.displayName || 'Unknown';
            avatarUrl = avatarUrl || other.user.avatarUrl || null;
            dmUserId = other.userId;
          }
        }

        return {
          id: chat.id,
          name: name || 'Unnamed Chat',
          type: isDM ? 'DM' : chat.type,
          avatarUrl,
          lastMessage: chat.messages?.[0]
            ? {
                content: chat.messages[0].content || '',
                senderName: chat.messages[0].sender?.displayName || 'Unknown',
                senderId: chat.messages[0].senderId,
                createdAt: chat.messages[0].createdAt,
              }
            : null,
          unreadCount: chat.unreadCount || 0,
          isMuted: chat.members?.find((m: any) => m.userId === currentUser?.id)?.isMuted || false,
          dmUserId,
          memberCount: chat.members?.length || 0,
        } as ChatListItem;
      });
    },
  });

  /* ---- Listen for real-time chat-list updates ---- */
  useEffect(() => {
    const socket = getSocket();

    const handleChatUpdated = () => {
      queryClient.invalidateQueries({ queryKey: ['messenger', 'chats'] });
    };

    socket.on('messenger:chat-updated', handleChatUpdated);
    socket.on('messenger:unread-updated', handleChatUpdated);

    return () => {
      socket.off('messenger:chat-updated', handleChatUpdated);
      socket.off('messenger:unread-updated', handleChatUpdated);
    };
  }, [queryClient]);

  /* ---- Filter & search ---- */
  const filteredChats = useMemo(() => {
    if (!chats) return [];

    let result = chats;

    // Tab filters
    switch (activeTab) {
      case 'unread':
        result = result.filter((c) => c.unreadCount > 0);
        break;
      case 'groups':
        result = result.filter((c) => c.type === 'GROUP');
        break;
      case 'channels':
        result = result.filter((c) => c.type === 'CHANNEL');
        break;
    }

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.lastMessage?.content.toLowerCase().includes(q),
      );
    }

    // Sort by last message time (newest first), chats with no messages go to end
    result = [...result].sort((a, b) => {
      const aTime = a.lastMessage?.createdAt ? new Date(a.lastMessage.createdAt).getTime() : 0;
      const bTime = b.lastMessage?.createdAt ? new Date(b.lastMessage.createdAt).getTime() : 0;
      return bTime - aTime;
    });

    return result;
  }, [chats, activeTab, search]);

  const tabs: { key: FilterTab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'unread', label: 'Unread' },
    { key: 'groups', label: 'Groups' },
    { key: 'channels', label: 'Channels' },
  ];

  return (
    <div className="w-[320px] flex flex-col border-r border-[rgba(255,255,255,0.08)] bg-[#0C0C0E] flex-shrink-0 h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-14 border-b border-[rgba(255,255,255,0.08)] flex-shrink-0">
        <h1 className="text-[16px] font-display text-white">Messages</h1>
        <Button
          variant="ghost"
          size="icon"
          onClick={onCreateChat}
          title="New chat"
          className="text-text-secondary hover:text-text-primary"
        >
          <Plus size={20} />
        </Button>
      </div>

      {/* Search */}
      <div className="px-3 py-2 flex-shrink-0">
        <Input
          placeholder="Search chats..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          icon={<Search size={15} />}
        />
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 px-3 pb-2 flex-shrink-0">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'px-3 py-1 rounded-full text-xs font-medium transition-all duration-150 ease-out',
              activeTab === tab.key
                ? 'bg-accent-blue text-white'
                : 'bg-bg-tertiary text-text-secondary hover:text-text-primary hover:bg-bg-hover',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Chat items */}
      <div className="flex-1 overflow-y-auto">
        {isLoading && <ChatListSkeleton />}

        {!isLoading && filteredChats.length === 0 && (
          <EmptyState
            icon={<Search size={32} />}
            title={search ? 'No results' : 'No conversations'}
            description={search ? 'Try a different search term' : 'Start a new conversation'}
            className="py-12"
          />
        )}

        <motion.div
          className="space-y-0.5 p-1.5"
          initial="hidden"
          animate="visible"
          variants={{ visible: { transition: { staggerChildren: 0.03 } } }}
        >
          {filteredChats.map((chat) => {
            const isSelected = chat.id === selectedChatId;
            const typingUsers = getTypingUsers(chat.id).filter(
              (uid) => uid !== currentUser?.id,
            );
            const isOnline =
              chat.type === 'DM' && chat.dmUserId
                ? getUserStatus(chat.dmUserId) === 'ONLINE'
                : false;

            return (
              <motion.div
                key={chat.id}
                variants={{ hidden: { opacity: 0, y: 6 }, visible: { opacity: 1, y: 0 } }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
              >
              <button
                onClick={() => onSelectChat(chat.id)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 h-[56px] rounded-lg text-left',
                  'transition-all duration-150 ease-out',
                  isSelected
                    ? 'bg-[rgba(255,255,255,0.06)]'
                    : 'hover:bg-[rgba(255,255,255,0.03)]',
                )}
              >
                {/* Avatar / Channel icon */}
                {chat.type === 'CHANNEL' ? (
                  <div className="h-9 w-9 rounded-full bg-accent-blue/10 flex items-center justify-center flex-shrink-0">
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

                {/* Text content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[14px] font-medium truncate text-white">
                      {chat.name}
                    </span>
                    {chat.lastMessage && (
                      <span className="text-[11px] text-[rgba(255,255,255,0.40)] flex-shrink-0">
                        {formatMessageTime(chat.lastMessage.createdAt)}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <p className="text-[12px] text-[rgba(255,255,255,0.40)] truncate">
                      {typingUsers.length > 0 ? (
                        <span className="text-accent-blue animate-pulse">typing...</span>
                      ) : chat.lastMessage ? (
                        <>
                          {chat.type !== 'DM' && (
                            <span className="text-[rgba(255,255,255,0.30)]">
                              {chat.lastMessage.senderId === currentUser?.id
                                ? 'You'
                                : chat.lastMessage.senderName.split(' ')[0]}
                              :{' '}
                            </span>
                          )}
                          {truncate(chat.lastMessage.content, 40)}
                        </>
                      ) : (
                        <span className="text-[rgba(255,255,255,0.30)] italic">No messages yet</span>
                      )}
                    </p>

                    {/* Unread dot */}
                    {chat.unreadCount > 0 && (
                      <span className="w-2.5 h-2.5 rounded-full bg-[#2563EB] flex-shrink-0" />
                    )}
                  </div>
                </div>
              </button>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </div>
  );
}
