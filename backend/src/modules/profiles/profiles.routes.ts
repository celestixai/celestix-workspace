import { Router, Request, Response } from 'express';
import { profilesService } from './profiles.service';
import { authenticate } from '../../middleware/auth';

const router = Router();

// GET /api/v1/profiles/:userId — get profile with stats
router.get('/:userId', authenticate, async (req: Request, res: Response) => {
  const profile = await profilesService.getProfile(req.params.userId, req.user!.id);
  res.json({ success: true, data: profile });
});

// GET /api/v1/profiles/:userId/activity — recent activity
router.get('/:userId/activity', authenticate, async (req: Request, res: Response) => {
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
  const activity = await profilesService.getProfileActivity(req.params.userId, limit);
  res.json({ success: true, data: activity });
});

// GET /api/v1/profiles/:userId/tasks — user's tasks
router.get('/:userId/tasks', authenticate, async (req: Request, res: Response) => {
  const filters = {
    status: req.query.status as string | undefined,
    priority: req.query.priority as string | undefined,
    listId: req.query.listId as string | undefined,
  };
  const tasks = await profilesService.getProfileTasks(req.params.userId, filters);
  res.json({ success: true, data: tasks });
});

// GET /api/v1/profiles/:userId/goals — user's goals
router.get('/:userId/goals', authenticate, async (req: Request, res: Response) => {
  const goals = await profilesService.getProfileGoals(req.params.userId);
  res.json({ success: true, data: goals });
});

export default router;
