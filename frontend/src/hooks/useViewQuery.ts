import { useQuery } from '@tanstack/react-query';
import { useState, useEffect, useRef } from 'react';
import { api } from '@/lib/api';
import type { FilterCondition, SortCondition } from './useViews';

export interface TaskQueryParams {
  locationType: string;
  locationId: string;
  filters?: FilterCondition[];
  sorts?: SortCondition[];
  groupBy?: string;
  subGroupBy?: string;
  showSubtasks?: boolean;
  showClosedTasks?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}

interface TaskQueryResult {
  tasks: unknown[];
  total: number;
  groups: Record<string, unknown[]>;
  hasMore: boolean;
}

/**
 * Hook for the task query engine.
 * Debounces param changes by 300ms before refetching.
 */
export function useViewQuery(params: TaskQueryParams) {
  const [debouncedParams, setDebouncedParams] = useState(params);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => {
      setDebouncedParams(params);
    }, 300);
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [params]);

  const query = useQuery<TaskQueryResult>({
    queryKey: ['viewQuery', debouncedParams],
    queryFn: async () => {
      const { data } = await api.post('/views/query', debouncedParams);
      return data.data ?? data;
    },
    enabled: !!debouncedParams.locationType && !!debouncedParams.locationId,
  });

  return {
    tasks: query.data?.tasks ?? [],
    total: query.data?.total ?? 0,
    groups: query.data?.groups ?? {},
    hasMore: query.data?.hasMore ?? false,
    isLoading: query.isLoading,
    error: query.error,
  };
}
