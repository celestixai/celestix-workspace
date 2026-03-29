import { Router, Request, Response } from 'express';
import { emailService } from './email.service';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { prisma } from '../../config/database';
import {
  composeEmailSchema,
  replyEmailSchema,
  forwardEmailSchema,
  emailAccountConfigSchema,
  updateEmailAccountSchema,
  testConnectionSchema,
  testImapSchema,
  createLabelSchema,
  updateLabelSchema,
  assignLabelSchema,
  removeLabelSchema,
  createSignatureSchema,
  updateSignatureSchema,
  emailQuerySchema,
  saveDraftSchema,
  updateDraftSchema,
  snoozeEmailSchema,
  bulkArchiveSchema,
  bulkDeleteSchema,
  bulkMarkReadSchema,
  bulkLabelSchema,
  bulkMoveSchema,
  emailFolderEnum,
} from './email.schema';

const router = Router();

// ==========================================
// EMAILS - CORE
// ==========================================

// GET /api/v1/email/emails - List emails with filtering/search/pagination
router.get('/emails', authenticate, validate(emailQuerySchema, 'query'), async (req: Request, res: Response) => {
  const result = await emailService.getEmails(req.user!.id, req.query as never);
  res.json({ success: true, data: result.emails, pagination: result.pagination });
});

// GET /api/v1/email/emails/search - Search emails (alias with same filters)
router.get('/emails/search', authenticate, validate(emailQuerySchema, 'query'), async (req: Request, res: Response) => {
  const result = await emailService.searchEmails(req.user!.id, req.query as never);
  res.json({ success: true, data: result.emails, pagination: result.pagination });
});

// GET /api/v1/email/emails/scheduled - Get scheduled emails
router.get('/emails/scheduled', authenticate, async (req: Request, res: Response) => {
  const emails = await emailService.getScheduledEmails(req.user!.id);
  res.json({ success: true, data: emails });
});

// GET /api/v1/email/emails/:emailId - Get single email
router.get('/emails/:emailId', authenticate, async (req: Request, res: Response) => {
  let email = await emailService.getEmailById(req.user!.id, req.params.emailId);
  // Auto-mark as read when opened
  if (!email.isRead) {
    await emailService.markRead(req.user!.id, req.params.emailId, true);
    email = { ...email, isRead: true };
  }
  res.json({ success: true, data: email });
});

// POST /api/v1/email/emails/send - Compose and send an email
router.post('/emails/send', authenticate, validate(composeEmailSchema), async (req: Request, res: Response) => {
  const email = await emailService.sendEmail(req.user!.id, req.body);
  res.status(201).json({ success: true, data: email });
});

// POST /api/v1/email/emails/reply - Reply to an email
router.post('/emails/reply', authenticate, validate(replyEmailSchema), async (req: Request, res: Response) => {
  const email = await emailService.replyToEmail(req.user!.id, req.body);
  res.status(201).json({ success: true, data: email });
});

// POST /api/v1/email/emails/forward - Forward an email
router.post('/emails/forward', authenticate, validate(forwardEmailSchema), async (req: Request, res: Response) => {
  const email = await emailService.forwardEmail(req.user!.id, req.body);
  res.status(201).json({ success: true, data: email });
});

// ==========================================
// READ / STAR TOGGLES
// ==========================================

// PATCH /api/v1/email/emails/:emailId/read - Toggle read/unread
router.patch('/emails/:emailId/read', authenticate, async (req: Request, res: Response) => {
  const email = await emailService.toggleRead(req.user!.id, req.params.emailId);
  res.json({ success: true, data: email });
});

// PATCH /api/v1/email/emails/:emailId/star - Toggle star
router.patch('/emails/:emailId/star', authenticate, async (req: Request, res: Response) => {
  const email = await emailService.toggleStar(req.user!.id, req.params.emailId);
  res.json({ success: true, data: email });
});

// ==========================================
// MOVE / ARCHIVE / TRASH / DELETE
// ==========================================

