import { Router, Request, Response } from 'express';
import { pdfService } from './pdf.service';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import {
  createAnnotationSchema,
  updateAnnotationSchema,
  mergeFilesSchema,
  splitFileSchema,
  rotatePagesSchema,
  addWatermarkSchema,
  compressSchema,
  protectSchema,
} from './pdf.schema';

const router = Router();

// ==============================
// ANNOTATIONS
// ==============================

// POST /api/v1/pdf/annotations — Create annotation
router.post('/annotations', authenticate, validate(createAnnotationSchema), async (req: Request, res: Response) => {
  const annotation = await pdfService.createAnnotation(req.user!.id, req.body);
  res.status(201).json({ success: true, data: annotation });
});

// GET /api/v1/pdf/annotations/file/:fileId — Get all annotations for a file
router.get('/annotations/file/:fileId', authenticate, async (req: Request, res: Response) => {
  const annotations = await pdfService.getAnnotations(req.user!.id, req.params.fileId);
  res.json({ success: true, data: annotations });
});

// GET /api/v1/pdf/annotations/file/:fileId/page/:pageNumber — Get annotations by page
router.get('/annotations/file/:fileId/page/:pageNumber', authenticate, async (req: Request, res: Response) => {
  const pageNumber = parseInt(req.params.pageNumber, 10);
  if (isNaN(pageNumber) || pageNumber < 1) {
    res.status(400).json({ success: false, error: 'Invalid page number' });
    return;
  }
  const annotations = await pdfService.getAnnotationsByPage(req.user!.id, req.params.fileId, pageNumber);
  res.json({ success: true, data: annotations });
});

// PATCH /api/v1/pdf/annotations/:id — Update annotation
router.patch('/annotations/:id', authenticate, validate(updateAnnotationSchema), async (req: Request, res: Response) => {
  const annotation = await pdfService.updateAnnotation(req.user!.id, req.params.id, req.body);
  res.json({ success: true, data: annotation });
});

// DELETE /api/v1/pdf/annotations/:id — Delete annotation
router.delete('/annotations/:id', authenticate, async (req: Request, res: Response) => {
  await pdfService.deleteAnnotation(req.user!.id, req.params.id);
  res.json({ success: true, data: { deleted: true } });
});

// ==============================
// PDF OPERATIONS
// ==============================

// POST /api/v1/pdf/merge — Merge multiple PDFs
router.post('/merge', authenticate, validate(mergeFilesSchema), async (req: Request, res: Response) => {
  const result = await pdfService.merge(req.user!.id, req.body);
  res.status(202).json({ success: true, data: result });
});

// POST /api/v1/pdf/split — Split PDF by page ranges
router.post('/split', authenticate, validate(splitFileSchema), async (req: Request, res: Response) => {
  const result = await pdfService.split(req.user!.id, req.body);
  res.status(202).json({ success: true, data: result });
});

// POST /api/v1/pdf/rotate — Rotate PDF pages
router.post('/rotate', authenticate, validate(rotatePagesSchema), async (req: Request, res: Response) => {
  const result = await pdfService.rotate(req.user!.id, req.body);
  res.status(202).json({ success: true, data: result });
});

// POST /api/v1/pdf/watermark — Add watermark to PDF
router.post('/watermark', authenticate, validate(addWatermarkSchema), async (req: Request, res: Response) => {
  const result = await pdfService.addWatermark(req.user!.id, req.body);
  res.status(202).json({ success: true, data: result });
});

// POST /api/v1/pdf/compress — Compress PDF
router.post('/compress', authenticate, validate(compressSchema), async (req: Request, res: Response) => {
  const result = await pdfService.compress(req.user!.id, req.body);
  res.status(202).json({ success: true, data: result });
});

// POST /api/v1/pdf/protect — Add password protection to PDF
router.post('/protect', authenticate, validate(protectSchema), async (req: Request, res: Response) => {
  const result = await pdfService.protect(req.user!.id, req.body);
  res.status(202).json({ success: true, data: result });
});

export default router;
