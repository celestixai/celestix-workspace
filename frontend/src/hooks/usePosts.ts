import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

// ==========================================
// Types
// ==========================================

export interface PostAuthor {
  id: string;
  displayName: string;
  avatarUrl?: string;
}

export interface Post {
  id: string;
  channelId: string;
  authorId: string;
  title: string;
  content: string;
  contentJson?: unknown;
  isPinned: boolean;
  coverImageUrl?: string;
  createdAt: string;
  updatedAt: string;
  author: PostAuthor;
  _count: { comments: number };
}

export interface PostComment {
  id: string;
  postId: string;
  authorId: string;
  content: string;
  parentCommentId?: string;
  createdAt: string;
  updatedAt: string;
  author: PostAuthor;
  replies?: PostComment[];
}

export interface PostWithComments extends Post {
  comments: PostComment[];
}

export interface CreatePostPayload {
  title: string;
  content: string;
  contentJson?: unknown;
  coverImageUrl?: string;
}

export interface UpdatePostPayload {
  title?: string;
  content?: string;
  contentJson?: unknown;
  coverImageUrl?: string | null;
}

export interface FollowUp {
  id: string;
  messageId: string;
  channelId: string;
  assignedToId: string;
  assignedById: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'DONE';
  dueDate?: string;
  note?: string;
  createdAt: string;
  updatedAt: string;
  message: { id: string; content: string; createdAt: string };
  channel: { id: string; name: string };
  assignedTo: PostAuthor;
  assignedBy: PostAuthor;
}

export interface CreateFollowUpPayload {
  channelId: string;
  assignedToId: string;
  dueDate?: string;
  note?: string;
}

export interface UpdateFollowUpPayload {
  status?: 'PENDING' | 'IN_PROGRESS' | 'DONE';
  dueDate?: string | null;
  note?: string | null;
}

// ==========================================
// Post hooks
// ==========================================

const POSTS_KEY = ['posts'];

export function usePosts(channelId?: string) {
  return useQuery<Post[]>({
    queryKey: [...POSTS_KEY, channelId],
    queryFn: async () => {
      const { data } = await api.get(`/workspace/channels/${channelId}/posts`);
      return data.data;
    },
    enabled: !!channelId,
  });
}

export function usePost(postId?: string) {
  return useQuery<PostWithComments>({
    queryKey: [...POSTS_KEY, 'detail', postId],
    queryFn: async () => {
      const { data } = await api.get(`/workspace/posts/${postId}`);
      return data.data;
    },
    enabled: !!postId,
  });
}

function useInvalidatePosts(channelId?: string) {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: POSTS_KEY });
  };
}

export function useCreatePost(channelId?: string) {
  const invalidate = useInvalidatePosts(channelId);
  return useMutation({
    mutationFn: async (payload: CreatePostPayload) => {
      const { data } = await api.post(`/workspace/channels/${channelId}/posts`, payload);
      return data.data as Post;
    },
    onSuccess: invalidate,
  });
}

export function useUpdatePost(postId?: string) {
  const invalidate = useInvalidatePosts();
  return useMutation({
    mutationFn: async (payload: UpdatePostPayload) => {
      const { data } = await api.patch(`/workspace/posts/${postId}`, payload);
      return data.data as Post;
    },
    onSuccess: invalidate,
  });
}

export function useDeletePost(postId?: string) {
  const invalidate = useInvalidatePosts();
  return useMutation({
    mutationFn: async () => {
      await api.delete(`/workspace/posts/${postId}`);
    },
    onSuccess: invalidate,
  });
}

export function useAddPostComment(postId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { content: string; parentCommentId?: string }) => {
      const { data } = await api.post(`/workspace/posts/${postId}/comments`, payload);
      return data.data as PostComment;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...POSTS_KEY, 'detail', postId] });
    },
  });
}

export function useTogglePostPin(postId?: string) {
  const invalidate = useInvalidatePosts();
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post(`/workspace/posts/${postId}/pin`);
      return data.data as Post;
    },
    onSuccess: invalidate,
  });
}

// ==========================================
// Follow-up hooks
// ==========================================

const FOLLOW_UPS_KEY = ['follow-ups'];

export function useFollowUps(workspaceId?: string) {
  return useQuery<FollowUp[]>({
    queryKey: [...FOLLOW_UPS_KEY, workspaceId],
    queryFn: async () => {
      const { data } = await api.get(`/workspace/${workspaceId}/follow-ups`);
      return data.data;
    },
    enabled: !!workspaceId,
  });
}

function useInvalidateFollowUps() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: FOLLOW_UPS_KEY });
  };
}

export function useCreateFollowUp() {
  const invalidate = useInvalidateFollowUps();
  return useMutation({
    mutationFn: async ({ messageId, ...payload }: CreateFollowUpPayload & { messageId: string }) => {
      const { data } = await api.post(`/workspace/messages/${messageId}/follow-up`, payload);
      return data.data as FollowUp;
    },
    onSuccess: invalidate,
  });
}

export function useUpdateFollowUp(followUpId?: string) {
  const invalidate = useInvalidateFollowUps();
  return useMutation({
    mutationFn: async (payload: UpdateFollowUpPayload) => {
      const { data } = await api.patch(`/workspace/follow-ups/${followUpId}`, payload);
      return data.data as FollowUp;
    },
    onSuccess: invalidate,
  });
}

export function useDeleteFollowUp(followUpId?: string) {
  const invalidate = useInvalidateFollowUps();
  return useMutation({
    mutationFn: async () => {
      await api.delete(`/workspace/follow-ups/${followUpId}`);
    },
    onSuccess: invalidate,
  });
}

// ==========================================
// Chat-to-Task hook
// ==========================================

export function useCreateTaskFromMessage() {
  return useMutation({
    mutationFn: async ({
      messageId,
      ...config
    }: {
      messageId: string;
      listId: string;
      assigneeIds?: string[];
      priority?: string;
      dueDate?: string;
    }) => {
      const { data } = await api.post(`/workspace/messages/${messageId}/create-task`, config);
      return data.data;
    },
  });
}