// PATCH /api/v1/email/emails/:emailId/move/:folder - Move to folder
router.patch('/emails/:emailId/move/:folder', authenticate, async (req: Request, res: Response) => {
  const folder = emailFolderEnum.parse(req.params.folder);
  const email = await emailService.moveToFolder(req.user!.id, req.params.emailId, folder);
  res.json({ success: true, data: email });
});

// POST /api/v1/email/emails/:emailId/archive - Archive email
router.post('/emails/:emailId/archive', authenticate, async (req: Request, res: Response) => {
  const email = await emailService.archiveEmail(req.user!.id, req.params.emailId);
  res.json({ success: true, data: email });
});

// POST /api/v1/email/emails/:emailId/trash - Move to trash
router.post('/emails/:emailId/trash', authenticate, async (req: Request, res: Response) => {
  const email = await emailService.trashEmail(req.user!.id, req.params.emailId);
  res.json({ success: true, data: email });
});

// DELETE /api/v1/email/emails/:emailId - Permanent delete (only from trash)
router.delete('/emails/:emailId', authenticate, async (req: Request, res: Response) => {
  const result = await emailService.permanentDelete(req.user!.id, req.params.emailId);
  res.json({ success: true, data: result });
});

// ==========================================
// SNOOZE
// ==========================================

// POST /api/v1/email/emails/:emailId/snooze - Snooze email
router.post('/emails/:emailId/snooze', authenticate, validate(snoozeEmailSchema), async (req: Request, res: Response) => {
  const email = await emailService.snoozeEmail(req.user!.id, req.params.emailId, req.body);
  res.json({ success: true, data: email });
});

// POST /api/v1/email/emails/:emailId/unsnooze - Unsnooze email
router.post('/emails/:emailId/unsnooze', authenticate, async (req: Request, res: Response) => {
  const email = await emailService.unsnoozeEmail(req.user!.id, req.params.emailId);
  res.json({ success: true, data: email });
});

// ==========================================
// SCHEDULED SEND
// ==========================================

// POST /api/v1/email/emails/:emailId/cancel-schedule - Cancel scheduled send
router.post('/emails/:emailId/cancel-schedule', authenticate, async (req: Request, res: Response) => {
  const email = await emailService.cancelScheduledSend(req.user!.id, req.params.emailId);
  res.json({ success: true, data: email });
});

// ==========================================
// THREADING
// ==========================================

// GET /api/v1/email/threads - Get threaded view for a folder
router.get('/threads', authenticate, async (req: Request, res: Response) => {
  const folder = typeof req.query.folder === 'string' ? req.query.folder : 'INBOX';
  const page = Number(req.query.page) || 1;
  const limit = Math.min(Number(req.query.limit) || 50, 100);
  const result = await emailService.getThreads(req.user!.id, folder, page, limit);
  res.json({ success: true, data: result.threads, pagination: result.pagination });
});

// GET /api/v1/email/threads/:threadId - Get all emails in a thread
router.get('/threads/:threadId', authenticate, async (req: Request, res: Response) => {
  const thread = await emailService.getThread(req.user!.id, req.params.threadId);
  res.json({ success: true, data: thread });
});

// ==========================================
// DRAFTS
// ==========================================

// POST /api/v1/email/drafts - Save a new draft
router.post('/drafts', authenticate, validate(saveDraftSchema), async (req: Request, res: Response) => {
  const draft = await emailService.saveDraft(req.user!.id, req.body);
  res.status(201).json({ success: true, data: draft });
});

// PATCH /api/v1/email/drafts/:draftId - Update (auto-save) a draft
router.patch('/drafts/:draftId', authenticate, validate(updateDraftSchema), async (req: Request, res: Response) => {
  const draft = await emailService.updateDraft(req.user!.id, req.params.draftId, req.body);
  res.json({ success: true, data: draft });
});

// POST /api/v1/email/drafts/:draftId/send - Send a draft
router.post('/drafts/:draftId/send', authenticate, async (req: Request, res: Response) => {
  const email = await emailService.sendDraft(req.user!.id, req.params.draftId);
  res.status(201).json({ success: true, data: email });
});

