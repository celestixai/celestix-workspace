import { z } from 'zod';

export const createBookingPageSchema = z.object({
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  type: z.enum(['PERSONAL', 'SHARED']).default('PERSONAL'),
  description: z.string().max(2000).optional(),
  branding: z.record(z.any()).optional(),
  settings: z.object({
    minNoticeHours: z.number().default(24),
    maxDaysAhead: z.number().default(30),
    defaultAvailability: z.record(z.any()).optional(),
  }).optional(),
});

export const updateBookingPageSchema = createBookingPageSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const createServiceSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  durationMinutes: z.number().int().min(5).max(480),
  bufferMinutes: z.number().int().min(0).max(60).default(0),
  price: z.number().min(0).optional(),
  maxAttendees: z.number().int().min(1).default(1),
  intakeForm: z.array(z.object({
    field: z.string(),
    type: z.enum(['text', 'email', 'phone', 'select', 'checkbox', 'textarea']),
    label: z.string(),
    required: z.boolean().default(false),
    options: z.array(z.string()).optional(),
  })).optional(),
  staffAssignmentType: z.enum(['ROUND_ROBIN', 'RANDOM', 'SPECIFIC']).default('ROUND_ROBIN'),
});

export const updateServiceSchema = createServiceSchema.partial();

export const bookAppointmentSchema = z.object({
  serviceId: z.string().uuid(),
  startAt: z.string().datetime(),
  guestName: z.string().min(1).max(200),
  guestEmail: z.string().email(),
  guestPhone: z.string().optional(),
  intakeResponses: z.record(z.any()).optional(),
  staffUserId: z.string().uuid().optional(),
});

export const cancelAppointmentSchema = z.object({
  cancelToken: z.string(),
});
