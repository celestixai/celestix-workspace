import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

// ==========================================
// Types
// ==========================================

export interface DocHubItem {
  id: string;
  title: string;
  isWiki: boolean;
  isPublished: boolean;
  publishedUrl?: string;
  slug?: string;
  icon?: string;
  coverImageUrl?: string;
  depth: number;
  wordCount: number;
  createdAt: string;
  updatedAt: string;
  user: { id: string; displayName: string; avatarUrl?: string; email: string };
  _count: { comments: number; versions: number; subPages: number; enhancedComments: number };
}

export interface DocSubPage {
  id: string;
  title: string;
  icon?: string;
  depth: number;
  user: { id: string; displayName: string; avatarUrl?: string };
  subPages?: DocSubPage[];
}

export interface DocCommentEnhanced {
  id: string;
  documentId: string;
  content: string;
  isResolved: boolean;
  highlightedText?: string;
  positionJson?: any;
  parentCommentId?: string;
  createdAt: string;
  updatedAt: string;
  user: { id: string; displayName: string; avatarUrl?: string; email: string };
  replies?: DocCommentEnhanced[];
}

export interface DocTemplate {
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
  content: string;
  contentJson?: any;
  category?: string;
  createdAt: string;
  createdBy: { id: string; displayName: string; avatarUrl?: string };
}

type DocFilter = 'all' | 'wikis' | 'myDocs' | 'shared' | 'recent' | 'favorites';

// ==========================================
// Docs Hub
// ==========================================

export function useDocsHub(workspaceId?: string, filter: DocFilter = 'all', search?: string) {
  return useQuery<DocHubItem[]>({
    queryKey: ['docs-hub', workspaceId, filter, search],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (workspaceId) params.set('workspaceId', workspaceId);
      if (filter) params.set('filter', filter);
      if (search) params.set('search', search);
      const res = await api.get(`/docs/hub?${params}`);
      return res.data;
    },
  });
}

// ==========================================
// Wiki Toggle
// ==========================================

export function useToggleWiki() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (docId: string) => {
      const res = await api.patch(`/docs/${docId}/wiki`);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['docs-hub'] }),
  });
}

// ==========================================
// Sub-pages
// ==========================================

export function useSubPages(docId: string | undefined) {
  return useQuery<DocSubPage[]>({
    queryKey: ['doc-sub-pages', docId],
    queryFn: async () => {
      const res = await api.get(`/docs/${docId}/sub-pages`);
      return res.data;
    },
    enabled: !!docId,
  });
}

export function useCreateSubPage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ parentDocId, data }: { parentDocId: string; data: { title?: string; contentJson?: any; icon?: string } }) => {
      const res = await api.post(`/docs/${parentDocId}/sub-pages`, data);
      return res.data;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['doc-sub-pages', vars.parentDocId] });
      qc.invalidateQueries({ queryKey: ['docs-hub'] });
    },
  });
}

// ==========================================
// Publishing
// ==========================================

export function usePublishDoc() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ docId, customSlug }: { docId: string; customSlug?: string }) => {
      const res = await api.post(`/docs/${docId}/publish`, { customSlug });
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['docs-hub'] }),
  });
}

export function useUnpublishDoc() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (docId: string) => {
      const res = await api.post(`/docs/${docId}/unpublish`);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['docs-hub'] }),
  });
}

export function usePublishedDoc(slug: string | undefined) {
  return useQuery({
    queryKey: ['published-doc', slug],
    queryFn: async () => {
      const res = await api.get(`/docs/public/${slug}`);
      return res.data;
    },
    enabled: !!slug,
  });
}

// ==========================================
// Task Linking
// ==========================================

export function useLinkDocToTask() {
  return useMutation({
    mutationFn: async ({ docId, taskId }: { docId: string; taskId: string }) => {
      const res = await api.post(`/docs/${docId}/link-task`, { taskId });
      return res.data;
    },
  });
}

export function useDocsForTask(taskId: string | undefined) {
  return useQuery({
    queryKey: ['docs-for-task', taskId],
    queryFn: async () => {
      const res = await api.get(`/docs/task/${taskId}`);
      return res.data;
    },
    enabled: !!taskId,
  });
}

// ==========================================
// Enhanced Comments
// ==========================================

export function useDocComments(docId: string | undefined) {
  return useQuery<DocCommentEnhanced[]>({
    queryKey: ['doc-comments', docId],
    queryFn: async () => {
      const res = await api.get(`/docs/${docId}/comments`);
      return res.data;
    },
    enabled: !!docId,
  });
}

export function useCreateDocComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ docId, data }: { docId: string; data: { content: string; highlightedText?: string; positionJson?: any; parentCommentId?: string } }) => {
      const res = await api.post(`/docs/${docId}/comments`, data);
      return res.data;
    },
    onSuccess: (_data, vars) => qc.invalidateQueries({ queryKey: ['doc-comments', vars.docId] }),
  });
}

export function useUpdateDocComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ commentId, data }: { commentId: string; data: { content?: string; isResolved?: boolean } }) => {
      const res = await api.patch(`/docs/comments/${commentId}`, data);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['doc-comments'] }),
  });
}

export function useDeleteDocComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (commentId: string) => {
      const res = await api.delete(`/docs/comments/${commentId}`);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['doc-comments'] }),
  });
}

export function useResolveDocComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (commentId: string) => {
      const res = await api.post(`/docs/comments/${commentId}/resolve`);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['doc-comments'] }),
  });
}

// ==========================================
// Templates
// ==========================================

export function useDocTemplates(workspaceId: string | undefined) {
  return useQuery<DocTemplate[]>({
    queryKey: ['doc-templates', workspaceId],
    queryFn: async () => {
      const res = await api.get(`/docs/templates?workspaceId=${workspaceId}`);
      return res.data;
    },
    enabled: !!workspaceId,
  });
}

export function useCreateDocTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { workspaceId: string; name: string; description?: string; content: string; contentJson?: any; category?: string }) => {
      const res = await api.post('/docs/templates', data);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['doc-templates'] }),
  });
}

export function useCreateDocFromTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ docId, templateId, parentDocId }: { docId?: string; templateId: string; parentDocId?: string }) => {
      const target = docId || 'new';
      const res = await api.post(`/docs/${target}/from-template`, { templateId, parentDocId });
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['docs-hub'] }),
  });
}

export function useSaveDocAsTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ docId, name, workspaceId, description, category }: { docId: string; name: string; workspaceId: string; description?: string; category?: string }) => {
      const res = await api.post(`/docs/${docId}/save-as-template`, { name, workspaceId, description, category });
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['doc-templates'] }),
  });
}