// ==========================================
// LABELS
// ==========================================

// GET /api/v1/email/labels - Get all labels
router.get('/labels', authenticate, async (req: Request, res: Response) => {
  const labels = await emailService.getLabels(req.user!.id);
  res.json({ success: true, data: labels });
});

// POST /api/v1/email/labels - Create a label
router.post('/labels', authenticate, validate(createLabelSchema), async (req: Request, res: Response) => {
  const label = await emailService.createLabel(req.user!.id, req.body);
  res.status(201).json({ success: true, data: label });
});

// PATCH /api/v1/email/labels/:labelId - Update a label
router.patch('/labels/:labelId', authenticate, validate(updateLabelSchema), async (req: Request, res: Response) => {
  const label = await emailService.updateLabel(req.user!.id, req.params.labelId, req.body);
  res.json({ success: true, data: label });
});

// DELETE /api/v1/email/labels/:labelId - Delete a label
router.delete('/labels/:labelId', authenticate, async (req: Request, res: Response) => {
  const result = await emailService.deleteLabel(req.user!.id, req.params.labelId);
  res.json({ success: true, data: result });
});

// POST /api/v1/email/labels/assign - Assign label to emails
router.post('/labels/assign', authenticate, validate(assignLabelSchema), async (req: Request, res: Response) => {
  const result = await emailService.assignLabel(req.user!.id, req.body.emailIds, req.body.labelName);
  res.json({ success: true, data: result });
});

// POST /api/v1/email/labels/remove - Remove label from emails
router.post('/labels/remove', authenticate, validate(removeLabelSchema), async (req: Request, res: Response) => {
  const result = await emailService.removeLabel(req.user!.id, req.body.emailIds, req.body.labelName);
  res.json({ success: true, data: result });
});

// ==========================================
// SIGNATURES
// ==========================================

// GET /api/v1/email/signatures - Get all signatures
router.get('/signatures', authenticate, async (req: Request, res: Response) => {
  const signatures = await emailService.getSignatures(req.user!.id);
  res.json({ success: true, data: signatures });
});

// GET /api/v1/email/signatures/:signatureId - Get a signature
router.get('/signatures/:signatureId', authenticate, async (req: Request, res: Response) => {
  const signature = await emailService.getSignature(req.user!.id, req.params.signatureId);
  res.json({ success: true, data: signature });
});

// POST /api/v1/email/signatures - Create a signature
router.post('/signatures', authenticate, validate(createSignatureSchema), async (req: Request, res: Response) => {
  const signature = await emailService.createSignature(req.user!.id, req.body);
  res.status(201).json({ success: true, data: signature });
});

// PATCH /api/v1/email/signatures/:signatureId - Update a signature
router.patch('/signatures/:signatureId', authenticate, validate(updateSignatureSchema), async (req: Request, res: Response) => {
  const signature = await emailService.updateSignature(req.user!.id, req.params.signatureId, req.body);
  res.json({ success: true, data: signature });
});

// DELETE /api/v1/email/signatures/:signatureId - Delete a signature
router.delete('/signatures/:signatureId', authenticate, async (req: Request, res: Response) => {
  const result = await emailService.deleteSignature(req.user!.id, req.params.signatureId);
  res.json({ success: true, data: result });
});

// POST /api/v1/email/signatures/:signatureId/default - Set as default signature
router.post('/signatures/:signatureId/default', authenticate, async (req: Request, res: Response) => {
  const signature = await emailService.setDefaultSignature(req.user!.id, req.params.signatureId);
  res.json({ success: true, data: signature });
});

// ==========================================
// EMAIL ACCOUNTS
// ==========================================

// GET /api/v1/email/accounts - Get all email accounts
router.get('/accounts', authenticate, async (req: Request, res: Response) => {
  const accounts = await emailService.getEmailAccounts(req.user!.id);
  res.json({ success: true, data: accounts });
});

// GET /api/v1/email/accounts/:accountId - Get an email account
router.get('/accounts/:accountId', authenticate, async (req: Request, res: Response) => {
  const account = await emailService.getEmailAccount(req.user!.id, req.params.accountId);
  res.json({ success: true, data: account });
});

