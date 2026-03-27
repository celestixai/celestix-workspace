import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useState, useCallback, useRef } from 'react';
import { useAuthStore } from '@/stores/auth.store';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AIStatus {
  enabled: boolean;
  model: string;
  provider: string;
  isAvailable: boolean;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface SummarizePayload {
  text: string;
  format?: string;
}

interface GeneratePayload {
  prompt: string;
  type?: string;
  context?: string;
}

interface AutofillPayload {
  title: string;
}

interface AutofillResult {
  description?: string;
  priority?: string;
  estimatedHours?: number;
  taskType?: string;
}

interface SubtasksPayload {
  taskId: string;
  title: string;
  description?: string;
}

interface StandupPayload {
  date?: string;
}

interface TranslatePayload {
  text: string;
  targetLanguage: string;
}

// ---------------------------------------------------------------------------
// useAIStatus — poll AI availability every 60s
// ---------------------------------------------------------------------------

export function useAIStatus() {
  return useQuery<AIStatus>({
    queryKey: ['ai', 'status'],
    queryFn: async () => {
      const { data } = await api.get('/ai/status');
      return data.data ?? data;
    },
    refetchInterval: 60_000,
    retry: 1,
    staleTime: 30_000,
  });
}

// ---------------------------------------------------------------------------
// useAIChat — streaming chat via SSE
// ---------------------------------------------------------------------------

export function useAIChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(
    async (message: string, conversationId?: string) => {
      setError(null);

      // Append user message
      setMessages((prev) => [...prev, { role: 'user', content: message }]);

      // Add empty assistant placeholder
      setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);

      setIsStreaming(true);

      try {
        const controller = new AbortController();
        abortRef.current = controller;

        const token = useAuthStore.getState().token;
        const baseURL = api.defaults.baseURL || '/api/v1';

        const params = new URLSearchParams({ stream: 'true' });
        if (conversationId) params.set('conversationId', conversationId);

        const response = await fetch(`${baseURL}/ai/chat?${params.toString()}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ message, conversationId }),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`AI request failed (${response.status})`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error('No response stream');

        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Process SSE lines
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data: ')) continue;

            const jsonStr = trimmed.slice(6);
            if (jsonStr === '[DONE]') continue;

            try {
              const parsed = JSON.parse(jsonStr);
              const chunk = parsed.content ?? parsed.text ?? '';
              if (chunk) {
                setMessages((prev) => {
                  const copy = [...prev];
                  const last = copy[copy.length - 1];
                  if (last?.role === 'assistant') {
                    copy[copy.length - 1] = { ...last, content: last.content + chunk };
                  }
                  return copy;
                });
              }
            } catch {
              // skip non-JSON SSE lines
            }
          }
        }
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        const msg = err instanceof Error ? err.message : 'Unknown error';
        setError(msg);
        // Remove empty assistant message on error
        setMessages((prev) => {
          const copy = [...prev];
          const last = copy[copy.length - 1];
          if (last?.role === 'assistant' && !last.content) copy.pop();
          return copy;
        });
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [],
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return { messages, isStreaming, error, sendMessage, clearMessages, stopStreaming };
}

// ---------------------------------------------------------------------------
// Mutation hooks
// ---------------------------------------------------------------------------

export function useAISummarize() {
  return useMutation({
    mutationFn: async (payload: SummarizePayload) => {
      const { data } = await api.post('/ai/summarize', payload);
      return data.data ?? data;
    },
  });
}

export function useAIGenerate() {
  return useMutation({
    mutationFn: async (payload: GeneratePayload) => {
      const { data } = await api.post('/ai/generate', payload);
      return data.data ?? data;
    },
  });
}

export function useAIAutofill() {
  return useMutation<AutofillResult, Error, AutofillPayload>({
    mutationFn: async (payload) => {
      const { data } = await api.post('/ai/autofill-task', payload);
      return data.data ?? data;
    },
  });
}

export function useAISubtasks() {
  return useMutation({
    mutationFn: async (payload: SubtasksPayload) => {
      const { data } = await api.post('/ai/generate-subtasks', payload);
      return data.data ?? data;
    },
  });
}

export function useAIStandup() {
  return useMutation({
    mutationFn: async (payload: StandupPayload) => {
      const { data } = await api.post('/ai/standup', payload);
      return data.data ?? data;
    },
  });
}

export function useAITranslate() {
  return useMutation({
    mutationFn: async (payload: TranslatePayload) => {
      const { data } = await api.post('/ai/translate', payload);
      return data.data ?? data;
    },
  });
}
