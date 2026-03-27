import { z } from 'zod';

export const createFormSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(2000).optional(),
  type: z.enum(['FORM', 'QUIZ']).default('FORM'),
  settings: z.record(z.any()).optional(),
  theme: z.record(z.any()).optional(),
});

export const updateFormSchema = createFormSchema.partial().extend({
  isPublished: z.boolean().optional(),
  acceptResponses: z.boolean().optional(),
  responseLimit: z.number().int().positive().nullable().optional(),
  startDate: z.string().datetime().nullable().optional(),
  endDate: z.string().datetime().nullable().optional(),
});

export const createQuestionSchema = z.object({
  type: z.enum(['SHORT_TEXT', 'LONG_TEXT', 'SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'DROPDOWN', 'STAR_RATING', 'LIKERT', 'DATE', 'TIME', 'DATETIME', 'NUMBER', 'RANGE', 'FILE_UPLOAD', 'NPS', 'RANKING', 'MATRIX', 'SECTION']),
  label: z.string().min(1).max(1000),
  description: z.string().max(2000).optional(),
  options: z.any().optional(),
  validation: z.record(z.any()).optional(),
  isRequired: z.boolean().default(false),
  position: z.number().int().default(0),
  points: z.number().int().optional(),
  correctAnswer: z.any().optional(),
  logic: z.record(z.any()).optional(),
});

export const updateQuestionSchema = createQuestionSchema.partial();

export const submitResponseSchema = z.object({
  answers: z.record(z.any()),
  respondentName: z.string().optional(),
  respondentEmail: z.string().email().optional(),
});

export const reorderQuestionsSchema = z.object({
  questionIds: z.array(z.string().uuid()),
});

export type CreateFormInput = z.infer<typeof createFormSchema>;
export type UpdateFormInput = z.infer<typeof updateFormSchema>;
export type CreateQuestionInput = z.infer<typeof createQuestionSchema>;
export type UpdateQuestionInput = z.infer<typeof updateQuestionSchema>;
export type SubmitResponseInput = z.infer<typeof submitResponseSchema>;
export type ReorderQuestionsInput = z.infer<typeof reorderQuestionsSchema>;