// POST /api/v1/email/accounts - Add email account
router.post('/accounts', authenticate, validate(emailAccountConfigSchema), async (req: Request, res: Response) => {
  const account = await emailService.addEmailAccount(req.user!.id, req.body);
  res.status(201).json({ success: true, data: account });
});

// PATCH /api/v1/email/accounts/:accountId - Update email account
router.patch('/accounts/:accountId', authenticate, validate(updateEmailAccountSchema), async (req: Request, res: Response) => {
  const account = await emailService.updateEmailAccount(req.user!.id, req.params.accountId, req.body);
  res.json({ success: true, data: account });
});

// DELETE /api/v1/email/accounts/:accountId - Delete email account
router.delete('/accounts/:accountId', authenticate, async (req: Request, res: Response) => {
  const result = await emailService.deleteEmailAccount(req.user!.id, req.params.accountId);
  res.json({ success: true, data: result });
});

// POST /api/v1/email/accounts/test-smtp - Test SMTP connection
router.post('/accounts/test-smtp', authenticate, validate(testConnectionSchema), async (req: Request, res: Response) => {
  const result = await emailService.testConnection(req.body);
  res.json({ success: true, data: result });
});

// POST /api/v1/email/accounts/test (alias for test-smtp)
router.post('/accounts/test', authenticate, validate(testConnectionSchema), async (req: Request, res: Response) => {
  const result = await emailService.testConnection(req.body);
  res.json({ success: true, data: result });
});

// POST /api/v1/email/accounts/test-imap - Test IMAP connection
router.post('/accounts/test-imap', authenticate, validate(testImapSchema), async (req: Request, res: Response) => {
  const result = await emailService.testImapConnection(req.body);
  if (!result.success) {
    res.status(400).json({ success: false, error: result.message });
    return;
  }
  res.json({ success: true, data: result });
});

// ==========================================
// BULK OPERATIONS
// ==========================================

// POST /api/v1/email/bulk/archive - Bulk archive
router.post('/bulk/archive', authenticate, validate(bulkArchiveSchema), async (req: Request, res: Response) => {
  const result = await emailService.bulkArchive(req.user!.id, req.body.emailIds);
  res.json({ success: true, data: result });
});

// POST /api/v1/email/bulk/delete - Bulk move to trash
router.post('/bulk/delete', authenticate, validate(bulkDeleteSchema), async (req: Request, res: Response) => {
  const result = await emailService.bulkDelete(req.user!.id, req.body.emailIds);
  res.json({ success: true, data: result });
});

// POST /api/v1/email/bulk/permanent-delete - Bulk permanent delete (from trash only)
router.post('/bulk/permanent-delete', authenticate, validate(bulkDeleteSchema), async (req: Request, res: Response) => {
  const result = await emailService.bulkPermanentDelete(req.user!.id, req.body.emailIds);
  res.json({ success: true, data: result });
});

// POST /api/v1/email/bulk/mark-read - Bulk mark read/unread
router.post('/bulk/mark-read', authenticate, validate(bulkMarkReadSchema), async (req: Request, res: Response) => {
  const result = await emailService.bulkMarkRead(req.user!.id, req.body);
  res.json({ success: true, data: result });
});

// POST /api/v1/email/bulk/label - Bulk assign label
router.post('/bulk/label', authenticate, validate(bulkLabelSchema), async (req: Request, res: Response) => {
  const result = await emailService.bulkLabel(req.user!.id, req.body);
  res.json({ success: true, data: result });
});

// POST /api/v1/email/bulk/remove-label - Bulk remove label
router.post('/bulk/remove-label', authenticate, validate(bulkLabelSchema), async (req: Request, res: Response) => {
  const result = await emailService.bulkRemoveLabel(req.user!.id, req.body);
  res.json({ success: true, data: result });
});

// POST /api/v1/email/bulk/move - Bulk move to folder
router.post('/bulk/move', authenticate, validate(bulkMoveSchema), async (req: Request, res: Response) => {
  const result = await emailService.bulkMove(req.user!.id, req.body);
  res.json({ success: true, data: result });
});

