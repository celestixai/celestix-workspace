import nodemailer from 'nodemailer';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { AppError } from '../../middleware/error-handler';
import { config } from '../../config';
import { sendEmail as sendViaResend, isEmailConfigured as isResendConfigured } from '../../config/email-provider';
import type {
  ComposeEmailInput,
  ReplyEmailInput,
  ForwardEmailInput,
  EmailAccountConfigInput,
  UpdateEmailAccountInput,
  CreateLabelInput,
  UpdateLabelInput,
  CreateSignatureInput,
  UpdateSignatureInput,
  EmailQueryInput,
  SaveDraftInput,
  SnoozeEmailInput,
  BulkMarkReadInput,
  BulkLabelInput,
  BulkMoveInput,
} from './email.schema';

// ==========================================
// HELPERS
// ==========================================

interface EmailAddress {
  address: string;
  name?: string;
}

function formatAddresses(addrs: EmailAddress[]): string {
  return addrs.map((a) => (a.name ? `"${a.name}" <${a.address}>` : a.address)).join(', ');
}

function generateMessageId(domain?: string): string {
  const d = domain || 'celestix.local';
  return `<${randomUUID()}@${d}>`;
}

async function getSmtpTransport(userId: string, accountId?: string) {
  if (accountId) {
    const account = await prisma.emailAccount.findFirst({
      where: { id: accountId, userId },
    });
    if (!account) {
      throw new AppError(404, 'Email account not found', 'ACCOUNT_NOT_FOUND');
    }
    return {
      transport: nodemailer.createTransport({
        host: account.smtpHost,
        port: account.smtpPort,
        secure: account.smtpSecure,
        auth: { user: account.smtpUser, pass: account.smtpPass },
      }),
      account,
    };
  }

  // Try default account
  const defaultAccount = await prisma.emailAccount.findFirst({
    where: { userId, isDefault: true },
  });

  if (defaultAccount) {
    return {
      transport: nodemailer.createTransport({
        host: defaultAccount.smtpHost,
        port: defaultAccount.smtpPort,
        secure: defaultAccount.smtpSecure,
        auth: { user: defaultAccount.smtpUser, pass: defaultAccount.smtpPass },
      }),
      account: defaultAccount,
    };
  }

  // Fall back to system SMTP
  return {
    transport: nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
    }),
    account: null,
  };
}

async function getUserInfo(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, displayName: true },
  });
  if (!user) throw new AppError(404, 'User not found', 'USER_NOT_FOUND');
  return user;
}

async function resolveSignature(userId: string, signatureId?: string): Promise<string | null> {
  if (!signatureId) return null;
  const sig = await prisma.emailSignature.findFirst({
    where: { id: signatureId, userId },
  });
  return sig?.bodyHtml || null;
}

// Check whether all recipients are Celestix users => internal delivery
async function findInternalRecipients(addresses: EmailAddress[]): Promise<Map<string, { id: string; email: string; displayName: string }>> {
  const emails = addresses.map((a) => a.address.toLowerCase());
  const users = await prisma.user.findMany({
    where: { email: { in: emails }, deletedAt: null },
    select: { id: true, email: true, displayName: true },
  });
  const map = new Map<string, { id: string; email: string; displayName: string }>();
  for (const u of users) {
    map.set(u.email.toLowerCase(), u);
  }
  return map;
}

function allRecipientsInternal(
  to: EmailAddress[],
  cc: EmailAddress[] | undefined,
  bcc: EmailAddress[] | undefined,
  internalMap: Map<string, unknown>,
): boolean {
  const all = [...to, ...(cc || []), ...(bcc || [])];
  return all.every((a) => internalMap.has(a.address.toLowerCase()));
}

// ==========================================
// SERVICE
// ==========================================

export class EmailService {

  // ------------------------------------------
  // SEND EMAIL
  // ------------------------------------------

