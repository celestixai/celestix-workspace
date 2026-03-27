import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useState, useEffect, useRef } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SearchResultItem {
  type: string;
  id: string;
  title: string;
  preview?: string;
  module: string;
  timestamp: string;
  link: string;
  relevanceScore: number;
  breadcrumb?: string;
}

export interface SearchFacets {
  byType: Record<string, number>;
  bySpace: Record<string, number>;
}

export interface AdvancedSearchResponse {
  results: SearchResultItem[];
  total: number;
  facets: SearchFacets;
  aiSummary?: string;
}

export interface AdvancedSearchParams {
  q: string;
  types?: string[];
  spaceId?: string;
  assigneeId?: string;
  dateFrom?: string;
  dateTo?: string;
  status?: string;
  priority?: string;
  sortBy?: 'relevance' | 'date' | 'title';
  page?: number;
  limit?: number;
}

export interface SearchHistoryItem {
  query: string;
  timestamp: string;
}

export interface SavedSearch {
  id: string;
  name: string;
  query: Record<string, unknown>;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// useAdvancedSearch — debounced GET /search/advanced
// ---------------------------------------------------------------------------

export function useAdvancedSearch(params: AdvancedSearchParams | null) {
  const [debouncedParams, setDebouncedParams] = useState<AdvancedSearchParams | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    if (!params || !params.q || params.q.length < 2) {
      setDebouncedParams(null);
      return;
    }

    timerRef.current = setTimeout(() => {
      setDebouncedParams(params);
    }, 300);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [params?.q, params?.types?.join(','), params?.spaceId, params?.sortBy, params?.page]);

  return useQuery<AdvancedSearchResponse>({
    queryKey: ['search', 'advanced', debouncedParams],
    queryFn: async () => {
      if (!debouncedParams) return { results: [], total: 0, facets: { byType: {}, bySpace: {} } };
      const { data } = await api.get('/search/advanced', {
        params: {
          q: debouncedParams.q,
          types: debouncedParams.types?.join(','),
          spaceId: debouncedParams.spaceId,
          assigneeId: debouncedParams.assigneeId,
          dateFrom: debouncedParams.dateFrom,
          dateTo: debouncedParams.dateTo,
          status: debouncedParams.status,
          priority: debouncedParams.priority,
          sortBy: debouncedParams.sortBy,
          page: debouncedParams.page,
          limit: debouncedParams.limit,
        },
      });
      return data.data;
    },
    enabled: !!debouncedParams && debouncedParams.q.length >= 2,
    staleTime: 30_000,
  });
}

// ---------------------------------------------------------------------------
// useDeepSearch — POST /search/deep mutation
// ---------------------------------------------------------------------------

export function useDeepSearch() {
  return useMutation<AdvancedSearchResponse, Error, { q: string; workspaceId: string }>({
    mutationFn: async ({ q, workspaceId }) => {
      const { data } = await api.post('/search/deep', { q, workspaceId });
      return data.data;
    },
  });
}

// ---------------------------------------------------------------------------
// useSearchHistory — GET /search/history
// ---------------------------------------------------------------------------

export function useSearchHistory() {
  return useQuery<SearchHistoryItem[]>({
    queryKey: ['search', 'history'],
    queryFn: async () => {
      const { data } = await api.get('/search/history');
      return data.data.history;
    },
    staleTime: 60_000,
  });
}

// ---------------------------------------------------------------------------
// useClearSearchHistory — DELETE /search/history
// ---------------------------------------------------------------------------

export function useClearSearchHistory() {
  const qc = useQueryClient();
  return useMutation<void, Error>({
    mutationFn: async () => {
      await api.delete('/search/history');
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['search', 'history'] });
    },
  });
}

// ---------------------------------------------------------------------------
// useSaveSearch — POST /search/save mutation
// ---------------------------------------------------------------------------

export function useSaveSearch() {
  const qc = useQueryClient();
  return useMutation<{ id: string }, Error, { name: string; query: Record<string, unknown> }>({
    mutationFn: async ({ name, query }) => {
      const { data } = await api.post('/search/save', { name, query });
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['search', 'saved'] });
    },
  });
}

// ---------------------------------------------------------------------------
// useSavedSearches — GET /search/saved
// ---------------------------------------------------------------------------

export function useSavedSearches() {
  return useQuery<SavedSearch[]>({
    queryKey: ['search', 'saved'],
    queryFn: async () => {
      const { data } = await api.get('/search/saved');
      return data.data.saved;
    },
    staleTime: 60_000,
  });
}

// ---------------------------------------------------------------------------
// useDeleteSavedSearch — DELETE /search/saved/:id
// ---------------------------------------------------------------------------

export function useDeleteSavedSearch() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (id) => {
      await api.delete(`/search/saved/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['search', 'saved'] });
    },
  });
}
