import { Router, Request, Response } from 'express';
import { notificationsService } from './notifications.service';
import { authenticate } from '../../middleware/auth';

const router = Router();

router.get('/', authenticate, async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 50;
  const unreadOnly = req.query.unread === 'true';
  const result = await notificationsService.getNotifications(req.user!.id, page, limit, unreadOnly);
  res.json({ success: true, data: result.notifications, unreadCount: result.unreadCount, pagination: result.pagination });
});

router.get('/unread-count', authenticate, async (req: Request, res: Response) => {
  const count = await notificationsService.getUnreadCount(req.user!.id);
  res.json({ success: true, data: { count } });
});

router.post('/:id/read', authenticate, async (req: Request, res: Response) => {
  await notificationsService.markAsRead(req.user!.id, req.params.id);
  res.json({ success: true, data: { read: true } });
});

router.post('/read-all', authenticate, async (req: Request, res: Response) => {
  await notificationsService.markAllAsRead(req.user!.id);
  res.json({ success: true, data: { read: true } });
});

router.delete('/:id', authenticate, async (req: Request, res: Response) => {
  await notificationsService.deleteNotification(req.user!.id, req.params.id);
  res.json({ success: true, data: { deleted: true } });
});

router.delete('/', authenticate, async (req: Request, res: Response) => {
  await notificationsService.clearAll(req.user!.id);
  res.json({ success: true, data: { cleared: true } });
});

export default router;