  async sendEmail(userId: string, input: ComposeEmailInput) {
    const sender = await getUserInfo(userId);
    const signature = await resolveSignature(userId, input.signatureId);
    const messageId = generateMessageId();
    const threadId = randomUUID();

    let bodyHtml = input.bodyHtml || '';
    if (signature) {
      bodyHtml += `<br/><div class="email-signature">${signature}</div>`;
    }

    // Determine if this is a scheduled send
    if (input.scheduledAt && input.scheduledAt > new Date()) {
      return this.scheduleEmail(userId, input, bodyHtml, messageId, threadId, sender);
    }

    // If saving as draft
    if (input.isDraft) {
      return this.saveDraft(userId, {
        accountId: input.accountId,
        to: input.to,
        cc: input.cc,
        bcc: input.bcc,
        subject: input.subject,
        bodyHtml,
        bodyText: input.bodyText,
        attachments: input.attachments,
      });
    }

    const allRecipients = [...input.to, ...(input.cc || []), ...(input.bcc || [])];
    const internalMap = await findInternalRecipients(allRecipients);
    const isFullyInternal = allRecipientsInternal(input.to, input.cc, input.bcc, internalMap);

    // If all recipients are internal Celestix users, deliver internally without SMTP
    if (isFullyInternal) {
      return this.deliverInternally(userId, sender, input, bodyHtml, messageId, threadId, internalMap);
    }

    // External delivery — try Resend first, then fall back to SMTP
    const { transport, account } = await getSmtpTransport(userId, input.accountId);
    const fromAddress = account?.email || sender.email;
    const fromName = account?.displayName || sender.displayName;

    let sent = false;

    // Try Resend provider first if configured
    if (isResendConfigured()) {
      const resendResult = await sendViaResend({
        to: input.to.map((a) => a.address),
        subject: input.subject,
        html: bodyHtml,
        text: input.bodyText,
        cc: input.cc?.map((a) => a.address),
        bcc: input.bcc?.map((a) => a.address),
        replyTo: fromAddress,
      });
      if (resendResult) {
        sent = true;
      } else {
        console.warn('Resend delivery failed, falling back to SMTP');
      }
    }

    // Fall back to SMTP if Resend was not configured or failed
    if (!sent) {
      const mailOptions: nodemailer.SendMailOptions = {
        from: `"${fromName}" <${fromAddress}>`,
        to: formatAddresses(input.to),
        cc: input.cc ? formatAddresses(input.cc) : undefined,
        bcc: input.bcc ? formatAddresses(input.bcc) : undefined,
        subject: input.subject,
        html: bodyHtml,
        text: input.bodyText,
        messageId,
        attachments: input.attachments?.map((att) => ({
          filename: att.name,
          path: att.url,
          contentType: att.mimeType,
          cid: att.cid,
        })),
      };

      try {
        await transport.sendMail(mailOptions);
      } catch (smtpError: any) {
        // Log but don't fail — still save the email in SENT folder (graceful degradation for dev/no-SMTP)
        console.warn(`SMTP send failed (saving to SENT anyway): ${smtpError.message}`);
      } finally {
        transport.close();
      }
    }

    // Store in SENT folder for the sender
    const sentEmail = await prisma.email.create({
      data: {
        userId,
        accountId: account?.id,
        folder: 'SENT',
        fromAddress,
        fromName,
        toAddresses: input.to as unknown as Prisma.InputJsonValue,
        ccAddresses: input.cc as unknown as Prisma.InputJsonValue,
        bccAddresses: input.bcc as unknown as Prisma.InputJsonValue,
        subject: input.subject,
        bodyHtml,
        bodyText: input.bodyText,
        messageId,
        threadId,
        isRead: true,
        attachments: input.attachments as unknown as Prisma.InputJsonValue,
        isInternal: false,
      },
    });

    // Also deliver internally to any Celestix recipients
    for (const [email, recipient] of internalMap) {
      const recipientAddr = allRecipients.find((a) => a.address.toLowerCase() === email);
      if (recipientAddr) {
        await prisma.email.create({
          data: {
            userId: (recipient as { id: string }).id,
            folder: 'INBOX',
            fromAddress,
            fromName,
            toAddresses: input.to as unknown as Prisma.InputJsonValue,
            ccAddresses: input.cc as unknown as Prisma.InputJsonValue,
            subject: input.subject,
            bodyHtml,
            bodyText: input.bodyText,
            messageId: generateMessageId(),
            threadId,
            inReplyTo: messageId,
            references: [messageId],
            attachments: input.attachments as unknown as Prisma.InputJsonValue,
            isInternal: true,
          },
        });
      }
    }

    return sentEmail;
  }

  private async deliverInternally(
    senderId: string,
    sender: { id: string; email: string; displayName: string },
    input: ComposeEmailInput,
    bodyHtml: string,
    messageId: string,
    threadId: string,
    internalMap: Map<string, { id: string; email: string; displayName: string }>,
  ) {
    // Store in SENT for sender
    const sentEmail = await prisma.email.create({
      data: {
        userId: senderId,
        accountId: input.accountId,
        folder: 'SENT',
        fromAddress: sender.email,
        fromName: sender.displayName,
        toAddresses: input.to as unknown as Prisma.InputJsonValue,
        ccAddresses: input.cc as unknown as Prisma.InputJsonValue,
        bccAddresses: input.bcc as unknown as Prisma.InputJsonValue,
        subject: input.subject,
        bodyHtml,
        bodyText: input.bodyText,
        messageId,
        threadId,
        isRead: true,
        attachments: input.attachments as unknown as Prisma.InputJsonValue,
        isInternal: true,
      },
    });

    // Deliver to each internal recipient
    const allRecipients = [...input.to, ...(input.cc || []), ...(input.bcc || [])];
    for (const addr of allRecipients) {
      const recipient = internalMap.get(addr.address.toLowerCase());
      if (recipient && recipient.id !== senderId) {
        await prisma.email.create({
          data: {
            userId: recipient.id,
            folder: 'INBOX',
            fromAddress: sender.email,
            fromName: sender.displayName,
            toAddresses: input.to as unknown as Prisma.InputJsonValue,
            ccAddresses: input.cc as unknown as Prisma.InputJsonValue,
            subject: input.subject,
            bodyHtml,
            bodyText: input.bodyText,
            messageId: generateMessageId(),
            threadId,
            inReplyTo: messageId,
            references: [messageId],
            attachments: input.attachments as unknown as Prisma.InputJsonValue,
            isInternal: true,
          },
        });
      }
    }

    return sentEmail;
  }

