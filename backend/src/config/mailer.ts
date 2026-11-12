import nodemailer from 'nodemailer';
import type { Attachment } from 'nodemailer/lib/mailer';
import { ENV } from './env';
import { query } from './database';

export interface SmtpConfig {
  configured: boolean;
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  fromName: string;
  fromEmail: string;
  emailOnApproved: boolean;
}

export interface SendEmailResult {
  sent: boolean;
  simulated: boolean;
  error?: string;
}

const PLACEHOLDER_USERS = new Set(['', 'test@example.com', 'noreply@eventqr.com', 'no-reply@eventqr.com']);
const PLACEHOLDER_PASSES = new Set(['', 'testpass']);

function isValidCredential(user?: string, pass?: string): boolean {
  const cleanUser = (user || '').trim();
  const cleanPass = (pass || '').trim();
  return (
    cleanUser.length > 0 &&
    cleanPass.length > 0 &&
    !PLACEHOLDER_USERS.has(cleanUser.toLowerCase()) &&
    !PLACEHOLDER_PASSES.has(cleanPass)
  );
}

/**
 * Resolve effective SMTP configuration: prefers non-placeholder values saved in
 * `system_settings` (Admin Settings UI), falling back to environment variables.
 */
export async function getEffectiveSmtpConfig(): Promise<SmtpConfig> {
  const dbSettings: Record<string, string> = {};
  try {
    const rows = await query<Array<{ key: string; value: string }>>(
      `SELECT \`key\`, \`value\` FROM system_settings
       WHERE \`key\` IN ('smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'smtp_from_name', 'smtp_sender_name', 'smtp_from_email', 'email_on_approved')`
    );
    for (const r of rows) {
      dbSettings[r.key] = r.value ?? '';
    }
  } catch {
    // Fallback silently to ENV if system_settings table is not ready yet
  }

  const emailOnApprovedRaw = (dbSettings.email_on_approved ?? '1').trim().toLowerCase();
  const emailOnApproved = !['0', 'false', 'off'].includes(emailOnApprovedRaw);

  const dbHasCredentials = isValidCredential(dbSettings.smtp_user, dbSettings.smtp_pass);
  const envHasCredentials = isValidCredential(ENV.SMTP_USER, ENV.SMTP_PASS);

  if (dbHasCredentials) {
    const port = Number(dbSettings.smtp_port) || 587;
    const user = dbSettings.smtp_user.trim();
    const fromName = (dbSettings.smtp_from_name || dbSettings.smtp_sender_name || ENV.SMTP_FROM_NAME || 'KTSQR Event System').trim();
    const rawFromEmail = (dbSettings.smtp_from_email || '').trim();
    const fromEmail =
      rawFromEmail && !PLACEHOLDER_USERS.has(rawFromEmail.toLowerCase()) ? rawFromEmail : user;
    return {
      configured: true,
      host: (dbSettings.smtp_host || ENV.SMTP_HOST || 'smtp.gmail.com').trim(),
      port,
      secure: port === 465,
      user,
      pass: dbSettings.smtp_pass.trim(),
      fromName,
      fromEmail,
      emailOnApproved,
    };
  }

  if (envHasCredentials) {
    const port = ENV.SMTP_PORT || 587;
    const user = ENV.SMTP_USER.trim();
    const fromEmail =
      ENV.SMTP_FROM_EMAIL && !PLACEHOLDER_USERS.has(ENV.SMTP_FROM_EMAIL.trim().toLowerCase())
        ? ENV.SMTP_FROM_EMAIL.trim()
        : user;
    return {
      configured: true,
      host: ENV.SMTP_HOST || 'smtp.gmail.com',
      port,
      secure: ENV.SMTP_SECURE || port === 465,
      user,
      pass: ENV.SMTP_PASS.trim(),
      fromName: ENV.SMTP_FROM_NAME || 'KTSQR Event System',
      fromEmail,
      emailOnApproved,
    };
  }

  return {
    configured: false,
    host: ENV.SMTP_HOST || 'smtp.gmail.com',
    port: ENV.SMTP_PORT || 587,
    secure: ENV.SMTP_SECURE,
    user: ENV.SMTP_USER,
    pass: ENV.SMTP_PASS,
    fromName: ENV.SMTP_FROM_NAME || 'KTSQR Event System',
    fromEmail: ENV.SMTP_FROM_EMAIL || 'no-reply@eventqr.com',
    emailOnApproved,
  };
}

export async function isRealSmtpConfigured(): Promise<boolean> {
  const config = await getEffectiveSmtpConfig();
  return config.configured;
}

export async function shouldSendApprovedEmail(): Promise<boolean> {
  const config = await getEffectiveSmtpConfig();
  return config.emailOnApproved;
}

export async function sendEmailWithResult({
  to,
  subject,
  html,
  attachments,
}: {
  to: string;
  subject: string;
  html: string;
  attachments?: Attachment[];
}): Promise<SendEmailResult> {
  try {
    const config = await getEffectiveSmtpConfig();

    if (!config.configured) {
      console.log(`[SMTP SIMULATION] To: ${to} | Subject: "${subject}"`);
      console.log(`[SMTP SIMULATION] Content:`, html.substring(0, 300) + '...');
      return { sent: true, simulated: true };
    }

    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
      auth: {
        user: config.user,
        pass: config.pass,
      },
    });

    const info = await transporter.sendMail({
      from: `"${config.fromName}" <${config.fromEmail}>`,
      to,
      subject,
      html,
      attachments,
    });

    console.log(`[SMTP REAL] Email sent to ${to}, MessageId: ${info.messageId}`);
    return { sent: true, simulated: false };
  } catch (error: any) {
    console.error(`[SMTP ERROR] Failed to send email to ${to}:`, error);
    return {
      sent: false,
      simulated: false,
      error: error?.message || 'Lỗi gửi email SMTP.',
    };
  }
}

export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
  attachments?: Attachment[];
}): Promise<boolean> {
  const res = await sendEmailWithResult(params);
  return res.sent;
}
