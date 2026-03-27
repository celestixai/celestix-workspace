import { Router, Request, Response } from 'express';
import { aiService } from './ai.service';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import {
  chatSchema,
  summarizeSchema,
  generateSchema,
  autofillSchema,
  subtasksSchema,
  standupSchema,
  translateSchema,
  searchSchema,
} from './ai.validation';

const router = Router();

// =====================================================
// Public routes
// =====================================================

// GET /status — AI availability check (no auth required)
router.get('/status', async (_req: Request, res: Response) => {
  const status = await aiService.getStatus();
  res.json(status);
});

// =====================================================
// Authenticated routes
// =====================================================

// POST /chat — general chat (supports SSE streaming)
router.post('/chat', authenticate, validate(chatSchema), async (req: Request, res: Response) => {
  const { message, conversationId } = req.body;
  const userId = req.user!.id;
  const wantStream = req.query.stream === 'true' || req.headers.accept === 'text/event-stream';

  if (wantStream) {
    const result = await aiService.chatStream(userId, message, conversationId);

    if (!result.success || !result.data) {
      res.status(result.fallback ? 503 : 500).json(result);
      return;
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });

    // Send the conversationId first
    res.write(`data: ${JSON.stringify({ conversationId: result.data.conversationId })}\n\n`);

    let fullReply = '';
    try {
      for await (const chunk of result.data.stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          fullReply += content;
          res.write(`data: ${JSON.stringify({ content })}\n\n`);
        }
      }

      // Save the complete reply to conversation history
      await aiService.saveStreamedReply(userId, result.data.conversationId, fullReply);

      res.write('data: [DONE]\n\n');
      res.end();
    } catch (err) {
      res.write(`data: ${JSON.stringify({ error: 'Stream interrupted' })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
    }
  } else {
    const result = await aiService.chat(userId, message, conversationId);
    if (!result.success) {
      res.status(result.fallback ? 503 : 500).json(result);
      return;
    }
    res.json(result);
  }
});

// POST /summarize — summarize content
router.post('/summarize', authenticate, validate(summarizeSchema), async (req: Request, res: Response) => {
  const { type, content } = req.body;
  const result = await aiService.summarize(type, content);
  if (!result.success) {
    res.status(result.fallback ? 503 : 500).json(result);
    return;
  }
  res.json(result);
});

// POST /generate — generate content
router.post('/generate', authenticate, validate(generateSchema), async (req: Request, res: Response) => {
  const { type, prompt, context } = req.body;
  const result = await aiService.generateContent(type, prompt, context);
  if (!result.success) {
    res.status(result.fallback ? 503 : 500).json(result);
    return;
  }
  res.json(result);
});

// POST /autofill-task — auto-fill task from title
router.post('/autofill-task', authenticate, validate(autofillSchema), async (req: Request, res: Response) => {
  const { title, context } = req.body;
  const result = await aiService.autofillTask(title, context);
  if (!result.success) {
    res.status(result.fallback ? 503 : 500).json(result);
    return;
  }
  res.json(result);
});

// POST /generate-subtasks — generate subtask suggestions
router.post('/generate-subtasks', authenticate, validate(subtasksSchema), async (req: Request, res: Response) => {
  const { title, description } = req.body;
  const result = await aiService.generateSubtasks(title, description);
  if (!result.success) {
    res.status(result.fallback ? 503 : 500).json(result);
    return;
  }
  res.json(result);
});

// POST /standup — generate standup
router.post('/standup', authenticate, validate(standupSchema), async (req: Request, res: Response) => {
  const { startDate, endDate } = req.body;
  const userId = req.user!.id;
  const result = await aiService.writeStandup(userId, { startDate, endDate });
  if (!result.success) {
    res.status(result.fallback ? 503 : 500).json(result);
    return;
  }
  res.json(result);
});

// POST /translate — translate content
router.post('/translate', authenticate, validate(translateSchema), async (req: Request, res: Response) => {
  const { text, targetLanguage } = req.body;
  const result = await aiService.translateContent(text, targetLanguage);
  if (!result.success) {
    res.status(result.fallback ? 503 : 500).json(result);
    return;
  }
  res.json(result);
});

// POST /search — AI-enhanced search
router.post('/search', authenticate, validate(searchSchema), async (req: Request, res: Response) => {
  const { query, workspaceId } = req.body;
  const result = await aiService.searchWorkspace(query, workspaceId);
  if (!result.success) {
    res.status(result.fallback ? 503 : 500).json(result);
    return;
  }
  res.json(result);
});

// GET /conversations — list conversations
router.get('/conversations', authenticate, async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const result = await aiService.getConversations(userId);
  if (!result.success) {
    res.status(500).json(result);
    return;
  }
  res.json(result);
});

// DELETE /conversations/:id — delete conversation
router.delete('/conversations/:id', authenticate, async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const convId = req.params.id;
  const result = await aiService.deleteConversation(userId, convId);
  if (!result.success) {
    res.status(500).json(result);
    return;
  }
  res.json(result);
});

// GET /models — list Ollama models
router.get('/models', authenticate, async (_req: Request, res: Response) => {
  const result = await aiService.getModels();
  if (!result.success) {
    res.status(result.fallback ? 503 : 500).json(result);
    return;
  }
  res.json(result);
});

export default router;
