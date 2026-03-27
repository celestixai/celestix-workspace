import { Router, Request, Response } from 'express';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import {
  advancedSearchSchema,
  deepSearchSchema,
  saveSearchSchema,
} from './search-advanced.validation';
import {
  advancedSearch,
  deepSearch,
  getSearchHistory,
  deleteSearchHistory,
  saveSearch,
  getSavedSearches,
  deleteSavedSearch,
} from './search-advanced.service';

const router = Router();

// GET /api/v1/search/advanced?q=&types=&spaceId=&...
router.get(
  '/advanced',
  authenticate,
  validate(advancedSearchSchema, 'query'),
  async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const workspaceId = (req.query.workspaceId as string) || (req.user as any).activeWorkspaceId || '';
    const params = req.query as any;

    const result = await advancedSearch(workspaceId, userId, params);
    res.json({ success: true, data: result });
  },
);

// POST /api/v1/search/deep — AI-enhanced search
router.post(
  '/deep',
  authenticate,
  validate(deepSearchSchema, 'body'),
  async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { q, workspaceId } = req.body;

    const result = await deepSearch(workspaceId, userId, q);
    res.json({ success: true, data: result });
  },
);

// GET /api/v1/search/history
router.get('/history', authenticate, async (req: Request, res: Response) => {
  const history = await getSearchHistory(req.user!.id);
  res.json({ success: true, data: { history } });
});

// DELETE /api/v1/search/history
router.delete('/history', authenticate, async (req: Request, res: Response) => {
  await deleteSearchHistory(req.user!.id);
  res.json({ success: true, data: { cleared: true } });
});

// POST /api/v1/search/save
router.post(
  '/save',
  authenticate,
  validate(saveSearchSchema, 'body'),
  async (req: Request, res: Response) => {
    const { name, query } = req.body;
    const result = await saveSearch(req.user!.id, name, query);
    res.json({ success: true, data: result });
  },
);

// GET /api/v1/search/saved
router.get('/saved', authenticate, async (req: Request, res: Response) => {
  const saved = await getSavedSearches(req.user!.id);
  res.json({ success: true, data: { saved } });
});

// DELETE /api/v1/search/saved/:id
router.delete('/saved/:id', authenticate, async (req: Request, res: Response) => {
  await deleteSavedSearch(req.user!.id, req.params.id);
  res.json({ success: true, data: { deleted: true } });
});

export default router;