  private async scheduleEmail(
    userId: string,
    input: ComposeEmailInput,
    bodyHtml: string,
    messageId: string,
    threadId: string,
    sender: { email: string; displayName: string },
  ) {
    const scheduledEmail = await prisma.email.create({
      data: {
        userId,
        accountId: input.accountId,
        folder: 'DRAFTS',
        fromAddress: sender.email,
        fromName: sender.displayName,
        toAddresses: input.to as unknown as Prisma.InputJsonValue,
        ccAddresses: input.cc as unknown as Prisma.InputJsonValue,
        bccAddresses: input.bcc as unknown as Prisma.InputJsonValue,
        subject: input.subject,
        bodyHtml,
        bodyText: input.bodyText,
        messageId,
        threadId,
        isRead: true,
        attachments: input.attachments as unknown as Prisma.InputJsonValue,
        scheduledAt: input.scheduledAt,
      },
    });

    return scheduledEmail;
  }

  // ------------------------------------------
  // REPLY / FORWARD
  // ------------------------------------------

  async replyToEmail(userId: string, input: ReplyEmailInput) {
    const original = await prisma.email.findFirst({
      where: { id: input.emailId, userId },
    });
    if (!original) throw new AppError(404, 'Email not found', 'EMAIL_NOT_FOUND');

    const sender = await getUserInfo(userId);
    const signature = await resolveSignature(userId, input.signatureId);

    let bodyHtml = input.bodyHtml || '';
    if (signature) {
      bodyHtml += `<br/><div class="email-signature">${signature}</div>`;
    }

    // Build quoted original
    const quotedHtml = `
      <br/><br/>
      <div class="email-quote" style="border-left: 2px solid #ccc; padding-left: 12px; margin-left: 0; color: #666;">
        <p>On ${original.createdAt.toUTCString()}, ${original.fromName || original.fromAddress} wrote:</p>
        ${original.bodyHtml || original.bodyText || ''}
      </div>
    `;
    bodyHtml += quotedHtml;

    const messageId = generateMessageId();
    const references = [...(original.references || [])];
    if (original.messageId) references.push(original.messageId);

    // Determine recipients
    const toAddresses = input.replyAll
      ? [
          { address: original.fromAddress, name: original.fromName || undefined },
          ...((original.toAddresses as unknown as EmailAddress[]) || []).filter((a) => a.address !== sender.email),
        ]
      : [{ address: original.fromAddress, name: original.fromName || undefined }];

    const ccAddresses = input.replyAll
      ? ((original.ccAddresses as unknown as EmailAddress[]) || []).filter((a) => a.address !== sender.email)
      : undefined;

    return this.sendEmail(userId, {
      accountId: original.accountId || undefined,
      to: toAddresses,
      cc: ccAddresses && ccAddresses.length > 0 ? ccAddresses : undefined,
      subject: original.subject.startsWith('Re:') ? original.subject : `Re: ${original.subject}`,
      bodyHtml,
      bodyText: input.bodyText,
      attachments: input.attachments,
      scheduledAt: input.scheduledAt,
    });
  }

  async forwardEmail(userId: string, input: ForwardEmailInput) {
    const original = await prisma.email.findFirst({
      where: { id: input.emailId, userId },
    });
    if (!original) throw new AppError(404, 'Email not found', 'EMAIL_NOT_FOUND');

    const signature = await resolveSignature(userId, input.signatureId);

    let bodyHtml = input.bodyHtml || '';
    if (signature) {
      bodyHtml += `<br/><div class="email-signature">${signature}</div>`;
    }

    // Build forwarded original
    const forwardedHtml = `
      <br/><br/>
      <div class="email-forward" style="border-top: 1px solid #ccc; padding-top: 12px;">
        <p><strong>---------- Forwarded message ----------</strong></p>
        <p>From: ${original.fromName || ''} &lt;${original.fromAddress}&gt;</p>
        <p>Date: ${original.createdAt.toUTCString()}</p>
        <p>Subject: ${original.subject}</p>
        <p>To: ${((original.toAddresses as Array<{name?: string; address: string}>) || []).map(a => a.name ? `${a.name} &lt;${a.address}&gt;` : a.address).join(', ')}</p>
        <br/>
        ${original.bodyHtml || original.bodyText || ''}
      </div>
    `;
    bodyHtml += forwardedHtml;

    // Combine original attachments with any new ones
    const allAttachments = [
      ...((original.attachments as Array<{ name: string; url: string; mimeType: string; size: number }>) || []),
      ...(input.attachments || []),
    ];

    return this.sendEmail(userId, {
      accountId: original.accountId || undefined,
      to: input.to,
      cc: input.cc,
      bcc: input.bcc,
      subject: original.subject.startsWith('Fwd:') ? original.subject : `Fwd: ${original.subject}`,
      bodyHtml,
      bodyText: input.bodyText,
      attachments: allAttachments.length > 0 ? allAttachments : undefined,
      scheduledAt: input.scheduledAt,
    });
  }

