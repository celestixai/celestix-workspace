import { Router, Request, Response } from 'express';
import { sitesService } from './sites.service';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import {
  createSiteSchema,
  updateSiteSchema,
  createPageSchema,
  updatePageSchema,
  createNewsPostSchema,
  updateNewsPostSchema,
  createNewsCommentSchema,
} from './sites.schema';

const router = Router();

// ==========================================
// SITE ROUTES
// ==========================================

// GET /api/v1/sites
router.get('/', authenticate, async (req: Request, res: Response) => {
  const sites = await sitesService.getSites(req.user!.id);
  res.json({ success: true, data: sites });
});

// POST /api/v1/sites
router.post('/', authenticate, validate(createSiteSchema), async (req: Request, res: Response) => {
  const site = await sitesService.createSite(req.user!.id, req.body);
  res.status(201).json({ success: true, data: site });
});

// GET /api/v1/sites/:siteId
router.get('/:siteId', authenticate, async (req: Request, res: Response) => {
  const site = await sitesService.getSiteById(req.user!.id, req.params.siteId);
  res.json({ success: true, data: site });
});

// PATCH /api/v1/sites/:siteId
router.patch('/:siteId', authenticate, validate(updateSiteSchema), async (req: Request, res: Response) => {
  const site = await sitesService.updateSite(req.user!.id, req.params.siteId, req.body);
  res.json({ success: true, data: site });
});

// DELETE /api/v1/sites/:siteId
router.delete('/:siteId', authenticate, async (req: Request, res: Response) => {
  await sitesService.deleteSite(req.user!.id, req.params.siteId);
  res.json({ success: true, data: { message: 'Site deleted' } });
});

// ==========================================
// PAGE ROUTES (site-scoped)
// ==========================================

// GET /api/v1/sites/:siteId/pages
router.get('/:siteId/pages', authenticate, async (req: Request, res: Response) => {
  const pages = await sitesService.getPages(req.user!.id, req.params.siteId);
  res.json({ success: true, data: pages });
});

// POST /api/v1/sites/:siteId/pages
router.post('/:siteId/pages', authenticate, validate(createPageSchema), async (req: Request, res: Response) => {
  const page = await sitesService.createPage(req.user!.id, req.params.siteId, req.body);
  res.status(201).json({ success: true, data: page });
});

// GET /api/v1/sites/:siteId/homepage
router.get('/:siteId/homepage', authenticate, async (req: Request, res: Response) => {
  const page = await sitesService.getHomepage(req.user!.id, req.params.siteId);
  res.json({ success: true, data: page });
});

// GET /api/v1/sites/:siteId/pages/published
router.get('/:siteId/pages/published', authenticate, async (req: Request, res: Response) => {
  const pages = await sitesService.getPublishedPages(req.user!.id, req.params.siteId);
  res.json({ success: true, data: pages });
});

// GET /api/v1/sites/:siteId/pages/:pageId
router.get('/:siteId/pages/:pageId', authenticate, async (req: Request, res: Response) => {
  const page = await sitesService.getPageById(req.user!.id, req.params.siteId, req.params.pageId);
  res.json({ success: true, data: page });
});

// PATCH /api/v1/sites/:siteId/pages/:pageId
router.patch('/:siteId/pages/:pageId', authenticate, validate(updatePageSchema), async (req: Request, res: Response) => {
  const page = await sitesService.updatePage(req.user!.id, req.params.siteId, req.params.pageId, req.body);
  res.json({ success: true, data: page });
});

// DELETE /api/v1/sites/:siteId/pages/:pageId
router.delete('/:siteId/pages/:pageId', authenticate, async (req: Request, res: Response) => {
  await sitesService.deletePage(req.user!.id, req.params.siteId, req.params.pageId);
  res.json({ success: true, data: { message: 'Page deleted' } });
});

// POST /api/v1/sites/:siteId/pages/:pageId/publish
router.post('/:siteId/pages/:pageId/publish', authenticate, async (req: Request, res: Response) => {
  const page = await sitesService.publishPage(req.user!.id, req.params.siteId, req.params.pageId);
  res.json({ success: true, data: page });
});

// ==========================================
// NEWS POST ROUTES (site-scoped)
// ==========================================

// GET /api/v1/sites/:siteId/news
router.get('/:siteId/news', authenticate, async (req: Request, res: Response) => {
  const posts = await sitesService.getNewsPosts(req.user!.id, req.params.siteId);
  res.json({ success: true, data: posts });
});

// POST /api/v1/sites/:siteId/news
router.post('/:siteId/news', authenticate, validate(createNewsPostSchema), async (req: Request, res: Response) => {
  const post = await sitesService.createNewsPost(req.user!.id, req.params.siteId, req.body);
  res.status(201).json({ success: true, data: post });
});

// GET /api/v1/sites/:siteId/news/:postId
router.get('/:siteId/news/:postId', authenticate, async (req: Request, res: Response) => {
  const post = await sitesService.getNewsPostById(req.user!.id, req.params.siteId, req.params.postId);
  res.json({ success: true, data: post });
});

// PATCH /api/v1/sites/:siteId/news/:postId
router.patch('/:siteId/news/:postId', authenticate, validate(updateNewsPostSchema), async (req: Request, res: Response) => {
  const post = await sitesService.updateNewsPost(req.user!.id, req.params.siteId, req.params.postId, req.body);
  res.json({ success: true, data: post });
});

// DELETE /api/v1/sites/:siteId/news/:postId
router.delete('/:siteId/news/:postId', authenticate, async (req: Request, res: Response) => {
  await sitesService.deleteNewsPost(req.user!.id, req.params.siteId, req.params.postId);
  res.json({ success: true, data: { message: 'News post deleted' } });
});

// ==========================================
// NEWS COMMENT ROUTES (post-scoped)
// ==========================================

// GET /api/v1/sites/news/:postId/comments
router.get('/news/:postId/comments', authenticate, async (req: Request, res: Response) => {
  const comments = await sitesService.getNewsComments(req.params.postId);
  res.json({ success: true, data: comments });
});

// POST /api/v1/sites/news/:postId/comments
router.post('/news/:postId/comments', authenticate, validate(createNewsCommentSchema), async (req: Request, res: Response) => {
  const comment = await sitesService.createNewsComment(req.user!.id, req.params.postId, req.body);
  res.status(201).json({ success: true, data: comment });
});

// DELETE /api/v1/sites/comments/:commentId
router.delete('/comments/:commentId', authenticate, async (req: Request, res: Response) => {
  await sitesService.deleteNewsComment(req.user!.id, req.params.commentId);
  res.json({ success: true, data: { message: 'Comment deleted' } });
});

export default router;
