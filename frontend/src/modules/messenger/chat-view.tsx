import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { useAuthStore } from '@/stores/auth.store';
import { usePresenceStore } from '@/stores/presence.store';
import { cn } from '@/lib/utils';
import { EmptyState } from '@/components/shared/empty-state';
import { MessageSkeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toast';
import { MessageCircle, X, Mail, Phone, AtSign, Shield, Users } from 'lucide-react';
import { ChatHeader, type ChatInfo } from './chat-header';
import { MessageBubble, type MessageData } from './message-bubble';
import { MessageInput } from './message-input';
import { Avatar } from '@/components/shared/avatar';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface MessagesPage {
  messages: MessageData[];
  nextCursor: string | null;
}

interface ChatViewProps {
  chatId: string | null;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function ChatView({ chatId }: ChatViewProps) {
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);
  const setTyping = usePresenceStore((s) => s.setTyping);

  const [replyTo, setReplyTo] = useState<MessageData | null>(null);
  const [editingMessage, setEditingMessage] = useState<MessageData | null>(null);
  const [profilePanel, setProfilePanel] = useState<{ userId: string; name: string; avatar?: string | null } | null>(null);
  const [groupInfoOpen, setGroupInfoOpen] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);

  /* ---- Normalize raw API/socket message to MessageData ---- */
  const normalizeMessage = (msg: any): MessageData => ({
    id: msg.id,
    chatId: msg.chatId,
    senderId: msg.senderId || msg.sender?.id,
    senderName: msg.senderName || msg.sender?.displayName || 'Unknown',
    senderAvatar: msg.senderAvatar || msg.sender?.avatarUrl || null,
    content: msg.content || '',
    type: msg.type || 'text',
    createdAt: msg.createdAt,
    updatedAt: msg.updatedAt,
    readBy: msg.readReceipts?.map((r: any) => r.userId) || msg.readBy || [],
    deliveredTo: msg.deliveredTo || [],
    reactions: msg.reactions?.map((r: any) => ({
      emoji: r.emoji,
      userIds: r.user ? [r.user.id] : r.userIds || [],
      userNames: r.user ? [r.user.displayName] : r.userNames || [],
    })) || [],
    replyTo: msg.replyTo ? {
      id: msg.replyTo.id,
      senderName: msg.replyTo.sender?.displayName || msg.replyTo.senderName || 'Unknown',
      content: msg.replyTo.content || '',
    } : null,
    isPinned: msg.isPinned || false,
    isEdited: msg.isEdited || (msg.updatedAt && msg.updatedAt !== msg.createdAt) || false,
  });

  /* ---- fetch chat info ---- */
  const { data: chat, isLoading: chatLoading } = useQuery<ChatInfo>({
    queryKey: ['messenger', 'chat', chatId],
    queryFn: async () => {
      const { data } = await api.get(`/messenger/chats/${chatId}`);
      const raw = data.data;
      const isDM = raw.type === 'DIRECT' || raw.type === 'DM';
      const members = (raw.members || []).map((m: any) => ({
        id: m.user?.id || m.userId,
        displayName: m.user?.displayName || 'Unknown',
      }));
      const otherMember = isDM ? raw.members?.find((m: any) => (m.user?.id || m.userId) !== currentUser?.id) : null;
      return {
        id: raw.id,
        name: raw.name || otherMember?.user?.displayName || 'Chat',
        type: isDM ? 'DM' : raw.type,
        avatarUrl: raw.avatarUrl || otherMember?.user?.avatarUrl || null,
        memberCount: raw.members?.length || 0,
        members,
        isMuted: raw.members?.find((m: any) => (m.user?.id || m.userId) === currentUser?.id)?.isMuted || false,
        dmUserId: otherMember ? (otherMember.user?.id || otherMember.userId) : null,
      } as ChatInfo;
    },
    enabled: !!chatId,
  });

  /* ---- infinite messages (cursor-based, scroll up to load older) ---- */
  const {
    data: messagesData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: msgsLoading,
  } = useInfiniteQuery<MessagesPage>({
    queryKey: ['messenger', 'messages', chatId],
    queryFn: async ({ pageParam }) => {
      const params: Record<string, string> = { limit: '40' };
      if (pageParam) params.cursor = pageParam as string;
      const { data } = await api.get(`/messenger/chats/${chatId}/messages`, { params });
      const messages = (data.data as any[]).map(normalizeMessage);
      return { messages, nextCursor: data.pagination?.cursor || null };
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    initialPageParam: undefined as string | undefined,
    enabled: !!chatId,
  });

  /* Flatten pages into oldest-first order */
  const messages: MessageData[] = messagesData
    ? messagesData.pages.flatMap((p) => p.messages).reverse()
    : [];

  /* ---- Socket: join room, listen for new messages ---- */
  useEffect(() => {
    if (!chatId) return;
    const socket = getSocket();

    socket.emit('messenger:join', chatId);

    const handleNewMessage = (raw: any) => {
      const msg = normalizeMessage(raw);
      if (msg.chatId !== chatId) return;
      queryClient.setQueryData<typeof messagesData>(
        ['messenger', 'messages', chatId],
        (old) => {
          if (!old) return old;
          // Prepend to first page (newest)
          const pages = [...old.pages];
          pages[0] = { ...pages[0], messages: [msg, ...pages[0].messages] };
          return { ...old, pages };
        },
      );
      // Auto-scroll if near bottom
      if (isNearBottomRef.current && scrollContainerRef.current) {
        setTimeout(() => {
          if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
          }
        }, 50);
      }
      // Mark as read
      socket.emit('messenger:read', { chatId, messageId: msg.id });
      // Invalidate chat list for last-message preview
      queryClient.invalidateQueries({ queryKey: ['messenger', 'chats'] });
    };

    const handleMessageUpdated = (raw: any) => {
      const msg = normalizeMessage(raw);
      if (msg.chatId !== chatId) return;
      queryClient.setQueryData<typeof messagesData>(
        ['messenger', 'messages', chatId],
        (old) => {
          if (!old) return old;
          const pages = old.pages.map((p) => ({
            ...p,
            messages: p.messages.map((m) => (m.id === msg.id ? msg : m)),
          }));
          return { ...old, pages };
        },
      );
    };

    const handleMessageDeleted = ({ messageId }: { messageId: string }) => {
      queryClient.setQueryData<typeof messagesData>(
        ['messenger', 'messages', chatId],
        (old) => {
          if (!old) return old;
          const pages = old.pages.map((p) => ({
            ...p,
            messages: p.messages.filter((m) => m.id !== messageId),
          }));
          return { ...old, pages };
        },
      );
    };

    const handleTyping = ({ chatId: cId, userId, isTyping: typing }: { chatId: string; userId: string; isTyping: boolean }) => {
      if (cId === chatId) setTyping(chatId, userId, typing);
    };

    const handleReadReceipt = ({ messageId, userId: uid }: { messageId: string; userId: string }) => {
      queryClient.setQueryData<typeof messagesData>(
        ['messenger', 'messages', chatId],
        (old) => {
          if (!old) return old;
          const pages = old.pages.map((p) => ({
            ...p,
            messages: p.messages.map((m) => {
              if (m.id === messageId) {
                const readBy = [...(m.readBy ?? [])];
                if (!readBy.includes(uid)) readBy.push(uid);
                return { ...m, readBy };
              }
              return m;
            }),
          }));
          return { ...old, pages };
        },
      );
    };

    socket.on('messenger:message', handleNewMessage);
    socket.on('messenger:message-updated', handleMessageUpdated);
    socket.on('messenger:message-deleted', handleMessageDeleted);
    socket.on('messenger:typing', handleTyping);
    socket.on('messenger:read-receipt', handleReadReceipt);

    return () => {
      socket.emit('messenger:leave', chatId);
      socket.off('messenger:message', handleNewMessage);
      socket.off('messenger:message-updated', handleMessageUpdated);
      socket.off('messenger:message-deleted', handleMessageDeleted);
      socket.off('messenger:typing', handleTyping);
      socket.off('messenger:read-receipt', handleReadReceipt);
    };
  }, [chatId, queryClient, setTyping]);

  /* ---- Scroll to bottom on initial load ---- */
  useEffect(() => {
    if (!msgsLoading && messages.length > 0 && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [msgsLoading, chatId]);

  /* ---- Mark latest message as read when opening a chat ---- */
  useEffect(() => {
    if (!chatId || msgsLoading || messages.length === 0) return;
    const lastMsg = messages[messages.length - 1];
    if (!lastMsg) return;
    // Socket-based read receipt
    const socket = getSocket();
    socket.emit('messenger:read', { chatId, messageId: lastMsg.id });
    // HTTP fallback for persistence
    api.post(`/messenger/chats/${chatId}/read`, { messageId: lastMsg.id }).catch(() => {});
    // Refresh chat list to clear unread badge
    queryClient.invalidateQueries({ queryKey: ['messenger', 'chats'] });
  }, [chatId, msgsLoading, messages.length]);

  /* ---- Track scroll position ---- */
  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    isNearBottomRef.current = distanceFromBottom < 100;

    // Load older messages when scrolled to top
    if (el.scrollTop < 80 && hasNextPage && !isFetchingNextPage) {
      const prevHeight = el.scrollHeight;
      fetchNextPage().then(() => {
        requestAnimationFrame(() => {
          if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight - prevHeight;
          }
        });
      });
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  /* ---- Mutations ---- */

  const sendMutation = useMutation({
    mutationFn: async ({ content, replyToId }: { content: string; replyToId?: string }) => {
      const { data } = await api.post(`/messenger/chats/${chatId}/messages`, { content, replyToId });
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messenger', 'chats'] });
      queryClient.invalidateQueries({ queryKey: ['messenger', 'messages', chatId] });
    },
    onError: () => {
      toast('Failed to send message', 'error');
    },
  });

  const editMutation = useMutation({
    mutationFn: async ({ messageId, content }: { messageId: string; content: string }) => {
      const { data } = await api.patch(`/messenger/messages/${messageId}`, { content });
      return data.data;
    },
    onError: () => {
      toast('Failed to edit message', 'error');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (messageId: string) => {
      await api.delete(`/messenger/messages/${messageId}`);
    },
    onSuccess: (_, messageId) => {
      queryClient.setQueryData<typeof messagesData>(
        ['messenger', 'messages', chatId],
        (old) => {
          if (!old) return old;
          const pages = old.pages.map((p) => ({
            ...p,
            messages: p.messages.filter((m) => m.id !== messageId),
          }));
          return { ...old, pages };
        },
      );
    },
    onError: () => {
      toast('Failed to delete message', 'error');
    },
  });

  const reactMutation = useMutation({
    mutationFn: async ({ messageId, emoji }: { messageId: string; emoji: string }) => {
      await api.post(`/messenger/messages/${messageId}/reactions`, { emoji });
    },
    onError: () => {
      toast('Failed to react', 'error');
    },
  });

  const pinMutation = useMutation({
    mutationFn: async (messageId: string) => {
      await api.post(`/messenger/messages/${messageId}/pin`);
    },
    onError: () => {
      toast('Failed to pin message', 'error');
    },
  });

  const muteMutation = useMutation({
    mutationFn: async () => {
      const isMuted = chat?.isMuted ?? false;
      await api.patch(`/messenger/chats/${chatId}`, { isMuted: !isMuted });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messenger', 'chat', chatId] });
      queryClient.invalidateQueries({ queryKey: ['messenger', 'chats'] });
    },
  });

  /* ---- handlers ---- */

  const uploadMutation = useMutation({
    mutationFn: async (files: File[]) => {
      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        await api.post(`/messenger/chats/${chatId}/upload`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messenger', 'messages', chatId] });
    },
    onError: () => {
      toast('Failed to upload file', 'error');
    },
  });

  const handleSend = useCallback(
    (content: string, replyToId?: string, attachments?: File[]) => {
      if (!chatId) return;
      // Upload attachments first if any
      if (attachments && attachments.length > 0) {
        uploadMutation.mutate(attachments);
      }
      const socket = getSocket();
      // Optimistic: emit via socket for speed
      socket.emit('messenger:send-message', { chatId, content, replyToId });
      // Also POST for durability / fallback
      sendMutation.mutate({ content, replyToId });
    },
    [chatId, sendMutation, uploadMutation],
  );

  const handleTyping = useCallback(() => {
    if (!chatId) return;
    const socket = getSocket();
    socket.emit('messenger:typing', { chatId, isTyping: true });
  }, [chatId]);

  const handleSaveEdit = useCallback(
    (messageId: string, content: string) => {
      editMutation.mutate({ messageId, content });
    },
    [editMutation],
  );

  /* Helper: is same sender & within 2 min */
  const isGrouped = (msg: MessageData, prev: MessageData | undefined) => {
    if (!prev) return false;
    if (prev.senderId !== msg.senderId) return false;
    const diff = new Date(msg.createdAt).getTime() - new Date(prev.createdAt).getTime();
    return diff < 120_000;
  };

  /* ---- no chat selected ---- */
  if (!chatId) {
    return (
      <div className="flex-1 flex items-center justify-center bg-bg-primary">
        <EmptyState
          icon={<MessageCircle size={48} />}
          title="Select a conversation"
          description="Choose a chat from the sidebar or start a new one"
        />
      </div>
    );
  }

  return (
    <div className="flex-1 flex min-w-0">
      {/* Main chat column */}
      <div className="flex-1 flex flex-col bg-bg-primary min-w-0">
      {/* Header */}
      {chatLoading ? (
        <div className="h-14 border-b border-border-primary bg-bg-secondary" />
      ) : chat ? (
        <ChatHeader
          chat={chat}
          onSearchMessages={() => {
            /* TODO: open search panel */
          }}
          onToggleMute={() => muteMutation.mutate()}
          onVideoCall={() => toast('Video calls coming soon', 'info')}
          onShowPinned={() => toast('Pinned messages coming soon', 'info')}
          onClickProfile={() => {
            if (chat.type === 'DM' && chat.dmUserId) {
              setProfilePanel({ userId: chat.dmUserId, name: chat.name, avatar: chat.avatarUrl });
            } else {
              setGroupInfoOpen(true);
            }
          }}
        />
      ) : null}

      {/* Messages area */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto"
      >
        <div className="flex flex-col min-h-full">
          {/* Spacer pushes messages to the bottom when few messages */}
          <div className="flex-1" />

          {/* Loading older messages indicator */}
          {isFetchingNextPage && (
            <div className="py-2">
              <MessageSkeleton />
              <MessageSkeleton />
            </div>
          )}

          {/* Loading initial */}
          {msgsLoading && (
            <div className="space-y-1 py-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <MessageSkeleton key={i} />
              ))}
            </div>
          )}

          {/* Empty chat */}
          {!msgsLoading && messages.length === 0 && (
            <div className="flex items-center justify-center py-12">
              <EmptyState
                icon={<MessageCircle size={40} />}
                title="No messages yet"
                description="Send the first message to start the conversation"
              />
            </div>
          )}

          {/* Messages — oldest first, newest at bottom near input */}
          {messages.map((msg, i) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              isGrouped={isGrouped(msg, messages[i - 1])}
              chatType={chat?.type ?? 'DM'}
              totalMembers={chat?.memberCount ?? 2}
              onReply={setReplyTo}
              onEdit={setEditingMessage}
              onDelete={(id) => deleteMutation.mutate(id)}
              onPin={(id) => pinMutation.mutate(id)}
              onReact={(id, emoji) => reactMutation.mutate({ messageId: id, emoji })}
              onForward={() => toast('Forward coming soon', 'info')}
              onClickSender={(senderId, senderName, senderAvatar) =>
                setProfilePanel({ userId: senderId, name: senderName, avatar: senderAvatar })
              }
            />
          ))}

          <div ref={bottomRef} className="h-1" />
        </div>
      </div>

      {/* Input */}
      <MessageInput
        onSend={handleSend}
        onTyping={handleTyping}
        replyTo={replyTo}
        editingMessage={editingMessage}
        onCancelReply={() => setReplyTo(null)}
        onCancelEdit={() => setEditingMessage(null)}
        onSaveEdit={handleSaveEdit}
        disabled={!chatId}
      />
      </div>

      {/* User Profile Panel (Telegram-style slide-in) */}
      {profilePanel && (
        <div className="w-[320px] flex-shrink-0 border-l border-border-primary bg-bg-secondary flex flex-col h-full overflow-y-auto animate-slide-in-right">
          <div className="flex items-center justify-between px-4 h-14 border-b border-border-primary flex-shrink-0">
            <h3 className="text-sm font-semibold text-text-primary">Profile</h3>
            <button onClick={() => setProfilePanel(null)} className="p-1.5 rounded-lg hover:bg-bg-hover text-text-tertiary hover:text-text-primary transition-colors">
              <X size={18} />
            </button>
          </div>
          <div className="flex flex-col items-center py-6 px-4 gap-3">
            <Avatar src={profilePanel.avatar} name={profilePanel.name} size="xl" userId={profilePanel.userId} showStatus />
            <h2 className="text-lg font-bold text-text-primary">{profilePanel.name}</h2>
            <span className="text-xs text-text-tertiary">User ID: {profilePanel.userId.slice(0, 8)}...</span>
          </div>
          <div className="px-4 space-y-3">
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-bg-tertiary">
              <AtSign size={16} className="text-text-tertiary flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-text-tertiary">Username</p>
                <p className="text-sm text-text-primary truncate">{profilePanel.name.toLowerCase().replace(/\s+/g, '.')}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-bg-tertiary">
              <Mail size={16} className="text-text-tertiary flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-text-tertiary">Email</p>
                <p className="text-sm text-text-primary truncate">{profilePanel.name.toLowerCase().replace(/\s+/g, '.')}@celestix.com</p>
              </div>
            </div>
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-bg-tertiary">
              <Phone size={16} className="text-text-tertiary flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-text-tertiary">Phone</p>
                <p className="text-sm text-text-primary">Not available</p>
              </div>
            </div>
          </div>
          <div className="px-4 mt-4">
            <p className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-2">Actions</p>
            <div className="space-y-1">
              <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors">
                <MessageCircle size={16} /> Send message
              </button>
              <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors">
                <Phone size={16} /> Voice call
              </button>
              <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-accent-red hover:bg-accent-red/10 transition-colors">
                <Shield size={16} /> Block user
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Group Info Panel */}
      {groupInfoOpen && chat && chat.type !== 'DM' && (
        <div className="w-[320px] flex-shrink-0 border-l border-border-primary bg-bg-secondary flex flex-col h-full overflow-y-auto animate-slide-in-right">
          <div className="flex items-center justify-between px-4 h-14 border-b border-border-primary flex-shrink-0">
            <h3 className="text-sm font-semibold text-text-primary">{chat.type === 'CHANNEL' ? 'Channel' : 'Group'} Info</h3>
            <button onClick={() => setGroupInfoOpen(false)} className="p-1.5 rounded-lg hover:bg-bg-hover text-text-tertiary hover:text-text-primary transition-colors">
              <X size={18} />
            </button>
          </div>
          <div className="flex flex-col items-center py-6 px-4 gap-2">
            <Avatar src={chat.avatarUrl} name={chat.name} size="xl" />
            <h2 className="text-lg font-bold text-text-primary">{chat.name}</h2>
            <span className="text-xs text-text-tertiary">{chat.memberCount} member{chat.memberCount !== 1 ? 's' : ''}</span>
          </div>
          <div className="px-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-text-tertiary uppercase tracking-wider">Members</p>
              <span className="text-xs text-text-tertiary">{chat.members?.length || 0}</span>
            </div>
            <div className="space-y-1">
              {chat.members?.map((member) => (
                <button
                  key={member.id}
                  onClick={() => {
                    setGroupInfoOpen(false);
                    setProfilePanel({ userId: member.id, name: member.displayName });
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-bg-hover transition-colors"
                >
                  <Avatar name={member.displayName} size="sm" userId={member.id} showStatus />
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-sm text-text-primary truncate">{member.displayName}</p>
                    <p className="text-xs text-text-tertiary">
                      {member.id === currentUser?.id ? 'You' : 'Member'}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
          {chat.type === 'GROUP' && (
            <div className="px-4 mt-4 space-y-1">
              <p className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-2">Admin Actions</p>
              <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors">
                <Users size={16} /> Add members
              </button>
              <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-accent-red hover:bg-accent-red/10 transition-colors">
                <X size={16} /> Leave group
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
