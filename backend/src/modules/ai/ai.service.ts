import { v4 as uuidv4 } from 'uuid';
import { aiClient, AI_MODEL, AI_ENABLED, AI_BASE_URL } from './ai.config';
import * as prompts from './ai.prompts';
import { redis } from '../../config/redis';
import { prisma } from '../../config/database';
import { logger } from '../../utils/logger';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import type { Stream } from 'openai/streaming';
import type { ChatCompletion, ChatCompletionChunk } from 'openai/resources/chat/completions';

const CONV_TTL = 3600; // 1 hour
const MAX_CONV_MESSAGES = 20;

interface AiResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  fallback?: boolean;
}

function convKey(userId: string, convId: string): string {
  return `ai:conv:${userId}:${convId}`;
}

function isConnectionError(err: unknown): boolean {
  const msg = String(err);
  return msg.includes('ECONNREFUSED') || msg.includes('fetch failed') || msg.includes('network');
}

function aiUnavailableResult(): AiResult {
  return { success: false, error: 'AI service unavailable', fallback: true };
}

function aiDisabledResult(): AiResult {
  return { success: false, error: 'AI is disabled', fallback: true };
}

async function getConversationMessages(
  userId: string,
  convId: string,
): Promise<ChatCompletionMessageParam[]> {
  try {
    const raw = await redis.get(convKey(userId, convId));
    if (!raw) return [];
    return JSON.parse(raw) as ChatCompletionMessageParam[];
  } catch {
    return [];
  }
}

async function saveConversationMessages(
  userId: string,
  convId: string,
  messages: ChatCompletionMessageParam[],
): Promise<void> {
  try {
    // Keep only the last MAX_CONV_MESSAGES messages (plus system prompt)
    const trimmed =
      messages.length > MAX_CONV_MESSAGES + 1
        ? [messages[0], ...messages.slice(-(MAX_CONV_MESSAGES))]
        : messages;
    await redis.set(convKey(userId, convId), JSON.stringify(trimmed), 'EX', CONV_TTL);
  } catch (err) {
    logger.warn({ err }, 'Failed to save conversation to Redis');
  }
}

async function completeChat(
  messages: ChatCompletionMessageParam[],
): Promise<string> {
  const response: ChatCompletion = await aiClient.chat.completions.create({
    model: AI_MODEL,
    messages,
  });
  return response.choices[0]?.message?.content || '';
}

async function completeChatStream(
  messages: ChatCompletionMessageParam[],
): Promise<Stream<ChatCompletionChunk>> {
  const stream = await aiClient.chat.completions.create({
    model: AI_MODEL,
    messages,
    stream: true,
  });
  return stream;
}

// =====================================================
// Service methods
// =====================================================

async function chat(
  userId: string,
  message: string,
  conversationId?: string,
): Promise<AiResult<{ reply: string; conversationId: string }>> {
  if (!AI_ENABLED) return aiDisabledResult();

  const convId = conversationId || uuidv4();

  try {
    const history = await getConversationMessages(userId, convId);

    const messages: ChatCompletionMessageParam[] =
      history.length > 0
        ? [...history, { role: 'user' as const, content: message }]
        : [
            { role: 'system' as const, content: prompts.GENERAL_CHAT },
            { role: 'user' as const, content: message },
          ];

    const reply = await completeChat(messages);

    messages.push({ role: 'assistant' as const, content: reply });
    await saveConversationMessages(userId, convId, messages);

    return { success: true, data: { reply, conversationId: convId } };
  } catch (err) {
    logger.error({ err }, 'AI chat error');
    if (isConnectionError(err)) return aiUnavailableResult();
    return { success: false, error: 'AI chat failed' };
  }
}

async function chatStream(
  userId: string,
  message: string,
  conversationId?: string,
): Promise<AiResult<{ stream: Stream<ChatCompletionChunk>; conversationId: string }>> {
  if (!AI_ENABLED) return aiDisabledResult();

  const convId = conversationId || uuidv4();

  try {
    const history = await getConversationMessages(userId, convId);

    const messages: ChatCompletionMessageParam[] =
      history.length > 0
        ? [...history, { role: 'user' as const, content: message }]
        : [
            { role: 'system' as const, content: prompts.GENERAL_CHAT },
            { role: 'user' as const, content: message },
          ];

    const stream = await completeChatStream(messages);

    // Save the user message; the assistant message will be saved when stream is done
    await saveConversationMessages(userId, convId, messages);

    return { success: true, data: { stream, conversationId: convId } };
  } catch (err) {
    logger.error({ err }, 'AI chat stream error');
    if (isConnectionError(err)) return aiUnavailableResult();
    return { success: false, error: 'AI chat stream failed' };
  }
}

