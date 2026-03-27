import { create } from 'zustand';

interface PresenceState {
  onlineUsers: Map<string, string>; // userId -> status
  typingUsers: Map<string, Set<string>>; // chatId -> Set<userId>
  setUserStatus: (userId: string, status: string) => void;
  setTyping: (chatId: string, userId: string, isTyping: boolean) => void;
  getUserStatus: (userId: string) => string;
  getTypingUsers: (chatId: string) => string[];
  bulkSetOnline: (users: Array<{ userId: string; status: string }>) => void;
}

export const usePresenceStore = create<PresenceState>((set, get) => ({
  onlineUsers: new Map(),
  typingUsers: new Map(),

  setUserStatus: (userId, status) =>
    set((state) => {
      const next = new Map(state.onlineUsers);
      next.set(userId, status);
      return { onlineUsers: next };
    }),

  setTyping: (chatId, userId, isTyping) =>
    set((state) => {
      const next = new Map(state.typingUsers);
      const chatTyping = new Set(next.get(chatId) || []);
      if (isTyping) {
        chatTyping.add(userId);
      } else {
        chatTyping.delete(userId);
      }
      next.set(chatId, chatTyping);
      return { typingUsers: next };
    }),

  getUserStatus: (userId) => get().onlineUsers.get(userId) || 'OFFLINE',

  getTypingUsers: (chatId) => {
    const set_ = get().typingUsers.get(chatId);
    return set_ ? Array.from(set_) : [];
  },

  bulkSetOnline: (users) =>
    set(() => {
      const map = new Map<string, string>();
      users.forEach((u) => map.set(u.userId, u.status));
      return { onlineUsers: map };
    }),
}));
