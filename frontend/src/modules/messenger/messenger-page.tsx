import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getSocket } from '@/lib/socket';
import { usePresenceStore } from '@/stores/presence.store';
import { ChatList } from './chat-list';
import { ChatView } from './chat-view';
import { CreateChatModal } from './create-chat-modal';

/* ------------------------------------------------------------------ */
/*  Messenger Page                                                     */
/*  Split view: chat list (320px left) + chat view (right)            */
/* ------------------------------------------------------------------ */

export function MessengerPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const chatIdParam = searchParams.get('chat');

  const [selectedChatId, setSelectedChatId] = useState<string | null>(chatIdParam);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const setTyping = usePresenceStore((s) => s.setTyping);
  const setUserStatus = usePresenceStore((s) => s.setUserStatus);
  const bulkSetOnline = usePresenceStore((s) => s.bulkSetOnline);

  /* Sync selected chat with URL param */
  useEffect(() => {
    if (chatIdParam && chatIdParam !== selectedChatId) {
      setSelectedChatId(chatIdParam);
    }
  }, [chatIdParam]);

  const handleSelectChat = (chatId: string) => {
    setSelectedChatId(chatId);
    setSearchParams({ chat: chatId }, { replace: true });
  };

  const handleChatCreated = (chatId: string) => {
    handleSelectChat(chatId);
  };

  /* ---- Global socket listeners for presence ---- */
  useEffect(() => {
    const socket = getSocket();

    const handlePresence = ({ userId, status }: { userId: string; status: string }) => {
      setUserStatus(userId, status);
    };

    const handlePresenceBulk = (users: Array<{ userId: string; status: string }>) => {
      bulkSetOnline(users);
    };

    const handleTyping = ({
      chatId,
      userId,
      isTyping,
    }: {
      chatId: string;
      userId: string;
      isTyping: boolean;
    }) => {
      setTyping(chatId, userId, isTyping);
    };

    socket.on('presence:update', handlePresence);
    socket.on('presence:bulk', handlePresenceBulk);
    socket.on('messenger:typing', handleTyping);

    // Request initial presence list
    socket.emit('presence:subscribe');

    return () => {
      socket.off('presence:update', handlePresence);
      socket.off('presence:bulk', handlePresenceBulk);
      socket.off('messenger:typing', handleTyping);
    };
  }, [setUserStatus, bulkSetOnline, setTyping]);

  return (
    <div className="flex h-full bg-bg-primary overflow-hidden">
      {/* Left panel -- Chat list */}
      <ChatList
        selectedChatId={selectedChatId}
        onSelectChat={handleSelectChat}
        onCreateChat={() => setShowCreateModal(true)}
      />

      {/* Right panel -- Chat view */}
      <ChatView chatId={selectedChatId} />

      {/* Create chat modal */}
      <CreateChatModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onChatCreated={handleChatCreated}
      />
    </div>
  );
}
