import { Router, Request, Response } from 'express';
import { diagramService } from './diagrams.service';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import {
  createDiagramSchema,
  updateDiagramSchema,
  updateCanvasDataSchema,
  diagramTypeEnum,
} from './diagrams.schema';

const router = Router();

// GET /api/v1/diagrams — List all diagrams
router.get('/', authenticate, async (req: Request, res: Response) => {
  const diagrams = await diagramService.getAll(req.user!.id);
  res.json({ success: true, data: diagrams });
});

// POST /api/v1/diagrams — Create diagram
router.post('/', authenticate, validate(createDiagramSchema), async (req: Request, res: Response) => {
  const diagram = await diagramService.create(req.user!.id, req.body);
  res.status(201).json({ success: true, data: diagram });
});

// GET /api/v1/diagrams/type/:type — Get diagrams by type
router.get('/type/:type', authenticate, async (req: Request, res: Response) => {
  const parsed = diagramTypeEnum.safeParse(req.params.type);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: 'Invalid diagram type' });
    return;
  }
  const diagrams = await diagramService.getByType(req.user!.id, parsed.data);
  res.json({ success: true, data: diagrams });
});

// GET /api/v1/diagrams/:id — Get diagram
router.get('/:id', authenticate, async (req: Request, res: Response) => {
  const diagram = await diagramService.getById(req.user!.id, req.params.id);
  res.json({ success: true, data: diagram });
});

// PATCH /api/v1/diagrams/:id — Update diagram
router.patch('/:id', authenticate, validate(updateDiagramSchema), async (req: Request, res: Response) => {
  const diagram = await diagramService.update(req.user!.id, req.params.id, req.body);
  res.json({ success: true, data: diagram });
});

// DELETE /api/v1/diagrams/:id — Delete diagram
router.delete('/:id', authenticate, async (req: Request, res: Response) => {
  await diagramService.delete(req.user!.id, req.params.id);
  res.json({ success: true, data: { deleted: true } });
});

// POST /api/v1/diagrams/:id/duplicate — Duplicate diagram
router.post('/:id/duplicate', authenticate, async (req: Request, res: Response) => {
  const diagram = await diagramService.duplicate(req.user!.id, req.params.id);
  res.status(201).json({ success: true, data: diagram });
});

// PATCH /api/v1/diagrams/:id/canvas — Partial update canvas data
router.patch('/:id/canvas', authenticate, validate(updateCanvasDataSchema), async (req: Request, res: Response) => {
  const diagram = await diagramService.updateCanvasData(req.user!.id, req.params.id, req.body);
  res.json({ success: true, data: diagram });
});

export default router;