// ==========================================
// FOLDER COUNTS & HOUSEKEEPING
// ==========================================

// GET /api/v1/email/folders/counts - Get unread/total counts per folder
router.get('/folders/counts', authenticate, async (req: Request, res: Response) => {
  const counts = await emailService.getFolderCounts(req.user!.id);
  res.json({ success: true, data: counts });
});

// DELETE /api/v1/email/folders/trash - Empty trash
router.delete('/folders/trash', authenticate, async (req: Request, res: Response) => {
  const result = await emailService.emptyTrash(req.user!.id);
  res.json({ success: true, data: result });
});

// DELETE /api/v1/email/folders/spam - Empty spam
router.delete('/folders/spam', authenticate, async (req: Request, res: Response) => {
  const result = await emailService.emptySpam(req.user!.id);
  res.json({ success: true, data: result });
});

// ==========================================
// EMAIL TEMPLATES
// ==========================================

router.get('/templates', authenticate, async (req, res, next) => {
  try {
    const templates = await prisma.emailTemplate.findMany({ where: { userId: req.user!.id } });
    res.json({ success: true, data: templates });
  } catch (err) { next(err); }
});

router.post('/templates', authenticate, async (req, res, next) => {
  try {
    const { name, subject, bodyHtml } = req.body;
    const template = await prisma.emailTemplate.create({
      data: { userId: req.user!.id, name, subject, bodyHtml },
    });
    res.json({ success: true, data: template });
  } catch (err) { next(err); }
});

router.patch('/templates/:id', authenticate, async (req, res, next) => {
  try {
    const existing = await prisma.emailTemplate.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.userId !== req.user!.id) return res.status(404).json({ success: false, error: 'Template not found' });
    const template = await prisma.emailTemplate.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json({ success: true, data: template });
  } catch (err) { next(err); }
});

