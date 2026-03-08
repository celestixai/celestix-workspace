import { Router, Request, Response } from 'express';
import { designService } from './designer.service';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import {
  createDesignSchema,
  updateDesignSchema,
  duplicateDesignSchema,
} from './designer.schema';

const router = Router();

// ==========================================
// DESIGN ROUTES
// ==========================================

// GET /api/v1/designer
router.get('/', authenticate, async (req: Request, res: Response) => {
  const designs = await designService.getDesigns(req.user!.id);
  res.json({ success: true, data: designs });
});

// POST /api/v1/designer
router.post('/', authenticate, validate(createDesignSchema), async (req: Request, res: Response) => {
  const design = await designService.createDesign(req.user!.id, req.body);
  res.status(201).json({ success: true, data: design });
});

// GET /api/v1/designer/templates
router.get('/templates', authenticate, async (_req: Request, res: Response) => {
  const templates = designService.getTemplates();
  res.json({ success: true, data: templates });
});

// GET /api/v1/designer/:designId
router.get('/:designId', authenticate, async (req: Request, res: Response) => {
  const design = await designService.getDesignById(req.user!.id, req.params.designId);
  res.json({ success: true, data: design });
});

// PATCH /api/v1/designer/:designId
router.patch('/:designId', authenticate, validate(updateDesignSchema), async (req: Request, res: Response) => {
  const design = await designService.updateDesign(req.user!.id, req.params.designId, req.body);
  res.json({ success: true, data: design });
});

// DELETE /api/v1/designer/:designId
router.delete('/:designId', authenticate, async (req: Request, res: Response) => {
  await designService.deleteDesign(req.user!.id, req.params.designId);
  res.json({ success: true, data: { message: 'Design deleted' } });
});

// POST /api/v1/designer/:designId/duplicate
router.post('/:designId/duplicate', authenticate, validate(duplicateDesignSchema), async (req: Request, res: Response) => {
  const design = await designService.duplicateDesign(req.user!.id, req.params.designId, req.body);
  res.status(201).json({ success: true, data: design });
});

export default router;