async function saveStreamedReply(
  userId: string,
  conversationId: string,
  reply: string,
): Promise<void> {
  const history = await getConversationMessages(userId, conversationId);
  history.push({ role: 'assistant' as const, content: reply });
  await saveConversationMessages(userId, conversationId, history);
}

async function summarize(
  type: string,
  content: string,
): Promise<AiResult<{ summary: string }>> {
  if (!AI_ENABLED) return aiDisabledResult();

  try {
    const systemPrompt =
      type === 'doc' ? prompts.DOC_SUMMARIZE : prompts.TASK_SUMMARIZE;

    const reply = await completeChat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Type: ${type}\n\nContent:\n${content}` },
    ]);

    return { success: true, data: { summary: reply } };
  } catch (err) {
    logger.error({ err }, 'AI summarize error');
    if (isConnectionError(err)) return aiUnavailableResult();
    return { success: false, error: 'AI summarization failed' };
  }
}

async function generateContent(
  type: string,
  prompt: string,
  context?: string,
): Promise<AiResult<{ content: string }>> {
  if (!AI_ENABLED) return aiDisabledResult();

  try {
    const systemPrompt =
      type === 'task_description' ? prompts.TASK_DESCRIPTION : prompts.CONTENT_GENERATE;

    const userMsg = context
      ? `Type: ${type}\nPrompt: ${prompt}\nContext: ${context}`
      : `Type: ${type}\nPrompt: ${prompt}`;

    const reply = await completeChat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMsg },
    ]);

    return { success: true, data: { content: reply } };
  } catch (err) {
    logger.error({ err }, 'AI generate error');
    if (isConnectionError(err)) return aiUnavailableResult();
    return { success: false, error: 'AI content generation failed' };
  }
}

async function autofillTask(
  taskTitle: string,
  context?: string,
): Promise<AiResult<{ description: string; priority: string; estimatedHours: number; taskType: string }>> {
  if (!AI_ENABLED) return aiDisabledResult();

  try {
    const userMsg = context
      ? `Task title: "${taskTitle}"\nContext: ${context}`
      : `Task title: "${taskTitle}"`;

    const reply = await completeChat([
      { role: 'system', content: prompts.TASK_AUTOFILL },
      { role: 'user', content: userMsg },
    ]);

    try {
      // Try to extract JSON from the response
      const jsonMatch = reply.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found');
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        success: true,
        data: {
          description: String(parsed.description || ''),
          priority: String(parsed.priority || 'MEDIUM'),
          estimatedHours: Number(parsed.estimatedHours) || 1,
          taskType: String(parsed.taskType || 'feature'),
        },
      };
    } catch {
      // JSON parse failed — return the raw text as description
      return {
        success: true,
        data: {
          description: reply,
          priority: 'MEDIUM',
          estimatedHours: 1,
          taskType: 'feature',
        },
      };
    }
  } catch (err) {
    logger.error({ err }, 'AI autofill error');
    if (isConnectionError(err)) return aiUnavailableResult();
    return { success: false, error: 'AI autofill failed' };
  }
}

async function categorizeTask(
  title: string,
  description?: string,
): Promise<AiResult<{ category: string }>> {
  if (!AI_ENABLED) return aiDisabledResult();

  try {
    const userMsg = description
      ? `Title: "${title}"\nDescription: "${description}"`
      : `Title: "${title}"`;

    const reply = await completeChat([
      { role: 'system', content: prompts.CATEGORIZE },
      { role: 'user', content: userMsg },
    ]);

    return { success: true, data: { category: reply.trim().toLowerCase() } };
  } catch (err) {
    logger.error({ err }, 'AI categorize error');
    if (isConnectionError(err)) return aiUnavailableResult();
    return { success: false, error: 'AI categorization failed' };
  }
}

async function prioritizeTask(
  title: string,
  description?: string,
): Promise<AiResult<{ priority: string }>> {
  if (!AI_ENABLED) return aiDisabledResult();

  try {
    const userMsg = description
      ? `Title: "${title}"\nDescription: "${description}"`
      : `Title: "${title}"`;

    const reply = await completeChat([
      { role: 'system', content: prompts.PRIORITIZE },
      { role: 'user', content: userMsg },
    ]);

    return { success: true, data: { priority: reply.trim().toUpperCase() } };
  } catch (err) {
    logger.error({ err }, 'AI prioritize error');
    if (isConnectionError(err)) return aiUnavailableResult();
    return { success: false, error: 'AI prioritization failed' };
  }
}

async function generateSubtasks(
  title: string,
  description?: string,
): Promise<AiResult<{ subtasks: string[] }>> {
  if (!AI_ENABLED) return aiDisabledResult();

  try {
    const userMsg = description
      ? `Task title: "${title}"\nDescription: "${description}"`
      : `Task title: "${title}"`;

    const reply = await completeChat([
      { role: 'system', content: prompts.SUBTASK_GENERATE },
      { role: 'user', content: userMsg },
    ]);

    try {
      const jsonMatch = reply.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error('No JSON array found');
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed)) {
        return { success: true, data: { subtasks: parsed.map(String) } };
      }
      throw new Error('Not an array');
    } catch {
      // Fallback: split by newlines, clean up
      const lines = reply
        .split('\n')
        .map((l) => l.replace(/^[\d\-\*\.\)]+\s*/, '').trim())
        .filter((l) => l.length > 0);
      return { success: true, data: { subtasks: lines } };
    }
  } catch (err) {
    logger.error({ err }, 'AI subtasks error');
    if (isConnectionError(err)) return aiUnavailableResult();
    return { success: false, error: 'AI subtask generation failed' };
  }
}

async function writeStandup(
  userId: string,
  dateRange: { startDate: string; endDate: string },
): Promise<AiResult<{ standup: string }>> {
  if (!AI_ENABLED) return aiDisabledResult();

  try {
    // Query user's recent task activity
    const tasks = await prisma.task.findMany({
      where: {
        OR: [
          { assignees: { some: { userId } } },
          { createdById: userId },
        ],
        updatedAt: {
          gte: new Date(dateRange.startDate),
          lte: new Date(dateRange.endDate),
        },
      },
      select: {
        title: true,
        status: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: 'desc' },
      take: 30,
    });

    if (tasks.length === 0) {
      return {
        success: true,
        data: {
          standup:
            '**Yesterday:**\n- No recorded activity\n\n**Today:**\n- (Add your planned tasks)\n\n**Blockers:**\n- None',
        },
      };
    }

    const taskList = tasks
      .map((t) => `- [${t.status}] ${t.title} (updated ${t.updatedAt.toISOString()})`)
      .join('\n');

    const reply = await completeChat([
      { role: 'system', content: prompts.STANDUP_WRITE },
      {
        role: 'user',
        content: `Date range: ${dateRange.startDate} to ${dateRange.endDate}\n\nTasks:\n${taskList}`,
      },
    ]);

    return { success: true, data: { standup: reply } };
  } catch (err) {
    logger.error({ err }, 'AI standup error');
    if (isConnectionError(err)) return aiUnavailableResult();
    return { success: false, error: 'AI standup generation failed' };
  }
}

async function translateContent(
  text: string,
  targetLanguage: string,
): Promise<AiResult<{ translated: string }>> {
  if (!AI_ENABLED) return aiDisabledResult();

  try {
    const reply = await completeChat([
      { role: 'system', content: prompts.TRANSLATE },
      { role: 'user', content: `Translate to ${targetLanguage}:\n\n${text}` },
    ]);

    return { success: true, data: { translated: reply } };
  } catch (err) {
    logger.error({ err }, 'AI translate error');
    if (isConnectionError(err)) return aiUnavailableResult();
    return { success: false, error: 'AI translation failed' };
  }
}

async function searchWorkspace(
  query: string,
  workspaceId: string,
): Promise<AiResult<{ results: any[] }>> {
  try {
    // First: DB search for tasks and notes
    // Note: workspaceId is used to scope the search via project members
    const [tasks, notes] = await Promise.all([
      prisma.task.findMany({
        where: {
          title: { contains: query, mode: 'insensitive' },
          deletedAt: null,
        },
        select: { id: true, title: true, status: true },
        take: 20,
      }),
      prisma.note.findMany({
        where: {
          OR: [
            { title: { contains: query, mode: 'insensitive' } },
            { contentText: { contains: query, mode: 'insensitive' } },
          ],
          deletedAt: null,
        },
        select: { id: true, title: true },
        take: 10,
      }),
    ]);

    const results = [
      ...tasks.map((t) => ({ type: 'task', id: t.id, title: t.title, status: t.status })),
      ...notes.map((n) => ({ type: 'note', id: n.id, title: n.title })),
    ];

    // If AI is available, try to rank the results
    if (AI_ENABLED && results.length > 1) {
      try {
        const resultSummary = results
          .map((r, i) => `[${i}] (${r.type}) ${r.title}`)
          .join('\n');

        const reply = await completeChat([
          { role: 'system', content: prompts.SEARCH_RANK },
          { role: 'user', content: `Query: "${query}"\n\nResults:\n${resultSummary}` },
        ]);

        const jsonMatch = reply.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const indices = JSON.parse(jsonMatch[0]) as number[];
          const ranked = indices
            .filter((i) => i >= 0 && i < results.length)
            .map((i) => results[i]);
          if (ranked.length > 0) {
            return { success: true, data: { results: ranked } };
          }
        }
      } catch {
        // AI ranking failed — return unranked results
      }
    }

    return { success: true, data: { results } };
  } catch (err) {
    logger.error({ err }, 'AI search error');
    return { success: false, error: 'Search failed' };
  }
}

async function getStatus(): Promise<{
  enabled: boolean;
  model: string;
  provider: string;
  baseUrl: string;
  isAvailable: boolean;
  note: string;
}> {
  const base = {
    enabled: AI_ENABLED,
    model: AI_MODEL,
    provider: 'ollama',
    baseUrl: AI_BASE_URL,
    isAvailable: false,
    note: '',
  };

  if (!AI_ENABLED) {
    base.note = 'AI is disabled. Set AI_ENABLED=true and ensure an AI provider is reachable at AI_BASE_URL.';
    return base;
  }

  try {
    // Try to reach the Ollama API
    const baseUrl = AI_BASE_URL.replace(/\/v1\/?$/, '');
    const response = await fetch(`${baseUrl}/api/tags`, {
      signal: AbortSignal.timeout(3000),
    });
    base.isAvailable = response.ok;
    if (!response.ok) {
      base.note = `AI provider responded with status ${response.status}. Verify AI_BASE_URL (${AI_BASE_URL}) is correct.`;
    }
  } catch {
    base.isAvailable = false;
    base.note = `Cannot reach AI provider at ${AI_BASE_URL}. Ensure the service is running or update AI_BASE_URL.`;
  }

  return base;
}

async function getModels(): Promise<AiResult<{ models: any[] }>> {
  try {
    const baseUrl = AI_BASE_URL.replace(/\/v1\/?$/, '');
    const response = await fetch(`${baseUrl}/api/tags`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      return { success: false, error: 'Failed to fetch models' };
    }
    const data = (await response.json()) as { models?: any[] };
    return { success: true, data: { models: data.models || [] } };
  } catch (err) {
    logger.error({ err }, 'AI getModels error');
    if (isConnectionError(err)) return aiUnavailableResult();
    return { success: false, error: 'Failed to fetch models' };
  }
}

async function getConversations(userId: string): Promise<AiResult<{ conversations: string[] }>> {
  try {
    // Redis SCAN to find conversation keys for this user
    const pattern = `ai:conv:${userId}:*`;
    const conversations: string[] = [];

    // If the redis instance supports keys (it's a real ioredis instance)
    if (typeof (redis as any).keys === 'function') {
      const keys = await (redis as any).keys(pattern);
      for (const key of keys) {
        const convId = key.replace(`ai:conv:${userId}:`, '');
        conversations.push(convId);
      }
    }

    return { success: true, data: { conversations } };
  } catch (err) {
    logger.error({ err }, 'AI getConversations error');
    return { success: false, error: 'Failed to list conversations' };
  }
}

async function deleteConversation(
  userId: string,
  conversationId: string,
): Promise<AiResult<{ deleted: boolean }>> {
  try {
    await redis.del(convKey(userId, conversationId));
    return { success: true, data: { deleted: true } };
  } catch (err) {
    logger.error({ err }, 'AI deleteConversation error');
    return { success: false, error: 'Failed to delete conversation' };
  }
}

export const aiService = {
  chat,
  chatStream,
  saveStreamedReply,
  summarize,
  generateContent,
  autofillTask,
  categorizeTask,
  prioritizeTask,
  generateSubtasks,
  writeStandup,
  translateContent,
  searchWorkspace,
  getStatus,
  getModels,
  getConversations,
  deleteConversation,
};