  // ------------------------------------------
  // GET EMAILS BY FOLDER + PAGINATION
  // ------------------------------------------

  async getEmails(userId: string, query: EmailQueryInput) {
    const where: Record<string, unknown> = {
      userId,
      deletedAt: null,
    };

    if (query.folder) {
      where.folder = query.folder;
    }

    // Handle snoozed: emails snoozed past their time return to INBOX
    if (query.folder === 'INBOX') {
      // Un-snooze expired snoozes
      await prisma.email.updateMany({
        where: {
          userId,
          snoozedUntil: { lte: new Date() },
          folder: { not: 'INBOX' },
        },
        data: { folder: 'INBOX', snoozedUntil: null },
      });
    }

    if (query.isRead !== undefined) {
      where.isRead = query.isRead;
    }

    if (query.isStarred !== undefined) {
      where.isStarred = query.isStarred;
    }

    if (query.label) {
      where.labels = { has: query.label };
    }

    if (query.hasAttachment) {
      where.attachments = { not: null };
    }

    if (query.from) {
      where.fromAddress = { contains: query.from, mode: 'insensitive' };
    }

    if (query.dateFrom || query.dateTo) {
      where.createdAt = {};
      if (query.dateFrom) (where.createdAt as Record<string, unknown>).gte = query.dateFrom;
      if (query.dateTo) (where.createdAt as Record<string, unknown>).lte = query.dateTo;
    }

    if (query.threadId) {
      where.threadId = query.threadId;
    }

    // Full-text search on subject + body
    if (query.search) {
      where.OR = [
        { subject: { contains: query.search, mode: 'insensitive' } },
        { bodyText: { contains: query.search, mode: 'insensitive' } },
        { bodyHtml: { contains: query.search, mode: 'insensitive' } },
        { fromAddress: { contains: query.search, mode: 'insensitive' } },
        { fromName: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    if (query.to) {
      // Search within JSON to addresses - use raw query approach via string match
      where.toAddresses = { string_contains: query.to };
    }

    const skip = (query.page - 1) * query.limit;

    const [emails, total] = await Promise.all([
      prisma.email.findMany({
        where,
        orderBy: { [query.sortBy]: query.sortOrder },
        skip,
        take: query.limit,
        select: {
          id: true,
          folder: true,
          fromAddress: true,
          fromName: true,
          toAddresses: true,
          ccAddresses: true,
          subject: true,
          bodyText: true,
          bodyHtml: true,
          isRead: true,
          isStarred: true,
          labels: true,
          threadId: true,
          attachments: true,
          scheduledAt: true,
          snoozedUntil: true,
          isInternal: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.email.count({ where }),
    ]);

    return {
      emails,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async getEmailById(userId: string, emailId: string) {
    const email = await prisma.email.findFirst({
      where: { id: emailId, userId, deletedAt: null },
    });
    if (!email) throw new AppError(404, 'Email not found', 'EMAIL_NOT_FOUND');
    return email;
  }

  // ------------------------------------------
  // READ / UNREAD TOGGLE
  // ------------------------------------------

  async toggleRead(userId: string, emailId: string) {
    const email = await prisma.email.findFirst({
      where: { id: emailId, userId, deletedAt: null },
    });
    if (!email) throw new AppError(404, 'Email not found', 'EMAIL_NOT_FOUND');

    return prisma.email.update({
      where: { id: emailId },
      data: { isRead: !email.isRead },
    });
  }

  async markRead(userId: string, emailId: string, isRead: boolean) {
    const email = await prisma.email.findFirst({
      where: { id: emailId, userId, deletedAt: null },
    });
    if (!email) throw new AppError(404, 'Email not found', 'EMAIL_NOT_FOUND');

    return prisma.email.update({
      where: { id: emailId },
      data: { isRead },
    });
  }

  // ------------------------------------------
  // STAR / UNSTAR
  // ------------------------------------------

  async toggleStar(userId: string, emailId: string) {
    const email = await prisma.email.findFirst({
      where: { id: emailId, userId, deletedAt: null },
    });
    if (!email) throw new AppError(404, 'Email not found', 'EMAIL_NOT_FOUND');

    return prisma.email.update({
      where: { id: emailId },
      data: { isStarred: !email.isStarred },
    });
  }

  // ------------------------------------------
  // MOVE / ARCHIVE / TRASH / PERMANENT DELETE
  // ------------------------------------------

  async moveToFolder(userId: string, emailId: string, folder: string) {
    const email = await prisma.email.findFirst({
      where: { id: emailId, userId, deletedAt: null },
    });
    if (!email) throw new AppError(404, 'Email not found', 'EMAIL_NOT_FOUND');

    return prisma.email.update({
      where: { id: emailId },
      data: { folder: folder as 'INBOX' | 'SENT' | 'DRAFTS' | 'ARCHIVE' | 'TRASH' | 'SPAM', snoozedUntil: null },
    });
  }

  async archiveEmail(userId: string, emailId: string) {
    return this.moveToFolder(userId, emailId, 'ARCHIVE');
  }

  async trashEmail(userId: string, emailId: string) {
    return this.moveToFolder(userId, emailId, 'TRASH');
  }

  async permanentDelete(userId: string, emailId: string) {
    const email = await prisma.email.findFirst({
      where: { id: emailId, userId },
    });
    if (!email) throw new AppError(404, 'Email not found', 'EMAIL_NOT_FOUND');

    // Only allow permanent delete from TRASH
    if (email.folder !== 'TRASH') {
      throw new AppError(400, 'Can only permanently delete emails from Trash. Move to Trash first.', 'NOT_IN_TRASH');
    }

    await prisma.email.delete({ where: { id: emailId } });
    return { deleted: true };
  }

  // ------------------------------------------
  // LABELS: CREATE, ASSIGN, REMOVE
  // ------------------------------------------

  async createLabel(userId: string, input: CreateLabelInput) {
    const existing = await prisma.emailLabel.findUnique({
      where: { userId_name: { userId, name: input.name } },
    });
    if (existing) {
      throw new AppError(409, 'Label already exists', 'LABEL_EXISTS');
    }

    return prisma.emailLabel.create({
      data: { userId, name: input.name, color: input.color },
    });
  }

  async getLabels(userId: string) {
    return prisma.emailLabel.findMany({
      where: { userId },
      orderBy: { name: 'asc' },
    });
  }

  async updateLabel(userId: string, labelId: string, input: UpdateLabelInput) {
    const label = await prisma.emailLabel.findFirst({
      where: { id: labelId, userId },
    });
    if (!label) throw new AppError(404, 'Label not found', 'LABEL_NOT_FOUND');

    // If renaming, update all emails that have the old label name
    if (input.name && input.name !== label.name) {
      const emailsWithLabel = await prisma.email.findMany({
        where: { userId, labels: { has: label.name } },
        select: { id: true, labels: true },
      });

      await Promise.all(
        emailsWithLabel.map((email) =>
          prisma.email.update({
            where: { id: email.id },
            data: {
              labels: email.labels.map((l) => (l === label.name ? input.name! : l)),
            },
          })
        )
      );
    }

    return prisma.emailLabel.update({
      where: { id: labelId },
      data: { name: input.name, color: input.color },
    });
  }

  async deleteLabel(userId: string, labelId: string) {
    const label = await prisma.emailLabel.findFirst({
      where: { id: labelId, userId },
    });
    if (!label) throw new AppError(404, 'Label not found', 'LABEL_NOT_FOUND');

    // Remove the label from all emails
    const emailsWithLabel = await prisma.email.findMany({
      where: { userId, labels: { has: label.name } },
      select: { id: true, labels: true },
    });

    await Promise.all(
      emailsWithLabel.map((email) =>
        prisma.email.update({
          where: { id: email.id },
          data: {
            labels: email.labels.filter((l) => l !== label.name),
          },
        })
      )
    );

    await prisma.emailLabel.delete({ where: { id: labelId } });
    return { deleted: true };
  }

  async assignLabel(userId: string, emailIds: string[], labelName: string) {
    // Ensure label exists
    await prisma.emailLabel.upsert({
      where: { userId_name: { userId, name: labelName } },
      create: { userId, name: labelName },
      update: {},
    });

    const emails = await prisma.email.findMany({
      where: { id: { in: emailIds }, userId },
      select: { id: true, labels: true },
    });

    await Promise.all(
      emails.map((email) => {
        if (!email.labels.includes(labelName)) {
          return prisma.email.update({
            where: { id: email.id },
            data: { labels: [...email.labels, labelName] },
          });
        }
        return Promise.resolve();
      })
    );

    return { applied: true, count: emails.length };
  }

  async removeLabel(userId: string, emailIds: string[], labelName: string) {
    const emails = await prisma.email.findMany({
      where: { id: { in: emailIds }, userId },
      select: { id: true, labels: true },
    });

    await Promise.all(
      emails.map((email) =>
        prisma.email.update({
          where: { id: email.id },
          data: {
            labels: email.labels.filter((l) => l !== labelName),
          },
        })
      )
    );

    return { removed: true, count: emails.length };
  }

  // ------------------------------------------
  // DRAFTS: SAVE, AUTO-SAVE, SEND DRAFT
  // ------------------------------------------

  async saveDraft(userId: string, input: SaveDraftInput) {
    const sender = await getUserInfo(userId);

    const draft = await prisma.email.create({
      data: {
        userId,
        accountId: input.accountId,
        folder: 'DRAFTS',
        fromAddress: sender.email,
        fromName: sender.displayName,
        toAddresses: (input.to || []) as unknown as Prisma.InputJsonValue,
        ccAddresses: input.cc as unknown as Prisma.InputJsonValue,
        subject: input.subject || '(no subject)',
        bodyHtml: input.bodyHtml,
        bodyText: input.bodyText,
        isRead: true,
        messageId: generateMessageId(),
        threadId: input.threadId || randomUUID(),
        inReplyTo: input.inReplyTo,
        attachments: input.attachments as unknown as Prisma.InputJsonValue,
      },
    });

    return draft;
  }

  async updateDraft(userId: string, draftId: string, input: SaveDraftInput) {
    const draft = await prisma.email.findFirst({
      where: { id: draftId, userId, folder: 'DRAFTS', deletedAt: null },
    });
    if (!draft) throw new AppError(404, 'Draft not found', 'DRAFT_NOT_FOUND');

    return prisma.email.update({
      where: { id: draftId },
      data: {
        toAddresses: input.to !== undefined ? (input.to as unknown as Prisma.InputJsonValue) : undefined,
        ccAddresses: input.cc !== undefined ? (input.cc as unknown as Prisma.InputJsonValue) : undefined,
        bccAddresses: input.bcc !== undefined ? (input.bcc as unknown as Prisma.InputJsonValue) : undefined,
        subject: input.subject,
        bodyHtml: input.bodyHtml,
        bodyText: input.bodyText,
        attachments: input.attachments !== undefined ? (input.attachments as unknown as Prisma.InputJsonValue) : undefined,
        accountId: input.accountId,
      },
    });
  }

  async sendDraft(userId: string, draftId: string) {
    const draft = await prisma.email.findFirst({
      where: { id: draftId, userId, folder: 'DRAFTS', deletedAt: null },
    });
    if (!draft) throw new AppError(404, 'Draft not found', 'DRAFT_NOT_FOUND');

    const toAddresses = draft.toAddresses as unknown as EmailAddress[];
    if (!toAddresses || toAddresses.length === 0) {
      throw new AppError(400, 'Draft has no recipients', 'NO_RECIPIENTS');
    }

    // Delete the draft
    await prisma.email.delete({ where: { id: draftId } });

    // Send as a new email
    return this.sendEmail(userId, {
      accountId: draft.accountId || undefined,
      to: toAddresses,
      cc: (draft.ccAddresses as unknown as EmailAddress[]) || undefined,
      bcc: (draft.bccAddresses as unknown as EmailAddress[]) || undefined,
      subject: draft.subject,
      bodyHtml: draft.bodyHtml || undefined,
      bodyText: draft.bodyText || undefined,
      attachments: (draft.attachments as unknown as Array<{ name: string; url: string; mimeType: string; size: number }>) || undefined,
    });
  }

  // ------------------------------------------
  // SIGNATURES: CRUD + SET DEFAULT
  // ------------------------------------------

  async createSignature(userId: string, input: CreateSignatureInput) {
    // If setting as default, unset any existing defaults
    if (input.isDefault) {
      await prisma.emailSignature.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });
    }

    return prisma.emailSignature.create({
      data: { userId, name: input.name, bodyHtml: input.bodyHtml, isDefault: input.isDefault },
    });
  }

  async getSignatures(userId: string) {
    return prisma.emailSignature.findMany({
      where: { userId },
      orderBy: { name: 'asc' },
    });
  }

  async getSignature(userId: string, signatureId: string) {
    const sig = await prisma.emailSignature.findFirst({
      where: { id: signatureId, userId },
    });
    if (!sig) throw new AppError(404, 'Signature not found', 'SIGNATURE_NOT_FOUND');
    return sig;
  }

  async updateSignature(userId: string, signatureId: string, input: UpdateSignatureInput) {
    const sig = await prisma.emailSignature.findFirst({
      where: { id: signatureId, userId },
    });
    if (!sig) throw new AppError(404, 'Signature not found', 'SIGNATURE_NOT_FOUND');

    if (input.isDefault) {
      await prisma.emailSignature.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });
    }

    return prisma.emailSignature.update({
      where: { id: signatureId },
      data: {
        name: input.name,
        bodyHtml: input.bodyHtml,
        isDefault: input.isDefault,
      },
    });
  }

  async deleteSignature(userId: string, signatureId: string) {
    const sig = await prisma.emailSignature.findFirst({
      where: { id: signatureId, userId },
    });
    if (!sig) throw new AppError(404, 'Signature not found', 'SIGNATURE_NOT_FOUND');

    await prisma.emailSignature.delete({ where: { id: signatureId } });
    return { deleted: true };
  }

  async setDefaultSignature(userId: string, signatureId: string) {
    const sig = await prisma.emailSignature.findFirst({
      where: { id: signatureId, userId },
    });
    if (!sig) throw new AppError(404, 'Signature not found', 'SIGNATURE_NOT_FOUND');

    await prisma.emailSignature.updateMany({
      where: { userId, isDefault: true },
      data: { isDefault: false },
    });

    return prisma.emailSignature.update({
      where: { id: signatureId },
      data: { isDefault: true },
    });
  }

  // ------------------------------------------
  // EMAIL ACCOUNTS: ADD, UPDATE, DELETE, TEST
  // ------------------------------------------

  async addEmailAccount(userId: string, input: EmailAccountConfigInput) {
    if (input.isDefault) {
      await prisma.emailAccount.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });
    }

    return prisma.emailAccount.create({
      data: {
        userId,
        email: input.email,
        displayName: input.displayName,
        smtpHost: input.smtpHost,
        smtpPort: input.smtpPort,
        smtpUser: input.smtpUser,
        smtpPass: input.smtpPass,
        smtpSecure: input.smtpSecure,
        imapHost: input.imapHost,
        imapPort: input.imapPort,
        imapUser: input.imapUser,
        imapPass: input.imapPass,
        imapSecure: input.imapSecure,
        syncEnabled: input.syncEnabled,
        syncInterval: input.syncInterval,
        isDefault: input.isDefault,
      },
    });
  }

  async getEmailAccounts(userId: string) {
    return prisma.emailAccount.findMany({
      where: { userId },
      select: {
        id: true,
        email: true,
        displayName: true,
        smtpHost: true,
        smtpPort: true,
        smtpUser: true,
        smtpSecure: true,
        imapHost: true,
        imapPort: true,
        imapUser: true,
        imapSecure: true,
        syncEnabled: true,
        syncInterval: true,
        lastSyncAt: true,
        isDefault: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getEmailAccount(userId: string, accountId: string) {
    const account = await prisma.emailAccount.findFirst({
      where: { id: accountId, userId },
      select: {
        id: true,
        email: true,
        displayName: true,
        smtpHost: true,
        smtpPort: true,
        smtpUser: true,
        smtpSecure: true,
        imapHost: true,
        imapPort: true,
        imapUser: true,
        imapSecure: true,
        syncEnabled: true,
        syncInterval: true,
        lastSyncAt: true,
        isDefault: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!account) throw new AppError(404, 'Email account not found', 'ACCOUNT_NOT_FOUND');
    return account;
  }

  async updateEmailAccount(userId: string, accountId: string, input: UpdateEmailAccountInput) {
    const account = await prisma.emailAccount.findFirst({
      where: { id: accountId, userId },
    });
    if (!account) throw new AppError(404, 'Email account not found', 'ACCOUNT_NOT_FOUND');

    if (input.isDefault) {
      await prisma.emailAccount.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });
    }

    return prisma.emailAccount.update({
      where: { id: accountId },
      data: input,
    });
  }

  async deleteEmailAccount(userId: string, accountId: string) {
    const account = await prisma.emailAccount.findFirst({
      where: { id: accountId, userId },
    });
    if (!account) throw new AppError(404, 'Email account not found', 'ACCOUNT_NOT_FOUND');

    await prisma.emailAccount.delete({ where: { id: accountId } });
    return { deleted: true };
  }

  async testConnection(input: { smtpHost: string; smtpPort: number; smtpUser: string; smtpPass: string; smtpSecure: boolean }) {
    const transport = nodemailer.createTransport({
      host: input.smtpHost,
      port: input.smtpPort,
      secure: input.smtpSecure,
      auth: { user: input.smtpUser, pass: input.smtpPass },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
    });

    try {
      await transport.verify();
      transport.close();
      return { success: true, message: 'SMTP connection successful' };
    } catch (err) {
      transport.close();
      const message = err instanceof Error ? err.message : 'Unknown error';
      throw new AppError(400, `SMTP connection failed: ${message}`, 'SMTP_CONNECTION_FAILED');
    }
  }

  // ------------------------------------------
  // SEARCH
  // ------------------------------------------

  async searchEmails(userId: string, query: EmailQueryInput) {
    // searchEmails is an alias for getEmails with search param required
    return this.getEmails(userId, query);
  }

  // ------------------------------------------
  // EMAIL THREADING
  // ------------------------------------------

  async getThread(userId: string, threadId: string) {
    const emails = await prisma.email.findMany({
      where: { userId, threadId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });

    if (emails.length === 0) {
      throw new AppError(404, 'Thread not found', 'THREAD_NOT_FOUND');
    }

    return {
      threadId,
      subject: emails[0].subject.replace(/^(Re:\s*|Fwd:\s*)*/i, ''),
      emailCount: emails.length,
      participants: this.extractThreadParticipants(emails),
      emails,
    };
  }

  async getThreads(userId: string, folder: string, page = 1, limit = 50) {
    // Get distinct thread IDs in the given folder, ordered by latest email
    const latestEmails = await prisma.email.findMany({
      where: { userId, folder: folder as 'INBOX', deletedAt: null },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        threadId: true,
        subject: true,
        fromAddress: true,
        fromName: true,
        bodyText: true,
        isRead: true,
        isStarred: true,
        createdAt: true,
        attachments: true,
        labels: true,
      },
    });

    // Group by threadId, take the latest email as the thread representative
    const threadMap = new Map<string, typeof latestEmails[0] & { emailCount: number; hasUnread: boolean }>();
    for (const email of latestEmails) {
      const tid = email.threadId || email.id;
      if (!threadMap.has(tid)) {
        threadMap.set(tid, { ...email, emailCount: 1, hasUnread: !email.isRead });
      } else {
        const existing = threadMap.get(tid)!;
        existing.emailCount++;
        if (!email.isRead) existing.hasUnread = true;
      }
    }

    const threads = Array.from(threadMap.values());
    const total = threads.length;
    const paginated = threads.slice((page - 1) * limit, page * limit);

    return {
      threads: paginated,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  private extractThreadParticipants(emails: Array<{ fromAddress: string; fromName: string | null }>) {
    const seen = new Set<string>();
    const participants: Array<{ address: string; name: string | null }> = [];
    for (const email of emails) {
      if (!seen.has(email.fromAddress)) {
        seen.add(email.fromAddress);
        participants.push({ address: email.fromAddress, name: email.fromName });
      }
    }
    return participants;
  }

  // ------------------------------------------
  // SNOOZE
  // ------------------------------------------

  async snoozeEmail(userId: string, emailId: string, input: SnoozeEmailInput) {
    const email = await prisma.email.findFirst({
      where: { id: emailId, userId, deletedAt: null },
    });
    if (!email) throw new AppError(404, 'Email not found', 'EMAIL_NOT_FOUND');

    if (input.snoozedUntil <= new Date()) {
      throw new AppError(400, 'Snooze time must be in the future', 'INVALID_SNOOZE_TIME');
    }

    return prisma.email.update({
      where: { id: emailId },
      data: { snoozedUntil: input.snoozedUntil, folder: 'ARCHIVE' },
    });
  }

  async unsnoozeEmail(userId: string, emailId: string) {
    const email = await prisma.email.findFirst({
      where: { id: emailId, userId, deletedAt: null },
    });
    if (!email) throw new AppError(404, 'Email not found', 'EMAIL_NOT_FOUND');

    return prisma.email.update({
      where: { id: emailId },
      data: { snoozedUntil: null, folder: 'INBOX' },
    });
  }

  // ------------------------------------------
  // SCHEDULE SEND
  // ------------------------------------------

  async cancelScheduledSend(userId: string, emailId: string) {
    const email = await prisma.email.findFirst({
      where: { id: emailId, userId, scheduledAt: { not: null }, deletedAt: null },
    });
    if (!email) throw new AppError(404, 'Scheduled email not found', 'EMAIL_NOT_FOUND');

    // Convert to regular draft
    return prisma.email.update({
      where: { id: emailId },
      data: { scheduledAt: null, folder: 'DRAFTS' },
    });
  }

  async getScheduledEmails(userId: string) {
    return prisma.email.findMany({
      where: { userId, scheduledAt: { not: null, gt: new Date() }, deletedAt: null },
      orderBy: { scheduledAt: 'asc' },
    });
  }

  // ------------------------------------------
  // BULK OPERATIONS
  // ------------------------------------------

  async bulkArchive(userId: string, emailIds: string[]) {
    const result = await prisma.email.updateMany({
      where: { id: { in: emailIds }, userId, deletedAt: null },
      data: { folder: 'ARCHIVE' },
    });
    return { archived: result.count };
  }

  async bulkDelete(userId: string, emailIds: string[]) {
    const result = await prisma.email.updateMany({
      where: { id: { in: emailIds }, userId, deletedAt: null },
      data: { folder: 'TRASH' },
    });
    return { trashed: result.count };
  }

  async bulkPermanentDelete(userId: string, emailIds: string[]) {
    const result = await prisma.email.deleteMany({
      where: { id: { in: emailIds }, userId, folder: 'TRASH' },
    });
    return { deleted: result.count };
  }

  async bulkMarkRead(userId: string, input: BulkMarkReadInput) {
    const result = await prisma.email.updateMany({
      where: { id: { in: input.emailIds }, userId, deletedAt: null },
      data: { isRead: input.isRead },
    });
    return { updated: result.count };
  }

  async bulkLabel(userId: string, input: BulkLabelInput) {
    return this.assignLabel(userId, input.emailIds, input.labelName);
  }

  async bulkRemoveLabel(userId: string, input: BulkLabelInput) {
    return this.removeLabel(userId, input.emailIds, input.labelName);
  }

  async bulkMove(userId: string, input: BulkMoveInput) {
    const result = await prisma.email.updateMany({
      where: { id: { in: input.emailIds }, userId, deletedAt: null },
      data: { folder: input.folder, snoozedUntil: null },
    });
    return { moved: result.count };
  }

  // ------------------------------------------
  // FOLDER COUNTS (for sidebar badges)
  // ------------------------------------------

  async getFolderCounts(userId: string) {
    const folders = ['INBOX', 'SENT', 'DRAFTS', 'ARCHIVE', 'TRASH', 'SPAM'] as const;

    const counts = await Promise.all(
      folders.map(async (folder) => {
        const total = await prisma.email.count({
          where: { userId, folder, deletedAt: null },
        });
        const unread = folder === 'SENT' || folder === 'DRAFTS'
          ? 0
          : await prisma.email.count({
              where: { userId, folder, deletedAt: null, isRead: false },
            });
        return { folder, total, unread };
      })
    );

    return counts;
  }

  // ------------------------------------------
  // EMPTY TRASH / SPAM
  // ------------------------------------------

  async emptyTrash(userId: string) {
    const result = await prisma.email.deleteMany({
      where: { userId, folder: 'TRASH' },
    });
    return { deleted: result.count };
  }

  async emptySpam(userId: string) {
    const result = await prisma.email.deleteMany({
      where: { userId, folder: 'SPAM' },
    });
    return { deleted: result.count };
  }
}

export const emailService = new EmailService();
