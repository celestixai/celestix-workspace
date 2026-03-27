import { Router, Request, Response } from 'express';
import { postsService } from './posts.service';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import {
  createPostSchema,
  updatePostSchema,
  createCommentSchema,
  createFollowUpSchema,
  updateFollowUpSchema,
  createTaskFromMessageSchema,
} from './posts.validation';

const router = Router();

// ==========================================
// Posts
// ==========================================

// POST /api/v1/workspace/channels/:channelId/posts — create post
router.post('/channels/:channelId/posts', authenticate, validate(createPostSchema), async (req: Request, res: Response) => {
  const post = await postsService.createPost(req.params.channelId, req.user!.id, req.body);
  res.status(201).json({ success: true, data: post });
});

// GET /api/v1/workspace/channels/:channelId/posts — list posts
router.get('/channels/:channelId/posts', authenticate, async (req: Request, res: Response) => {
  const { cursor, limit } = req.query as { cursor?: string; limit?: string };
  const result = await postsService.getPosts(req.params.channelId, Number(limit) || 20, cursor);
  res.json({
    success: true,
    data: result.posts,
    pagination: { hasMore: result.hasMore, cursor: result.cursor },
  });
});

// GET /api/v1/workspace/posts/:postId — get post with comments
router.get('/posts/:postId', authenticate, async (req: Request, res: Response) => {
  const post = await postsService.getPost(req.params.postId);
  res.json({ success: true, data: post });
});

// PATCH /api/v1/workspace/posts/:postId — update
router.patch('/posts/:postId', authenticate, validate(updatePostSchema), async (req: Request, res: Response) => {
  const post = await postsService.updatePost(req.params.postId, req.user!.id, req.body);
  res.json({ success: true, data: post });
});

// DELETE /api/v1/workspace/posts/:postId — delete
router.delete('/posts/:postId', authenticate, async (req: Request, res: Response) => {
  const result = await postsService.deletePost(req.params.postId, req.user!.id);
  res.json({ success: true, data: result });
});

// POST /api/v1/workspace/posts/:postId/comments — add comment
router.post('/posts/:postId/comments', authenticate, validate(createCommentSchema), async (req: Request, res: Response) => {
  const comment = await postsService.addComment(
    req.params.postId,
    req.user!.id,
    req.body.content,
    req.body.parentCommentId,
  );
  res.status(201).json({ success: true, data: comment });
});

// POST /api/v1/workspace/posts/:postId/pin — toggle pin
router.post('/posts/:postId/pin', authenticate, async (req: Request, res: Response) => {
  const post = await postsService.togglePin(req.params.postId);
  res.json({ success: true, data: post });
});

// ==========================================
// Follow-Ups
// ==========================================

// POST /api/v1/workspace/messages/:messageId/follow-up — create follow-up
router.post('/messages/:messageId/follow-up', authenticate, validate(createFollowUpSchema), async (req: Request, res: Response) => {
  const followUp = await postsService.createFollowUp(
    req.params.messageId,
    req.body.channelId,
    req.user!.id,
    req.body.assignedToId,
    req.body.dueDate,
    req.body.note,
  );
  res.status(201).json({ success: true, data: followUp });
});

// GET /api/v1/workspace/:workspaceId/follow-ups — user's follow-ups
router.get('/:workspaceId/follow-ups', authenticate, async (req: Request, res: Response) => {
  const followUps = await postsService.getUserFollowUps(req.user!.id, req.params.workspaceId);
  res.json({ success: true, data: followUps });
});

// PATCH /api/v1/workspace/follow-ups/:followUpId — update status
router.patch('/follow-ups/:followUpId', authenticate, validate(updateFollowUpSchema), async (req: Request, res: Response) => {
  const followUp = await postsService.updateFollowUp(req.params.followUpId, req.user!.id, req.body);
  res.json({ success: true, data: followUp });
});

// DELETE /api/v1/workspace/follow-ups/:followUpId — delete
router.delete('/follow-ups/:followUpId', authenticate, async (req: Request, res: Response) => {
  const result = await postsService.deleteFollowUp(req.params.followUpId);
  res.json({ success: true, data: result });
});

// ==========================================
// Chat-to-Task
// ==========================================

// POST /api/v1/workspace/messages/:messageId/create-task — create task from message
router.post('/messages/:messageId/create-task', authenticate, validate(createTaskFromMessageSchema), async (req: Request, res: Response) => {
  const task = await postsService.createTaskFromMessage(req.params.messageId, req.user!.id, req.body);
  res.status(201).json({ success: true, data: task });
});

export default router;
