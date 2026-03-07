import { Router, Request, Response } from 'express';
import { whiteboardService } from './whiteboard.service';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import {
  createWhiteboardSchema,
  updateWhiteboardSchema,
  addCollaboratorSchema,
} from './whiteboard.schema';

const router = Router();

// GET /api/v1/whiteboards — List my whiteboards
router.get('/', authenticate, async (req: Request, res: Response) => {
  const whiteboards = await whiteboardService.getAll(req.user!.id);
  res.json({ success: true, data: whiteboards });
});

// POST /api/v1/whiteboards — Create whiteboard
router.post('/', authenticate, validate(createWhiteboardSchema), async (req: Request, res: Response) => {
  const whiteboard = await whiteboardService.create(req.user!.id, req.body);
  res.status(201).json({ success: true, data: whiteboard });
});

// GET /api/v1/whiteboards/:id — Get whiteboard
router.get('/:id', authenticate, async (req: Request, res: Response) => {
  const whiteboard = await whiteboardService.getById(req.user!.id, req.params.id);
  res.json({ success: true, data: whiteboard });
});

// PATCH /api/v1/whiteboards/:id — Update whiteboard
router.patch('/:id', authenticate, validate(updateWhiteboardSchema), async (req: Request, res: Response) => {
  const whiteboard = await whiteboardService.update(req.user!.id, req.params.id, req.body);
  res.json({ success: true, data: whiteboard });
});

// DELETE /api/v1/whiteboards/:id — Delete whiteboard
router.delete('/:id', authenticate, async (req: Request, res: Response) => {
  await whiteboardService.delete(req.user!.id, req.params.id);
  res.json({ success: true, data: { message: 'Whiteboard deleted' } });
});

// POST /api/v1/whiteboards/:id/collaborators — Add collaborator
router.post('/:id/collaborators', authenticate, validate(addCollaboratorSchema), async (req: Request, res: Response) => {
  const collaborator = await whiteboardService.addCollaborator(req.user!.id, req.params.id, req.body);
  res.status(201).json({ success: true, data: collaborator });
});

// DELETE /api/v1/whiteboards/:id/collaborators/:userId — Remove collaborator
router.delete('/:id/collaborators/:userId', authenticate, async (req: Request, res: Response) => {
  await whiteboardService.removeCollaborator(req.user!.id, req.params.id, req.params.userId);
  res.json({ success: true, data: { message: 'Collaborator removed' } });
});

export default router;
