import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const EMAIL_FROM = process.env.EMAIL_FROM || 'noreply@celestix.ai';

interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  cc?: string[];
  bcc?: string[];
  replyTo?: string;
}

async function sendEmail(options: SendEmailOptions): Promise<{ id: string } | null> {
  if (!resend) return null;
  try {
    const payload: Record<string, unknown> = {
      from: EMAIL_FROM,
      to: Array.isArray(options.to) ? options.to : [options.to],
      subject: options.subject,
      cc: options.cc,
      bcc: options.bcc,
      replyTo: options.replyTo,
    };
    if (options.html) payload.html = options.html;
    else if (options.text) payload.text = options.text;

    const { data, error } = await resend.emails.send(payload as any);
    if (error) { console.error('Resend error:', error); return null; }
    return { id: data?.id || '' };
  } catch (err) {
    console.error('Email send failed:', (err as Error).message);
    return null;
  }
}

function isEmailConfigured(): boolean { return !!process.env.RESEND_API_KEY; }

export { sendEmail, isEmailConfigured };