router.delete('/templates/:id', authenticate, async (req, res, next) => {
  try {
    const existing = await prisma.emailTemplate.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.userId !== req.user!.id) return res.status(404).json({ success: false, error: 'Template not found' });
    await prisma.emailTemplate.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ==========================================
// EMAIL QUICK STEPS
// ==========================================

router.get('/quick-steps', authenticate, async (req, res, next) => {
  try {
    const steps = await prisma.emailQuickStep.findMany({ where: { userId: req.user!.id } });
    res.json({ success: true, data: steps });
  } catch (err) { next(err); }
});

router.post('/quick-steps', authenticate, async (req, res, next) => {
  try {
    const { name, icon, actions } = req.body;
    const step = await prisma.emailQuickStep.create({
      data: { userId: req.user!.id, name, icon: icon || 'zap', actions },
    });
    res.json({ success: true, data: step });
  } catch (err) { next(err); }
});

router.patch('/quick-steps/:id', authenticate, async (req, res, next) => {
  try {
    const existing = await prisma.emailQuickStep.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.userId !== req.user!.id) return res.status(404).json({ success: false, error: 'Quick step not found' });
    const step = await prisma.emailQuickStep.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json({ success: true, data: step });
  } catch (err) { next(err); }
});

router.delete('/quick-steps/:id', authenticate, async (req, res, next) => {
  try {
    const existing = await prisma.emailQuickStep.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.userId !== req.user!.id) return res.status(404).json({ success: false, error: 'Quick step not found' });
    await prisma.emailQuickStep.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ==========================================
// EMAIL RULES
// ==========================================

router.get('/rules', authenticate, async (req, res, next) => {
  try {
    const rules = await prisma.emailRule.findMany({
      where: { userId: req.user!.id },
      orderBy: { position: 'asc' },
    });
    res.json({ success: true, data: rules });
  } catch (err) { next(err); }
});

router.post('/rules', authenticate, async (req, res, next) => {
  try {
    const { name, conditions, actions } = req.body;
    const rule = await prisma.emailRule.create({
      data: { userId: req.user!.id, name, conditions, actions },
    });
    res.json({ success: true, data: rule });
  } catch (err) { next(err); }
});

router.patch('/rules/:id', authenticate, async (req, res, next) => {
  try {
    const existing = await prisma.emailRule.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.userId !== req.user!.id) return res.status(404).json({ success: false, error: 'Rule not found' });
    const rule = await prisma.emailRule.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json({ success: true, data: rule });
  } catch (err) { next(err); }
});

router.delete('/rules/:id', authenticate, async (req, res, next) => {
  try {
    const existing = await prisma.emailRule.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.userId !== req.user!.id) return res.status(404).json({ success: false, error: 'Rule not found' });
    await prisma.emailRule.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ==========================================
// FOCUSED INBOX
// ==========================================

// Focused Inbox - simple classifier based on sender history
router.get('/focused', authenticate, async (req, res, next) => {
  try {
    // "Focused" = emails from contacts or people you've replied to
    const contacts = await prisma.contact.findMany({
      where: { userId: req.user!.id },
      include: { emails: true },
    });
    const contactEmails = new Set(contacts.flatMap(c => c.emails.map(e => e.email.toLowerCase())));

    // Get sent email addresses (people user has replied to)
    const sentEmails = await prisma.email.findMany({
      where: { userId: req.user!.id, folder: 'SENT' },
      select: { toAddresses: true },
      take: 200,
    });
    const repliedTo = new Set<string>();
    sentEmails.forEach(e => {
      const addrs = e.toAddresses as any[];
      if (Array.isArray(addrs)) addrs.forEach(a => repliedTo.add((typeof a === 'string' ? a : a.email || '').toLowerCase()));
    });

    const inboxEmails = await prisma.email.findMany({
      where: { userId: req.user!.id, folder: 'INBOX', deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const focused = inboxEmails.filter(e => contactEmails.has(e.fromAddress.toLowerCase()) || repliedTo.has(e.fromAddress.toLowerCase()));
    const other = inboxEmails.filter(e => !contactEmails.has(e.fromAddress.toLowerCase()) && !repliedTo.has(e.fromAddress.toLowerCase()));

    res.json({ success: true, data: { focused, other } });
  } catch (err) { next(err); }
});

// ==========================================
// OAUTH — GMAIL
// ==========================================

let googleOAuth2Client: any = null;
function getGoogleOAuth2() {
  if (googleOAuth2Client) return googleOAuth2Client;
  try {
    const { google } = require('googleapis');
    googleOAuth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI,
    );
    return googleOAuth2Client;
  } catch {
    return null;
  }
}

// GET /api/v1/email/oauth/google/authorize
router.get('/oauth/google/authorize', authenticate, (req: Request, res: Response) => {
  const client = getGoogleOAuth2();
  if (!client || !process.env.GOOGLE_CLIENT_ID) {
    res.status(501).json({ success: false, error: 'Gmail OAuth not configured' });
    return;
  }
  // Store userId in state param for callback
  const state = Buffer.from(JSON.stringify({ userId: req.user!.id })).toString('base64url');
  const url = client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.modify',
      'https://www.googleapis.com/auth/userinfo.email',
    ],
    prompt: 'consent',
    state,
  });
  res.json({ success: true, data: { url } });
});

// GET /api/v1/email/oauth/google/callback
router.get('/oauth/google/callback', async (req: Request, res: Response) => {
  const client = getGoogleOAuth2();
  if (!client) { res.status(501).send('Gmail OAuth not configured'); return; }

  try {
    const code = req.query.code as string;
    const stateRaw = req.query.state as string;
    const { userId } = JSON.parse(Buffer.from(stateRaw, 'base64url').toString());

    const { tokens } = await client.getToken(code);
    client.setCredentials(tokens);

    const { google } = require('googleapis');
    const gmail = google.gmail({ version: 'v1', auth: client });
    const profile = await gmail.users.getProfile({ userId: 'me' });
    const email = profile.data.emailAddress;

    // Save as email account
    await prisma.emailAccount.create({
      data: {
        userId,
        email,
        displayName: email,
        provider: 'GMAIL',
        smtpHost: 'smtp.gmail.com',
        smtpPort: 465,
        smtpUser: email,
        smtpPass: tokens.access_token || '',
        smtpSecure: true,
        imapHost: 'imap.gmail.com',
        imapPort: 993,
        imapUser: email,
        imapPass: tokens.access_token || '',
        imapSecure: true,
        accessToken: tokens.access_token || null,
        refreshToken: tokens.refresh_token || null,
        tokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        syncEnabled: true,
      },
    });

    // Redirect to frontend settings
    const frontendUrl = process.env.FRONTEND_URL || 'https://workspace.celestix.ai';
    res.redirect(`${frontendUrl}/settings?tab=email-accounts&connected=gmail`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'OAuth failed';
    const frontendUrl = process.env.FRONTEND_URL || 'https://workspace.celestix.ai';
    res.redirect(`${frontendUrl}/settings?tab=email-accounts&error=${encodeURIComponent(msg)}`);
  }
});

// ==========================================
// OAUTH — MICROSOFT / OUTLOOK
// ==========================================

// GET /api/v1/email/oauth/microsoft/authorize
router.get('/oauth/microsoft/authorize', authenticate, (req: Request, res: Response) => {
  if (!process.env.MICROSOFT_CLIENT_ID) {
    res.status(501).json({ success: false, error: 'Outlook OAuth not configured' });
    return;
  }
  const state = Buffer.from(JSON.stringify({ userId: req.user!.id })).toString('base64url');
  const params = new URLSearchParams({
    client_id: process.env.MICROSOFT_CLIENT_ID,
    response_type: 'code',
    redirect_uri: process.env.MICROSOFT_REDIRECT_URI || '',
    scope: 'openid profile email Mail.Read Mail.Send offline_access',
    state,
    prompt: 'consent',
  });
  const url = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params}`;
  res.json({ success: true, data: { url } });
});

// GET /api/v1/email/oauth/microsoft/callback
router.get('/oauth/microsoft/callback', async (req: Request, res: Response) => {
  try {
    const code = req.query.code as string;
    const stateRaw = req.query.state as string;
    const { userId } = JSON.parse(Buffer.from(stateRaw, 'base64url').toString());

    // Exchange code for tokens
    const tokenRes = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.MICROSOFT_CLIENT_ID || '',
        client_secret: process.env.MICROSOFT_CLIENT_SECRET || '',
        code,
        redirect_uri: process.env.MICROSOFT_REDIRECT_URI || '',
        grant_type: 'authorization_code',
      }),
    });
    const tokens = await tokenRes.json() as Record<string, any>;
    if (tokens.error) throw new Error(tokens.error_description || tokens.error);

    // Get user email from Microsoft Graph
    const profileRes = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const profile = await profileRes.json() as Record<string, any>;
    const email = profile.mail || profile.userPrincipalName;

    await prisma.emailAccount.create({
      data: {
        userId,
        email,
        displayName: (profile.displayName as string) || email,
        provider: 'OUTLOOK',
        smtpHost: 'smtp.office365.com',
        smtpPort: 587,
        smtpUser: email,
        smtpPass: tokens.access_token as string,
        smtpSecure: false,
        imapHost: 'outlook.office365.com',
        imapPort: 993,
        imapUser: email,
        imapPass: tokens.access_token as string,
        imapSecure: true,
        accessToken: (tokens.access_token as string) || null,
        refreshToken: (tokens.refresh_token as string) || null,
        tokenExpiry: tokens.expires_in ? new Date(Date.now() + (tokens.expires_in as number) * 1000) : null,
        syncEnabled: true,
      },
    });

    const frontendUrl = process.env.FRONTEND_URL || 'https://workspace.celestix.ai';
    res.redirect(`${frontendUrl}/settings?tab=email-accounts&connected=outlook`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'OAuth failed';
    const frontendUrl = process.env.FRONTEND_URL || 'https://workspace.celestix.ai';
    res.redirect(`${frontendUrl}/settings?tab=email-accounts&error=${encodeURIComponent(msg)}`);
  }
});

export default router;
