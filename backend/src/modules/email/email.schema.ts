import { z } from 'zod';

// ==========================================
// EMAIL COMPOSE / SEND
// ==========================================

const emailAddressSchema = z.object({
  address: z.string().email(),
  name: z.string().optional(),
});

const attachmentSchema = z.object({
  name: z.string(),
  url: z.string(),
  mimeType: z.string(),
  size: z.number(),
  cid: z.string().optional(), // for inline images
});

export const composeEmailSchema = z.object({
  accountId: z.string().uuid().optional(),
  to: z.array(emailAddressSchema).min(1),
  cc: z.array(emailAddressSchema).optional(),
  bcc: z.array(emailAddressSchema).optional(),
  subject: z.string().max(998), // RFC 2822 limit
  bodyHtml: z.string().max(5000000).optional(),
  bodyText: z.string().max(2000000).optional(),
  attachments: z.array(attachmentSchema).optional(),
  signatureId: z.string().uuid().optional(),
  scheduledAt: z.coerce.date().optional(),
  isDraft: z.boolean().optional(),
});

export const replyEmailSchema = z.object({
  emailId: z.string().uuid(),
  bodyHtml: z.string().max(5000000).optional(),
  bodyText: z.string().max(2000000).optional(),
  attachments: z.array(attachmentSchema).optional(),
  signatureId: z.string().uuid().optional(),
  replyAll: z.boolean().default(false),
  scheduledAt: z.coerce.date().optional(),
});

export const forwardEmailSchema = z.object({
  emailId: z.string().uuid(),
  to: z.array(emailAddressSchema).min(1),
  cc: z.array(emailAddressSchema).optional(),
  bcc: z.array(emailAddressSchema).optional(),
  bodyHtml: z.string().max(5000000).optional(),
  bodyText: z.string().max(2000000).optional(),
  attachments: z.array(attachmentSchema).optional(),
  signatureId: z.string().uuid().optional(),
  scheduledAt: z.coerce.date().optional(),
});

// ==========================================
// EMAIL ACCOUNT CONFIGURATION
// ==========================================

export const emailAccountConfigSchema = z.object({
  email: z.string().email(),
  displayName: z.string().max(100).optional(),
  smtpHost: z.string().min(1),
  smtpPort: z.number().int().min(1).max(65535),
  smtpUser: z.string().min(1),
  smtpPass: z.string().min(1),
  smtpSecure: z.boolean().default(false),
  imapHost: z.string().optional(),
  imapPort: z.number().int().min(1).max(65535).optional(),
  imapUser: z.string().optional(),
  imapPass: z.string().optional(),
  imapSecure: z.boolean().default(true),
  syncEnabled: z.boolean().default(true),
  syncInterval: z.number().int().min(1).max(60).default(5),
  isDefault: z.boolean().default(false),
});

export const updateEmailAccountSchema = emailAccountConfigSchema.partial().omit({ email: true });

export const testConnectionSchema = z.object({
  smtpHost: z.string().min(1),
  smtpPort: z.number().int().min(1).max(65535),
  smtpUser: z.string().min(1),
  smtpPass: z.string().min(1),
  smtpSecure: z.boolean().default(false),
});

// ==========================================
// LABELS
// ==========================================

export const createLabelSchema = z.object({
  name: z.string().min(1).max(50),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#4F8EF7'),
});

export const updateLabelSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
});

export const assignLabelSchema = z.object({
  emailIds: z.array(z.string().uuid()).min(1),
  labelName: z.string().min(1),
});

export const removeLabelSchema = z.object({
  emailIds: z.array(z.string().uuid()).min(1),
  labelName: z.string().min(1),
});

// ==========================================
// SIGNATURES
// ==========================================

export const createSignatureSchema = z.object({
  name: z.string().min(1).max(100),
  bodyHtml: z.string().max(100000),
  isDefault: z.boolean().default(false),
});

export const updateSignatureSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  bodyHtml: z.string().max(100000).optional(),
  isDefault: z.boolean().optional(),
});

// ==========================================
// EMAIL QUERY / SEARCH FILTERS
// ==========================================

export const emailFolderEnum = z.enum(['INBOX', 'SENT', 'DRAFTS', 'ARCHIVE', 'TRASH', 'SPAM']);

export const emailQuerySchema = z.object({
  folder: emailFolderEnum.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  search: z.string().optional(),
  label: z.string().optional(),
  isRead: z.coerce.boolean().optional(),
  isStarred: z.coerce.boolean().optional(),
  hasAttachment: z.coerce.boolean().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  threadId: z.string().uuid().optional(),
  sortBy: z.enum(['createdAt', 'subject']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// ==========================================
// DRAFT
// ==========================================

export const saveDraftSchema = z.object({
  accountId: z.string().uuid().optional(),
  to: z.array(emailAddressSchema).optional(),
  cc: z.array(emailAddressSchema).optional(),
  bcc: z.array(emailAddressSchema).optional(),
  subject: z.string().max(998).optional(),
  bodyHtml: z.string().max(5000000).optional(),
  bodyText: z.string().max(2000000).optional(),
  attachments: z.array(attachmentSchema).optional(),
  inReplyTo: z.string().uuid().optional(),
  threadId: z.string().uuid().optional(),
});

export const updateDraftSchema = saveDraftSchema;

// ==========================================
// SNOOZE
// ==========================================

export const snoozeEmailSchema = z.object({
  snoozedUntil: z.coerce.date(),
});

// ==========================================
// BULK OPERATIONS
// ==========================================

export const bulkEmailIdsSchema = z.object({
  emailIds: z.array(z.string().uuid()).min(1).max(500),
});

export const bulkArchiveSchema = bulkEmailIdsSchema;
export const bulkDeleteSchema = bulkEmailIdsSchema;
export const bulkMarkReadSchema = bulkEmailIdsSchema.extend({
  isRead: z.boolean(),
});
export const bulkLabelSchema = bulkEmailIdsSchema.extend({
  labelName: z.string().min(1),
});
export const bulkMoveSchema = bulkEmailIdsSchema.extend({
  folder: emailFolderEnum,
});

// ==========================================
// TYPE EXPORTS
// ==========================================

export type ComposeEmailInput = z.infer<typeof composeEmailSchema>;
export type ReplyEmailInput = z.infer<typeof replyEmailSchema>;
export type ForwardEmailInput = z.infer<typeof forwardEmailSchema>;
export type EmailAccountConfigInput = z.infer<typeof emailAccountConfigSchema>;
export type UpdateEmailAccountInput = z.infer<typeof updateEmailAccountSchema>;
export type CreateLabelInput = z.infer<typeof createLabelSchema>;
export type UpdateLabelInput = z.infer<typeof updateLabelSchema>;
export type CreateSignatureInput = z.infer<typeof createSignatureSchema>;
export type UpdateSignatureInput = z.infer<typeof updateSignatureSchema>;
export type EmailQueryInput = z.infer<typeof emailQuerySchema>;
export type SaveDraftInput = z.infer<typeof saveDraftSchema>;
export type SnoozeEmailInput = z.infer<typeof snoozeEmailSchema>;
export type BulkMarkReadInput = z.infer<typeof bulkMarkReadSchema>;
export type BulkLabelInput = z.infer<typeof bulkLabelSchema>;
export type BulkMoveInput = z.infer<typeof bulkMoveSchema>;
