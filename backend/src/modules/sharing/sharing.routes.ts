import { Router, Request, Response } from 'express';
import { sharingService } from './sharing.service';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import {
  shareItemSchema,
  updateShareSchema,
  createPublicLinkSchema,
  accessPublicLinkSchema,
} from './sharing.validation';

const router = Router();

// ==========================================
// Shared Items (authenticated)
// ==========================================

// POST /api/v1/sharing/share — share item with user(s)
router.post('/share', authenticate, validate(shareItemSchema), async (req: Request, res: Response) => {
  const { itemType, itemId, userIds, permission } = req.body;
  const shares = await sharingService.shareItem(req.user!.id, itemType, itemId, userIds, permission);
  res.status(201).json({ success: true, data: shares });
});

// GET /api/v1/sharing/:itemType/:itemId/shares — list who has access
router.get('/:itemType/:itemId/shares', authenticate, async (req: Request, res: Response) => {
  const shares = await sharingService.getShares(req.params.itemType, req.params.itemId);
  res.json({ success: true, data: shares });
});

// PATCH /api/v1/sharing/shares/:shareId — update permission
router.patch('/shares/:shareId', authenticate, validate(updateShareSchema), async (req: Request, res: Response) => {
  const share = await sharingService.updateShare(req.params.shareId, req.body.permission);
  res.json({ success: true, data: share });
});

// DELETE /api/v1/sharing/shares/:shareId — remove access
router.delete('/shares/:shareId', authenticate, async (req: Request, res: Response) => {
  await sharingService.removeShare(req.params.shareId);
  res.json({ success: true, data: { removed: true } });
});

// ==========================================
// Public Links (authenticated management)
// ==========================================

// POST /api/v1/sharing/public-link — create public link
router.post('/public-link', authenticate, validate(createPublicLinkSchema), async (req: Request, res: Response) => {
  const { itemType, itemId, permission, password, expiresAt } = req.body;
  const link = await sharingService.createPublicLink(req.user!.id, itemType, itemId, permission, password, expiresAt);
  res.status(201).json({ success: true, data: link });
});

// GET /api/v1/sharing/:itemType/:itemId/public-links — list public links for item
router.get('/:itemType/:itemId/public-links', authenticate, async (req: Request, res: Response) => {
  const links = await sharingService.getPublicLinks(req.params.itemType, req.params.itemId);
  res.json({ success: true, data: links });
});

// DELETE /api/v1/sharing/public-link/:linkId — revoke public link
router.delete('/public-link/:linkId', authenticate, async (req: Request, res: Response) => {
  const link = await sharingService.revokePublicLink(req.params.linkId, req.user!.id, req.user!.isAdmin);
  res.json({ success: true, data: link });
});

// ==========================================
// Public Link Access (NO auth required)
// ==========================================

// GET /api/v1/sharing/public-link/:token — access via public link
router.get('/public-link/:token', validate(accessPublicLinkSchema, 'query'), async (req: Request, res: Response) => {
  const result = await sharingService.accessPublicLink(req.params.token, req.query.password as string | undefined);
  res.json({ success: true, data: result });
});

export default router;
