import { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/empty-state';
import { Avatar } from '@/components/shared/avatar';
import { Badge } from '@/components/shared/badge';
import { toast } from '@/components/ui/toast';
import { cn, formatMessageTime, formatFullDate } from '@/lib/utils';
import {
  Hash,
  Lock,
  Star,
  Plus,
  Send,
  Smile,
  Paperclip,
  AtSign,
  X,
  ChevronDown,
  ChevronRight,
  MessageSquare,
  Search,
  MoreHorizontal,
  Users,
  Settings,
  Bold,
  Italic,
  Code,
  Link,
  List,
  ListOrdered,
  ImageIcon,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Channel {
  id: string;
  name: string;
  type: 'PUBLIC' | 'PRIVATE' | 'DM';
  description?: string;
  isStarred?: boolean;
  unreadCount?: number;
  members?: ChannelMember[];
  lastMessage?: Message;
  createdAt: string;
}

interface ChannelMember {
  id: string;
  userId: string;
  displayName: string;
  avatarUrl?: string;
}

interface Message {
  id: string;
  channelId: string;
  content: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  threadId?: string;
  replyCount?: number;
  reactions?: Reaction[];
  attachments?: Attachment[];
  createdAt: string;
  updatedAt: string;
}

interface Reaction {
  emoji: string;
  count: number;
  userIds: string[];
}

interface Attachment {
  id: string;
  name: string;
  url: string;
  type: string;
  size: number;
}

/* ------------------------------------------------------------------ */
/*  Workspace Page                                                     */
/* ------------------------------------------------------------------ */

export function WorkspacePage() {
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();

  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [threadMessage, setThreadMessage] = useState<Message | null>(null);
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [starredOpen, setStarredOpen] = useState(true);
  const [channelsOpen, setChannelsOpen] = useState(true);
  const [dmsOpen, setDmsOpen] = useState(true);
  const [sidebarSearch, setSidebarSearch] = useState('');

  /* -- Queries -- */

  const { data: channels = [], isLoading: channelsLoading } = useQuery({
    queryKey: ['workspace-channels'],
    queryFn: async () => {
      const { data } = await api.get('/workspace/channels');
      return data.data as Channel[];
    },
  });

  const selectedChannel = channels.find((c) => c.id === selectedChannelId) || null;

  /* Normalize raw API message (backend returns nested sender object) */
  const normalizeMessage = (msg: any): Message => ({
    id: msg.id,
    channelId: msg.channelId,
    content: msg.content || '',
    senderId: msg.senderId || msg.sender?.id,
    senderName: msg.senderName || msg.sender?.displayName || 'Unknown',
    senderAvatar: msg.senderAvatar || msg.sender?.avatarUrl || null,
    threadId: msg.threadId || msg.parentMessageId || undefined,
    replyCount: msg.replyCount ?? msg._count?.threadReplies ?? 0,
    reactions: msg.reactions?.map((r: any) => ({
      emoji: r.emoji,
      count: r.count ?? r._count ?? (r.users?.length || 1),
      userIds: r.userIds || r.users?.map((u: any) => u.id) || [],
    })) || [],
    attachments: msg.attachments || [],
    createdAt: msg.createdAt,
    updatedAt: msg.updatedAt,
  });

  const { data: messages = [], isLoading: messagesLoading } = useQuery({
    queryKey: ['workspace-messages', selectedChannelId],
    queryFn: async () => {
      const { data } = await api.get(`/workspace/channels/${selectedChannelId}/messages`);
      return (data.data as any[]).map(normalizeMessage);
    },
    enabled: !!selectedChannelId,
  });

  const { data: threadMessages = [], isLoading: threadLoading } = useQuery({
    queryKey: ['workspace-thread', threadMessage?.id],
    queryFn: async () => {
      const { data } = await api.get(`/workspace/messages/${threadMessage!.id}/thread`);
      return (data.data.replies as any[]).map(normalizeMessage);
    },
    enabled: !!threadMessage,
  });

  /* -- Derived lists -- */

  const filteredChannels = channels.filter((c) =>
    c.name.toLowerCase().includes(sidebarSearch.toLowerCase())
  );
  const starred = filteredChannels.filter((c) => c.isStarred);
  const publicChannels = filteredChannels.filter((c) => c.type === 'PUBLIC' || c.type === 'PRIVATE');
  const dms = filteredChannels.filter((c) => c.type === 'DM');

  /* -- Auto-select first channel -- */

  useEffect(() => {
    if (!selectedChannelId && channels.length > 0) {
      setSelectedChannelId(channels[0].id);
    }
  }, [channels, selectedChannelId]);

  /* -- Mark channel as read when selected -- */
  useEffect(() => {
    if (!selectedChannelId || messagesLoading) return;
    api.post(`/workspace/channels/${selectedChannelId}/read`).then(() => {
      queryClient.invalidateQueries({ queryKey: ['workspace-channels'] });
    }).catch(() => {});
  }, [selectedChannelId, messagesLoading]);

  /* -- Mutations -- */

  const sendMessage = useMutation({
    mutationFn: async ({ content, parentMessageId }: { content: string; parentMessageId?: string }) => {
      const { data } = await api.post(`/workspace/channels/${selectedChannelId}/messages`, {
        content,
        parentMessageId,
      });
      return data.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['workspace-messages', selectedChannelId] });
      if (variables.parentMessageId) {
        queryClient.invalidateQueries({ queryKey: ['workspace-thread', variables.parentMessageId] });
      }
    },
    onError: () => toast('Failed to send message', 'error'),
  });

  const createChannel = useMutation({
    mutationFn: async (payload: { name: string; type: string; description?: string }) => {
      const { data } = await api.post('/workspace/channels', payload);
      return data.data as Channel;
    },
    onSuccess: (channel) => {
      queryClient.invalidateQueries({ queryKey: ['workspace-channels'] });
      setSelectedChannelId(channel.id);
      setShowCreateChannel(false);
      toast('Channel created', 'success');
    },
    onError: () => toast('Failed to create channel', 'error'),
  });

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <div className="flex h-full overflow-hidden">
      {/* ===== Channel Sidebar ===== */}
      <aside className="w-[240px] flex-shrink-0 bg-bg-secondary border-r border-border-primary flex flex-col">
        {/* Sidebar header */}
        <div className="h-12 flex items-center justify-between px-4 border-b border-border-primary flex-shrink-0">
          <span className="text-sm font-semibold text-text-primary">Channels</span>
          <button
            onClick={() => setShowCreateChannel(true)}
            aria-label="Create channel"
            className="p-1 rounded-lg hover:bg-bg-hover text-text-tertiary hover:text-text-primary transition-colors focus-visible:outline-2 focus-visible:outline-accent-blue"
          >
            <Plus size={16} />
          </button>
        </div>

        {/* Search */}
        <div className="px-3 py-2 flex-shrink-0">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-tertiary" />
            <input
              type="text"
              placeholder="Search channels..."
              value={sidebarSearch}
              onChange={(e) => setSidebarSearch(e.target.value)}
              className="w-full h-7 pl-8 pr-3 rounded-lg bg-bg-tertiary border border-border-primary text-xs text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent-blue"
            />
          </div>
        </div>

        {/* Channel list */}
        <div className="flex-1 overflow-y-auto px-2 pb-2">
          {channelsLoading ? (
            <SidebarSkeleton />
          ) : (
            <>
              {/* Starred */}
              {starred.length > 0 && (
                <ChannelSection
                  title="Starred"
                  open={starredOpen}
                  onToggle={() => setStarredOpen(!starredOpen)}
                >
                  {starred.map((ch) => (
                    <ChannelItem
                      key={ch.id}
                      channel={ch}
                      active={selectedChannelId === ch.id}
                      onClick={() => setSelectedChannelId(ch.id)}
                    />
                  ))}
                </ChannelSection>
              )}

              {/* Channels */}
              <ChannelSection
                title="Channels"
                open={channelsOpen}
                onToggle={() => setChannelsOpen(!channelsOpen)}
              >
                {publicChannels.length === 0 && (
                  <p className="text-xs text-text-tertiary px-3 py-2">No channels yet</p>
                )}
                {publicChannels.map((ch) => (
                  <ChannelItem
                    key={ch.id}
                    channel={ch}
                    active={selectedChannelId === ch.id}
                    onClick={() => setSelectedChannelId(ch.id)}
                  />
                ))}
              </ChannelSection>

              {/* DMs */}
              <ChannelSection
                title="Direct Messages"
                open={dmsOpen}
                onToggle={() => setDmsOpen(!dmsOpen)}
              >
                {dms.length === 0 && (
                  <p className="text-xs text-text-tertiary px-3 py-2">No conversations</p>
                )}
                {dms.map((ch) => (
                  <ChannelItem
                    key={ch.id}
                    channel={ch}
                    active={selectedChannelId === ch.id}
                    onClick={() => setSelectedChannelId(ch.id)}
                  />
                ))}
              </ChannelSection>
            </>
          )}
        </div>
      </aside>

      {/* ===== Message Area ===== */}
      <main className="flex-1 flex flex-col min-w-0">
        {selectedChannel ? (
          <>
            {/* Channel header */}
            <div className="h-12 flex items-center gap-3 px-4 border-b border-border-primary flex-shrink-0">
              <ChannelIcon channel={selectedChannel} size={18} />
              <div className="flex-1 min-w-0">
                <h2 className="text-sm font-semibold text-text-primary truncate">
                  {selectedChannel.name}
                </h2>
                {selectedChannel.description && (
                  <p className="text-xs text-text-tertiary truncate">{selectedChannel.description}</p>
                )}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button aria-label="Members" className="p-2 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-colors focus-visible:outline-2 focus-visible:outline-accent-blue">
                  <Users size={16} />
                </button>
                <button aria-label="Search in channel" className="p-2 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-colors focus-visible:outline-2 focus-visible:outline-accent-blue">
                  <Search size={16} />
                </button>
                <button aria-label="Channel settings" className="p-2 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-colors focus-visible:outline-2 focus-visible:outline-accent-blue">
                  <Settings size={16} />
                </button>
              </div>
            </div>

            {/* Messages */}
            <MessageList
              messages={messages}
              loading={messagesLoading}
              onThreadClick={setThreadMessage}
              currentUserId={user?.id}
            />

            {/* Input */}
            <MessageInput
              placeholder={`Message #${selectedChannel.name}`}
              onSend={(content) => sendMessage.mutate({ content })}
              loading={sendMessage.isPending}
            />
          </>
        ) : (
          <EmptyState
            icon={<Hash size={48} />}
            title="Select a channel"
            description="Choose a channel from the sidebar to start chatting"
            className="flex-1"
          />
        )}
      </main>

      {/* ===== Thread Panel ===== */}
      {threadMessage && (
        <aside className="w-[380px] flex-shrink-0 bg-bg-secondary border-l border-border-primary flex flex-col">
          <div className="h-12 flex items-center justify-between px-4 border-b border-border-primary flex-shrink-0">
            <span className="text-sm font-semibold text-text-primary">Thread</span>
            <button
              onClick={() => setThreadMessage(null)}
              aria-label="Close thread"
              className="p-1 rounded-lg hover:bg-bg-hover text-text-tertiary hover:text-text-primary transition-colors focus-visible:outline-2 focus-visible:outline-accent-blue"
            >
              <X size={16} />
            </button>
          </div>

          {/* Original message */}
          <div className="border-b border-border-primary p-4">
            <MessageBubble message={threadMessage} showThread={false} />
          </div>

          {/* Thread replies */}
          <div className="flex-1 overflow-y-auto">
            {threadLoading ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <MessageItemSkeleton key={i} />
                ))}
              </div>
            ) : threadMessages.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-sm text-text-tertiary">
                No replies yet
              </div>
            ) : (
              <div className="space-y-1 p-2">
                {threadMessages.map((msg) => (
                  <MessageBubble key={msg.id} message={msg} showThread={false} />
                ))}
              </div>
            )}
          </div>

          {/* Thread input */}
          <MessageInput
            placeholder="Reply in thread..."
            onSend={(content) =>
              sendMessage.mutate({ content, parentMessageId: threadMessage.id })
            }
            loading={sendMessage.isPending}
          />
        </aside>
      )}

      {/* ===== Create Channel Modal ===== */}
      <CreateChannelModal
        open={showCreateChannel}
        onClose={() => setShowCreateChannel(false)}
        onCreate={(payload) => createChannel.mutate(payload)}
        loading={createChannel.isPending}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function ChannelSection({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-2">
      <button
        onClick={onToggle}
        className="flex items-center gap-1 px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-text-tertiary hover:text-text-secondary w-full"
      >
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        {title}
      </button>
      {open && <div className="mt-0.5 space-y-px">{children}</div>}
    </div>
  );
}

