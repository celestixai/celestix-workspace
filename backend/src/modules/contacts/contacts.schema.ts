import { z } from 'zod';

export const createContactSchema = z.object({
  firstName: z.string().max(100).optional(),
  lastName: z.string().max(100).optional(),
  displayName: z.string().min(1).max(200),
  company: z.string().max(200).optional(),
  title: z.string().max(200).optional(),
  birthday: z.string().optional(),
  notes: z.string().max(2000).optional(),
  emails: z.array(z.object({
    email: z.string().email(),
    label: z.string().default('personal'),
    isPrimary: z.boolean().default(false),
  })).optional(),
  phones: z.array(z.object({
    phone: z.string(),
    label: z.string().default('mobile'),
    isPrimary: z.boolean().default(false),
  })).optional(),
  addresses: z.array(z.object({
    street: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    country: z.string().optional(),
    zip: z.string().optional(),
    label: z.string().default('home'),
  })).optional(),
});

export const updateContactSchema = createContactSchema.partial();

export const createGroupSchema = z.object({
  name: z.string().min(1).max(100),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#4F8EF7'),
});

export const contactsQuerySchema = z.object({
  search: z.string().optional(),
  group: z.string().uuid().optional(),
  favorite: z.coerce.boolean().optional(),
  letter: z.string().max(1).optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(200).default(100),
});

export type CreateContactInput = z.infer<typeof createContactSchema>;
