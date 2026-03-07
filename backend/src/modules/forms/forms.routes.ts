import { Router, Request, Response } from 'express';
import { formsService } from './forms.service';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import {
  createFormSchema,
  updateFormSchema,
  createQuestionSchema,
  updateQuestionSchema,
  submitResponseSchema,
  reorderQuestionsSchema,
} from './forms.schema';

const router = Router();

// ── Public routes (no auth) ─────────────────────────────────────────

// GET /api/v1/forms/public/:formId — Public form access
router.get('/public/:formId', async (req: Request, res: Response) => {
  const form = await formsService.getById(req.params.formId, null);
  res.json({ success: true, data: form });
});

// POST /api/v1/forms/public/:formId/responses — Public response submit
router.post('/public/:formId/responses', validate(submitResponseSchema), async (req: Request, res: Response) => {
  const response = await formsService.submitResponse(req.params.formId, req.body);
  res.status(201).json({ success: true, data: response });
});

// ── Authenticated routes ────────────────────────────────────────────

// GET /api/v1/forms — List user's forms
router.get('/', authenticate, async (req: Request, res: Response) => {
  const forms = await formsService.getAll(req.user!.id);
  res.json({ success: true, data: forms });
});

// POST /api/v1/forms — Create form
router.post('/', authenticate, validate(createFormSchema), async (req: Request, res: Response) => {
  const form = await formsService.create(req.user!.id, req.body);
  res.status(201).json({ success: true, data: form });
});

// GET /api/v1/forms/:formId — Get form with questions
router.get('/:formId', authenticate, async (req: Request, res: Response) => {
  const form = await formsService.getById(req.params.formId, req.user!.id);
  res.json({ success: true, data: form });
});

// PATCH /api/v1/forms/:formId — Update form
router.patch('/:formId', authenticate, validate(updateFormSchema), async (req: Request, res: Response) => {
  const form = await formsService.update(req.params.formId, req.user!.id, req.body);
  res.json({ success: true, data: form });
});

// DELETE /api/v1/forms/:formId — Delete form
router.delete('/:formId', authenticate, async (req: Request, res: Response) => {
  await formsService.delete(req.params.formId, req.user!.id);
  res.json({ success: true, data: { deleted: true } });
});

// POST /api/v1/forms/:formId/duplicate — Duplicate form
router.post('/:formId/duplicate', authenticate, async (req: Request, res: Response) => {
  const form = await formsService.duplicate(req.params.formId, req.user!.id);
  res.status(201).json({ success: true, data: form });
});

// POST /api/v1/forms/:formId/questions — Add question
router.post('/:formId/questions', authenticate, validate(createQuestionSchema), async (req: Request, res: Response) => {
  const question = await formsService.addQuestion(req.params.formId, req.user!.id, req.body);
  res.status(201).json({ success: true, data: question });
});

// PATCH /api/v1/forms/questions/:questionId — Update question
router.patch('/questions/:questionId', authenticate, validate(updateQuestionSchema), async (req: Request, res: Response) => {
  const question = await formsService.updateQuestion(req.params.questionId, req.user!.id, req.body);
  res.json({ success: true, data: question });
});

// DELETE /api/v1/forms/questions/:questionId — Delete question
router.delete('/questions/:questionId', authenticate, async (req: Request, res: Response) => {
  await formsService.deleteQuestion(req.params.questionId, req.user!.id);
  res.json({ success: true, data: { deleted: true } });
});

// PUT /api/v1/forms/:formId/questions/reorder — Reorder questions
router.put('/:formId/questions/reorder', authenticate, validate(reorderQuestionsSchema), async (req: Request, res: Response) => {
  await formsService.reorderQuestions(req.params.formId, req.user!.id, req.body);
  res.json({ success: true, data: { reordered: true } });
});

// GET /api/v1/forms/:formId/responses — Get responses
router.get('/:formId/responses', authenticate, async (req: Request, res: Response) => {
  const responses = await formsService.getResponses(req.params.formId, req.user!.id);
  res.json({ success: true, data: responses });
});

// GET /api/v1/forms/responses/:responseId — Get single response
router.get('/responses/:responseId', authenticate, async (req: Request, res: Response) => {
  const response = await formsService.getResponseById(req.params.responseId, req.user!.id);
  res.json({ success: true, data: response });
});

// DELETE /api/v1/forms/responses/:responseId — Delete response
router.delete('/responses/:responseId', authenticate, async (req: Request, res: Response) => {
  await formsService.deleteResponse(req.params.responseId, req.user!.id);
  res.json({ success: true, data: { deleted: true } });
});

// GET /api/v1/forms/:formId/analytics — Get analytics
router.get('/:formId/analytics', authenticate, async (req: Request, res: Response) => {
  const analytics = await formsService.getAnalytics(req.params.formId, req.user!.id);
  res.json({ success: true, data: analytics });
});

export default router;
