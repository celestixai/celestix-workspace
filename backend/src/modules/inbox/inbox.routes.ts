import { Router, Request, Response } from 'express';
import { inboxService } from './inbox.service';
import { snoozeSchema } from './inbox.validation';
import { authenticate } from '../../middleware/auth';
import type { InboxCategory } from '@prisma/client';

const router = Router();

// GET /api/v1/inbox — list items
router.get('/', authenticate, async (req: Request, res: Response) => {
  const category = req.query.category as InboxCategory | undefined;
  const limit = parseInt(req.query.limit as string) || 50;
  const cursor = req.query.cursor as string | undefined;
  const result = await inboxService.getInboxItems(req.user!.id, category, limit, cursor);
  res.json({ success: true, data: result });
});

// GET /api/v1/inbox/counts — unread counts per category
router.get('/counts', authenticate, async (req: Request, res: Response) => {
  const counts = await inboxService.getCounts(req.user!.id);
  res.json({ success: true, data: counts });
});

// PATCH /api/v1/inbox/:itemId/read — mark read
router.patch('/:itemId/read', authenticate, async (req: Request, res: Response) => {
  await inboxService.markRead(req.params.itemId, req.user!.id);
  res.json({ success: true, data: { read: true } });
});

// PATCH /api/v1/inbox/:itemId/action — mark actioned
router.patch('/:itemId/action', authenticate, async (req: Request, res: Response) => {
  await inboxService.markActioned(req.params.itemId, req.user!.id);
  res.json({ success: true, data: { actioned: true } });
});

// POST /api/v1/inbox/:itemId/snooze — snooze
router.post('/:itemId/snooze', authenticate, async (req: Request, res: Response) => {
  const parsed = snoozeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: parsed.error.errors });
  }
  await inboxService.snooze(req.params.itemId, req.user!.id, new Date(parsed.data.until));
  res.json({ success: true, data: { snoozed: true } });
});

// POST /api/v1/inbox/:itemId/save — toggle save
router.post('/:itemId/save', authenticate, async (req: Request, res: Response) => {
  const item = await inboxService.save(req.params.itemId, req.user!.id);
  res.json({ success: true, data: item });
});

// DELETE /api/v1/inbox/:itemId — delete
router.delete('/:itemId', authenticate, async (req: Request, res: Response) => {
  await inboxService.deleteItem(req.params.itemId, req.user!.id);
  res.json({ success: true, data: { deleted: true } });
});

// POST /api/v1/inbox/clear-all — clear read+actioned items
router.post('/clear-all', authenticate, async (req: Request, res: Response) => {
  await inboxService.clearAllRead(req.user!.id);
  res.json({ success: true, data: { cleared: true } });
});

// POST /api/v1/inbox/read-all — mark all read
router.post('/read-all', authenticate, async (req: Request, res: Response) => {
  await inboxService.markAllRead(req.user!.id);
  res.json({ success: true, data: { markedAll: true } });
});

export default router;