function ChannelIcon({ channel, size = 16 }: { channel: Channel; size?: number }) {
  if (channel.type === 'DM') return <AtSign size={size} className="text-text-tertiary" />;
  if (channel.type === 'PRIVATE') return <Lock size={size} className="text-text-tertiary" />;
  return <Hash size={size} className="text-text-tertiary" />;
}

function ChannelItem({
  channel,
  active,
  onClick,
}: {
  channel: Channel;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors',
        active
          ? 'bg-bg-active text-text-primary'
          : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
      )}
    >
      <ChannelIcon channel={channel} />
      <span className={cn('truncate flex-1 text-left', !!(channel.unreadCount && channel.unreadCount > 0) && 'font-semibold text-text-primary')}>
        {channel.name}
      </span>
      {channel.isStarred && <Star size={12} className="text-accent-amber flex-shrink-0" />}
      {channel.unreadCount && channel.unreadCount > 0 && (
        <Badge count={channel.unreadCount} color="var(--accent-blue)" />
      )}
    </button>
  );
}

function MessageList({
  messages,
  loading,
  onThreadClick,
  currentUserId,
}: {
  messages: Message[];
  loading: boolean;
  onThreadClick: (msg: Message) => void;
  currentUserId?: string;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (loading) {
    return (
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <MessageItemSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <EmptyState
        icon={<MessageSquare size={48} />}
        title="No messages yet"
        description="Be the first to start the conversation"
        className="flex-1"
      />
    );
  }

  /* Group messages by date */
  let lastDate = '';

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="flex flex-col justify-end min-h-full px-4 py-2">
        {messages.map((msg) => {
          const msgDate = new Date(msg.createdAt).toLocaleDateString();
          const showDateDivider = msgDate !== lastDate;
          lastDate = msgDate;

          return (
            <div key={msg.id}>
              {showDateDivider && (
                <div className="flex items-center gap-3 my-4">
                  <div className="flex-1 h-px bg-border-primary" />
                  <span className="text-[11px] text-text-tertiary font-medium">{msgDate}</span>
                  <div className="flex-1 h-px bg-border-primary" />
                </div>
              )}
              <MessageBubble message={msg} showThread onThreadClick={() => onThreadClick(msg)} />
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

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
      parts.push(<code key={key++} className="px-1 py-0.5 rounded bg-bg-tertiary text-xs font-mono">{match[6]}</code>);
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}

function MessageBubble({
  message,
  showThread = true,
  onThreadClick,
}: {
  message: Message;
  showThread?: boolean;
  onThreadClick?: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="group flex gap-3 px-2 py-1.5 rounded-lg hover:bg-bg-hover transition-colors relative"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Avatar src={message.senderAvatar} name={message.senderName} size="sm" />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold text-text-primary">{message.senderName}</span>
          <span className="text-[11px] text-text-tertiary">{formatMessageTime(message.createdAt)}</span>
        </div>
        <p className="text-sm text-text-primary whitespace-pre-wrap break-words">{renderInlineMarkdown(message.content)}</p>

        {/* Reactions */}
        {message.reactions && message.reactions.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {message.reactions.map((r) => (
              <button
                key={r.emoji}
                className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-bg-tertiary border border-border-primary text-xs hover:border-accent-blue transition-colors"
              >
                <span>{r.emoji}</span>
                <span className="text-text-secondary">{r.count}</span>
              </button>
            ))}
          </div>
        )}

        {/* Thread indicator */}
        {showThread && (message.replyCount ?? 0) > 0 && (
          <button
            onClick={onThreadClick}
            className="flex items-center gap-1 mt-1 text-xs text-accent-blue hover:underline"
          >
            <MessageSquare size={12} />
            {message.replyCount} {message.replyCount === 1 ? 'reply' : 'replies'}
          </button>
        )}
      </div>

      {/* Hover actions */}
      {hovered && (
        <div className="absolute -top-3 right-2 flex items-center gap-px bg-bg-secondary border border-border-secondary rounded-lg shadow-md p-0.5">
          <button aria-label="React" className="p-1.5 rounded-lg hover:bg-bg-hover text-text-tertiary hover:text-text-primary transition-colors">
            <Smile size={14} />
          </button>
          {showThread && (
            <button
              onClick={onThreadClick}
              aria-label="Reply in thread"
              className="p-1.5 rounded-lg hover:bg-bg-hover text-text-tertiary hover:text-text-primary transition-colors"
            >
              <MessageSquare size={14} />
            </button>
          )}
          <button aria-label="More options" className="p-1.5 rounded-lg hover:bg-bg-hover text-text-tertiary hover:text-text-primary transition-colors">
            <MoreHorizontal size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

const WS_EMOJI_SECTIONS: { label: string; emojis: string[] }[] = [
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

const WS_FORMAT_ACTIONS = [
  { Icon: Bold, before: '**', after: '**', label: 'Bold' },
  { Icon: Italic, before: '_', after: '_', label: 'Italic' },
  { Icon: Code, before: '`', after: '`', label: 'Code' },
  { Icon: Link, before: '[', after: '](url)', label: 'Link' },
  { Icon: List, before: '- ', after: '', label: 'Bullet list' },
  { Icon: ListOrdered, before: '1. ', after: '', label: 'Numbered list' },
];

function MessageInput({
  placeholder,
  onSend,
  loading,
}: {
  placeholder: string;
  onSend: (content: string) => void;
  loading?: boolean;
}) {
  const [content, setContent] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    const trimmed = content.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setContent('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const adjustHeight = () => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = Math.min(el.scrollHeight, 160) + 'px';
    }
  };

  const wrapSelection = (before: string, after: string) => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = content.substring(start, end);
    const newContent = content.substring(0, start) + before + selected + after + content.substring(end);
    setContent(newContent);
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + before.length, end + before.length);
    }, 0);
  };

  const insertEmoji = (emoji: string) => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const newContent = content.substring(0, start) + emoji + content.substring(start);
    setContent(newContent);
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + emoji.length, start + emoji.length);
    }, 0);
    setShowEmoji(false);
  };

  return (
    <div className="px-4 pb-4 pt-2 flex-shrink-0">
      <div className="bg-bg-tertiary border border-border-secondary rounded-xl overflow-hidden focus-within:border-accent-blue transition-colors">
        {/* Formatting toolbar */}
        <div className="flex items-center gap-0.5 px-3 py-1.5 border-b border-border-primary" role="toolbar" aria-label="Text formatting">
          {WS_FORMAT_ACTIONS.map(({ Icon, before, after, label }) => (
            <button
              key={label}
              onClick={() => wrapSelection(before, after)}
              aria-label={label}
              className="p-1 rounded-lg hover:bg-bg-hover text-text-tertiary hover:text-text-primary transition-colors focus-visible:outline-2 focus-visible:outline-accent-blue"
            >
              <Icon size={14} />
            </button>
          ))}
        </div>

        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            adjustHeight();
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={1}
          className="w-full px-3 py-2 bg-transparent text-sm text-text-primary placeholder:text-text-tertiary resize-none focus:outline-none"
          style={{ minHeight: '36px', maxHeight: '160px' }}
        />

        <div className="flex items-center justify-between px-3 py-1.5">
          <div className="flex items-center gap-1">
            <button aria-label="Add" className="p-1.5 rounded-lg hover:bg-bg-hover text-text-tertiary hover:text-text-primary transition-colors">
              <Plus size={16} />
            </button>
            <button aria-label="Attach file" onClick={() => toast('File attachments coming soon', 'info')} className="p-1.5 rounded-lg hover:bg-bg-hover text-text-tertiary hover:text-text-primary transition-colors">
              <Paperclip size={16} />
            </button>
            <div className="relative">
              <button
                aria-label="Emoji"
                aria-pressed={showEmoji}
                onClick={() => setShowEmoji(!showEmoji)}
                className={cn(
                  'p-1.5 rounded-lg transition-colors',
                  showEmoji
                    ? 'bg-accent-blue/10 text-accent-blue'
                    : 'hover:bg-bg-hover text-text-tertiary hover:text-text-primary',
                )}
              >
                <Smile size={16} />
              </button>
              {showEmoji && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setShowEmoji(false)} />
                  <div className="absolute bottom-10 left-0 z-40 w-[min(320px,calc(100vw-2rem))] bg-bg-secondary border border-border-secondary rounded-xl shadow-lg p-3 animate-scale-in max-h-[50vh] overflow-y-auto">
                    {WS_EMOJI_SECTIONS.map((section) => (
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
            <button aria-label="Mention" className="p-1.5 rounded-lg hover:bg-bg-hover text-text-tertiary hover:text-text-primary transition-colors">
              <AtSign size={16} />
            </button>
          </div>
          <Button
            size="sm"
            onClick={handleSend}
            disabled={!content.trim() || loading}
            loading={loading}
          >
            <Send size={14} />
          </Button>
        </div>
      </div>
    </div>
  );
}

function MessageItemSkeleton() {
  return (
    <div className="flex gap-3 px-2 py-2">
      <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-10" />
        </div>
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    </div>
  );
}

function SidebarSkeleton() {
  return (
    <div className="space-y-3 px-2 py-2">
      <Skeleton className="h-3 w-20 ml-2" />
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-2 px-3 py-1">
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-3 w-24" />
        </div>
      ))}
      <Skeleton className="h-3 w-20 ml-2 mt-4" />
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex items-center gap-2 px-3 py-1">
          <Skeleton className="h-4 w-4 rounded-full" />
          <Skeleton className="h-3 w-28" />
        </div>
      ))}
    </div>
  );
}

