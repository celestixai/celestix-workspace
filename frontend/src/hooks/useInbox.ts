import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

// ==========================================
// Types
// ==========================================

export type InboxItemType =
  | 'TASK_ASSIGNED' | 'TASK_MENTIONED' | 'COMMENT_ASSIGNED' | 'COMMENT_MENTION'
  | 'STATUS_CHANGED' | 'DUE_DATE_REMINDER' | 'CUSTOM_REMINDER' | 'WATCHER_UPDATE' | 'FOLLOW_UP';

export type InboxCategory = 'PRIMARY' | 'OTHER' | 'LATER';

export interface InboxItem {
  id: string;
  userId: string;
  itemType: InboxItemType;
  sourceType?: string;
  sourceId?: string;
  title: string;
  preview?: string;
  category: InboxCategory;
  isRead: boolean;
  isActioned: boolean;
  isSnoozed: boolean;
  snoozeUntil?: string;
  isSaved: boolean;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface InboxCounts {
  primary: number;
  other: number;
  later: number;
  saved: number;
  unread: number;
}

// ==========================================
// Queries
// ==========================================

const INBOX_KEY = ['inbox'];

export function useInboxItems(category?: InboxCategory, limit = 50) {
  return useQuery<{ items: InboxItem[]; nextCursor: string | null }>({
    queryKey: [...INBOX_KEY, 'items', category, limit],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (category) params.set('category', category);
      params.set('limit', String(limit));
      const { data } = await api.get(`/inbox?${params.toString()}`);
      return data.data;
    },
  });
}

export function useInboxCounts() {
  return useQuery<InboxCounts>({
    queryKey: [...INBOX_KEY, 'counts'],
    queryFn: async () => {
      const { data } = await api.get('/inbox/counts');
      return data.data;
    },
    refetchInterval: 30_000,
  });
}

// ==========================================
// Mutations
// ==========================================

function useInvalidateInbox() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: INBOX_KEY });
  };
}

export function useMarkRead() {
  const invalidate = useInvalidateInbox();
  return useMutation({
    mutationFn: async (itemId: string) => {
      const { data } = await api.patch(`/inbox/${itemId}/read`);
      return data;
    },
    onSuccess: invalidate,
  });
}

export function useMarkActioned() {
  const invalidate = useInvalidateInbox();
  return useMutation({
    mutationFn: async (itemId: string) => {
      const { data } = await api.patch(`/inbox/${itemId}/action`);
      return data;
    },
    onSuccess: invalidate,
  });
}

export function useSnoozeItem() {
  const invalidate = useInvalidateInbox();
  return useMutation({
    mutationFn: async ({ itemId, until }: { itemId: string; until: string }) => {
      const { data } = await api.post(`/inbox/${itemId}/snooze`, { until });
      return data;
    },
    onSuccess: invalidate,
  });
}

export function useSaveItem() {
  const invalidate = useInvalidateInbox();
  return useMutation({
    mutationFn: async (itemId: string) => {
      const { data } = await api.post(`/inbox/${itemId}/save`);
      return data;
    },
    onSuccess: invalidate,
  });
}

export function useDeleteInboxItem() {
  const invalidate = useInvalidateInbox();
  return useMutation({
    mutationFn: async (itemId: string) => {
      const { data } = await api.delete(`/inbox/${itemId}`);
      return data;
    },
    onSuccess: invalidate,
  });
}

export function useClearAllRead() {
  const invalidate = useInvalidateInbox();
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/inbox/clear-all');
      return data;
    },
    onSuccess: invalidate,
  });
}

export function useMarkAllRead() {
  const invalidate = useInvalidateInbox();
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/inbox/read-all');
      return data;
    },
    onSuccess: invalidate,
  });
}
