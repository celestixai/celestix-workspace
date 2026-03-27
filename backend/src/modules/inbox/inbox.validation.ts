import { z } from 'zod';

export const snoozeSchema = z.object({
  until: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Invalid ISO date string',
  }),
});