function CreateChannelModal({
  open,
  onClose,
  onCreate,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (payload: { name: string; type: string; description?: string }) => void;
  loading: boolean;
}) {
  const [name, setName] = useState('');
  const [type, setType] = useState<'PUBLIC' | 'PRIVATE'>('PUBLIC');
  const [description, setDescription] = useState('');

  const handleCreate = () => {
    if (!name.trim()) return;
    onCreate({ name: name.trim().toLowerCase().replace(/\s+/g, '-'), type, description: description.trim() || undefined });
  };

  return (
    <Modal open={open} onClose={onClose} title="Create Channel" size="sm">
      <div className="space-y-4">
        <Input
          label="Channel name"
          placeholder="e.g. project-updates"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text-secondary">Type</label>
          <div className="flex gap-2">
            <button
              onClick={() => setType('PUBLIC')}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border text-sm transition-colors',
                type === 'PUBLIC'
                  ? 'border-accent-blue bg-accent-blue/10 text-accent-blue'
                  : 'border-border-secondary text-text-secondary hover:bg-bg-hover'
              )}
            >
              <Hash size={14} /> Public
            </button>
            <button
              onClick={() => setType('PRIVATE')}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border text-sm transition-colors',
                type === 'PRIVATE'
                  ? 'border-accent-blue bg-accent-blue/10 text-accent-blue'
                  : 'border-border-secondary text-text-secondary hover:bg-bg-hover'
              )}
            >
              <Lock size={14} /> Private
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text-secondary">Description (optional)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What's this channel about?"
            rows={2}
            className="w-full px-3 py-2 rounded-lg bg-bg-tertiary border border-border-secondary text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent-blue resize-none"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleCreate} loading={loading} disabled={!name.trim()}>
            Create Channel
          </Button>
        </div>
      </div>
    </Modal>
  );
}
