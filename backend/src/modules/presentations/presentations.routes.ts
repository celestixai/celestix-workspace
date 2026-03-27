import { Router, Request, Response } from 'express';
import { presentationService } from './presentations.service';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import {
  createPresentationSchema,
  updatePresentationSchema,
  addSlideSchema,
  updateSlideSchema,
  reorderSlidesSchema,
} from './presentations.schema';

const router = Router();

// GET /api/v1/presentations — List all presentations
router.get('/', authenticate, async (req: Request, res: Response) => {
  const presentations = await presentationService.getAll(req.user!.id);
  res.json({ success: true, data: presentations });
});

// POST /api/v1/presentations — Create presentation
router.post('/', authenticate, validate(createPresentationSchema), async (req: Request, res: Response) => {
  const presentation = await presentationService.create(req.user!.id, req.body);
  res.status(201).json({ success: true, data: presentation });
});

// GET /api/v1/presentations/:id — Get presentation
router.get('/:id', authenticate, async (req: Request, res: Response) => {
  const presentation = await presentationService.getById(req.user!.id, req.params.id);
  res.json({ success: true, data: presentation });
});

// PATCH /api/v1/presentations/:id — Update presentation
router.patch('/:id', authenticate, validate(updatePresentationSchema), async (req: Request, res: Response) => {
  const presentation = await presentationService.update(req.user!.id, req.params.id, req.body);
  res.json({ success: true, data: presentation });
});

// DELETE /api/v1/presentations/:id — Delete presentation
router.delete('/:id', authenticate, async (req: Request, res: Response) => {
  await presentationService.delete(req.user!.id, req.params.id);
  res.json({ success: true, data: { deleted: true } });
});

// POST /api/v1/presentations/:id/duplicate — Duplicate entire presentation
router.post('/:id/duplicate', authenticate, async (req: Request, res: Response) => {
  const presentation = await presentationService.duplicate(req.user!.id, req.params.id);
  res.status(201).json({ success: true, data: presentation });
});

// POST /api/v1/presentations/:id/slides — Add slide
router.post('/:id/slides', authenticate, validate(addSlideSchema), async (req: Request, res: Response) => {
  const presentation = await presentationService.addSlide(req.user!.id, req.params.id, req.body);
  res.status(201).json({ success: true, data: presentation });
});

// PATCH /api/v1/presentations/:id/slides/:index — Update slide by index
router.patch('/:id/slides/:index', authenticate, validate(updateSlideSchema), async (req: Request, res: Response) => {
  const slideIndex = parseInt(req.params.index, 10);
  if (isNaN(slideIndex)) {
    res.status(400).json({ success: false, error: 'Invalid slide index' });
    return;
  }
  const presentation = await presentationService.updateSlide(req.user!.id, req.params.id, slideIndex, req.body);
  res.json({ success: true, data: presentation });
});

// DELETE /api/v1/presentations/:id/slides/:index — Delete slide by index
router.delete('/:id/slides/:index', authenticate, async (req: Request, res: Response) => {
  const slideIndex = parseInt(req.params.index, 10);
  if (isNaN(slideIndex)) {
    res.status(400).json({ success: false, error: 'Invalid slide index' });
    return;
  }
  const presentation = await presentationService.deleteSlide(req.user!.id, req.params.id, slideIndex);
  res.json({ success: true, data: presentation });
});

// POST /api/v1/presentations/:id/slides/:index/duplicate — Duplicate slide
router.post('/:id/slides/:index/duplicate', authenticate, async (req: Request, res: Response) => {
  const slideIndex = parseInt(req.params.index, 10);
  if (isNaN(slideIndex)) {
    res.status(400).json({ success: false, error: 'Invalid slide index' });
    return;
  }
  const presentation = await presentationService.duplicateSlide(req.user!.id, req.params.id, slideIndex);
  res.status(201).json({ success: true, data: presentation });
});

// PUT /api/v1/presentations/:id/slides/reorder — Reorder slides
router.put('/:id/slides/reorder', authenticate, validate(reorderSlidesSchema), async (req: Request, res: Response) => {
  const presentation = await presentationService.reorderSlides(req.user!.id, req.params.id, req.body);
  res.json({ success: true, data: presentation });
});

export default router;
