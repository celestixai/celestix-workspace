import { Router, Request, Response } from 'express';
import { socialService } from './social.service';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import {
  createCommunitySchema,
  updateCommunitySchema,
  createPostSchema,
  updatePostSchema,
  createCommentSchema,
  addReactionSchema,
  feedQuerySchema,
  postsByTypeSchema,
} from './social.schema';

const router = Router();

// ==========================================
// FEED & TRENDING (must precede /:communityId)
// ==========================================

// GET /api/v1/social/feed
router.get('/feed', authenticate, validate(feedQuerySchema, 'query'), async (req: Request, res: Response) => {
  const result = await socialService.getFeed(req.user!.id, req.query as never);
  res.json({ success: true, data: result.posts, pagination: { hasMore: result.hasMore, cursor: result.cursor } });
});

// GET /api/v1/social/trending
router.get('/trending', authenticate, async (_req: Request, res: Response) => {
  const posts = await socialService.getTrending();
  res.json({ success: true, data: posts });
});

// ==========================================
// STANDALONE POST ROUTES (must precede /:communityId)
// ==========================================

// GET /api/v1/social/posts/:postId
router.get('/posts/:postId', authenticate, async (req: Request, res: Response) => {
  const post = await socialService.getPostById(req.params.postId);
  res.json({ success: true, data: post });
});

// PATCH /api/v1/social/posts/:postId
router.patch('/posts/:postId', authenticate, validate(updatePostSchema), async (req: Request, res: Response) => {
  const post = await socialService.updatePost(req.user!.id, req.params.postId, req.body);
  res.json({ success: true, data: post });
});

// DELETE /api/v1/social/posts/:postId
router.delete('/posts/:postId', authenticate, async (req: Request, res: Response) => {
  await socialService.deletePost(req.user!.id, req.params.postId);
  res.json({ success: true, data: { message: 'Post deleted' } });
});

// ==========================================
// COMMENT ROUTES (post-scoped)
// ==========================================

// GET /api/v1/social/posts/:postId/comments
router.get('/posts/:postId/comments', authenticate, async (req: Request, res: Response) => {
  const comments = await socialService.getComments(req.params.postId);
  res.json({ success: true, data: comments });
});

// POST /api/v1/social/posts/:postId/comments
router.post('/posts/:postId/comments', authenticate, validate(createCommentSchema), async (req: Request, res: Response) => {
  const comment = await socialService.createComment(req.user!.id, req.params.postId, req.body);
  res.status(201).json({ success: true, data: comment });
});

// DELETE /api/v1/social/comments/:commentId
router.delete('/comments/:commentId', authenticate, async (req: Request, res: Response) => {
  await socialService.deleteComment(req.user!.id, req.params.commentId);
  res.json({ success: true, data: { message: 'Comment deleted' } });
});

// POST /api/v1/social/posts/:postId/best-answer/:commentId
router.post('/posts/:postId/best-answer/:commentId', authenticate, async (req: Request, res: Response) => {
  const comment = await socialService.markBestAnswer(req.user!.id, req.params.postId, req.params.commentId);
  res.json({ success: true, data: comment });
});

// ==========================================
// REACTION ROUTES
// ==========================================

// POST /api/v1/social/posts/:postId/reactions
router.post('/posts/:postId/reactions', authenticate, validate(addReactionSchema), async (req: Request, res: Response) => {
  const result = await socialService.toggleReaction(req.user!.id, req.params.postId, req.body);
  res.json({ success: true, data: result });
});

// ==========================================
// COMMUNITY ROUTES
// ==========================================

// GET /api/v1/social/communities
router.get('/communities', authenticate, async (req: Request, res: Response) => {
  const communities = await socialService.getCommunities(req.user!.id);
  res.json({ success: true, data: communities });
});

// POST /api/v1/social/communities
router.post('/communities', authenticate, validate(createCommunitySchema), async (req: Request, res: Response) => {
  const community = await socialService.createCommunity(req.user!.id, req.body);
  res.status(201).json({ success: true, data: community });
});

// GET /api/v1/social/communities/:communityId
router.get('/communities/:communityId', authenticate, async (req: Request, res: Response) => {
  const community = await socialService.getCommunityById(req.params.communityId);
  res.json({ success: true, data: community });
});

// PATCH /api/v1/social/communities/:communityId
router.patch('/communities/:communityId', authenticate, validate(updateCommunitySchema), async (req: Request, res: Response) => {
  const community = await socialService.updateCommunity(req.user!.id, req.params.communityId, req.body);
  res.json({ success: true, data: community });
});

// DELETE /api/v1/social/communities/:communityId
router.delete('/communities/:communityId', authenticate, async (req: Request, res: Response) => {
  await socialService.deleteCommunity(req.user!.id, req.params.communityId);
  res.json({ success: true, data: { message: 'Community deleted' } });
});

// POST /api/v1/social/communities/:communityId/join
router.post('/communities/:communityId/join', authenticate, async (req: Request, res: Response) => {
  const member = await socialService.joinCommunity(req.user!.id, req.params.communityId);
  res.status(201).json({ success: true, data: member });
});

// POST /api/v1/social/communities/:communityId/leave
router.post('/communities/:communityId/leave', authenticate, async (req: Request, res: Response) => {
  await socialService.leaveCommunity(req.user!.id, req.params.communityId);
  res.json({ success: true, data: { message: 'Left the community' } });
});

// ==========================================
// COMMUNITY POST ROUTES
// ==========================================

// GET /api/v1/social/communities/:communityId/posts
router.get('/communities/:communityId/posts', authenticate, async (req: Request, res: Response) => {
  const posts = await socialService.getPosts(req.params.communityId);
  res.json({ success: true, data: posts });
});

// POST /api/v1/social/communities/:communityId/posts
router.post('/communities/:communityId/posts', authenticate, validate(createPostSchema), async (req: Request, res: Response) => {
  const post = await socialService.createPost(req.user!.id, req.params.communityId, req.body);
  res.status(201).json({ success: true, data: post });
});

// GET /api/v1/social/communities/:communityId/posts/by-type
router.get('/communities/:communityId/posts/by-type', authenticate, validate(postsByTypeSchema, 'query'), async (req: Request, res: Response) => {
  const result = await socialService.getPostsByType(req.params.communityId, req.query as never);
  res.json({ success: true, data: result.posts, pagination: { hasMore: result.hasMore, cursor: result.cursor } });
});

export default router;
