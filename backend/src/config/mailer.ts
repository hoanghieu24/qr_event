import crypto from 'crypto';
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
  relayUrl?: string;
}

export interface SendEmailResult {
  sent: boolean;
  simulated: boolean;
  viaRelay?: boolean;
  messageId?: string;
  error?: string;
}

const PLACEHOLDER_USERS = new Set(['', 'test@example.com', 'noreply@eventqr.com', 'no-reply@eventqr.com']);
const PLACEHOLDER_PASSES = new Set(['', 'testpass']);
const DEFAULT_PRODUCTION_RELAY_URL = 'https://qr-event-three.vercel.app/api/smtp-relay';

const relayNonces = new Map<string, { digest: string; expiresAt: number }>();
let skipDirectSmtpUntil = 0;

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

function isPublicHttpsUrl(url?: string): boolean {
  const clean = (url || '').trim();
  return /^https:\/\/(?!localhost\b|127\.0\.0\.1\b)/i.test(clean);
}

export function resolveSmtpRelayUrl(dbRelayUrl?: string): string | undefined {
  const explicit = (process.env.SMTP_RELAY_URL || dbRelayUrl || '').trim();
  if (explicit) {
    if (explicit.endsWith('/api/smtp-relay')) return explicit;
    return `${explicit.replace(/\/+$/, '')}/api/smtp-relay`;
  }

  if (isPublicHttpsUrl(ENV.FRONTEND_URL)) {
    return `${ENV.FRONTEND_URL.trim().replace(/\/+$/, '')}/api/smtp-relay`;
  }

  if (ENV.NODE_ENV === 'production' || Boolean(process.env.RENDER)) {
    return DEFAULT_PRODUCTION_RELAY_URL;
  }

  return undefined;
}

function computeRelayDigest(user: string, to: string, subject: string): string {
  return crypto
    .createHash('sha256')
    .update(`${user.trim()}|${to.trim()}|${subject}`)
    .digest('hex');
}

function issueRelayNonce(user: string, to: string, subject: string): string {
  const now = Date.now();
  for (const [key, entry] of relayNonces.entries()) {
    if (entry.expiresAt <= now) {
      relayNonces.delete(key);
    }
  }
  const nonce = crypto.randomBytes(24).toString('hex');
  relayNonces.set(nonce, {
    digest: computeRelayDigest(user, to, subject),
    expiresAt: now + 60_000,
  });
  return nonce;
}

export function verifyRelayNonce(nonce: string, digest: string): boolean {
  const cleanNonce = (nonce || '').trim();
  const cleanDigest = (digest || '').trim();
  if (!cleanNonce || !cleanDigest) return false;

  const entry = relayNonces.get(cleanNonce);
  if (!entry) return false;

  relayNonces.delete(cleanNonce);
  return entry.expiresAt > Date.now() && entry.digest === cleanDigest;
}

function isTimeoutOrBlockedError(error: any): boolean {
  const code = String(error?.code || '').toUpperCase();
  const message = String(error?.message || '').toLowerCase();
  return (
    ['ETIMEDOUT', 'ECONNECTION', 'ESOCKET', 'ENETUNREACH', 'ECONNREFUSED', 'EHOSTUNREACH'].includes(code) ||
    message.includes('timeout') ||
    message.includes('timed out')
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
       WHERE \`key\` IN ('smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'smtp_from_name', 'smtp_sender_name', 'smtp_from_email', 'smtp_relay_url', 'email_on_approved')`
    );
    for (const r of rows) {
      dbSettings[r.key] = r.value ?? '';
    }
  } catch {
    // Fallback silently to ENV if system_settings table is not ready yet
  }

  const emailOnApprovedRaw = (dbSettings.email_on_approved ?? '1').trim().toLowerCase();
  const emailOnApproved = !['0', 'false', 'off'].includes(emailOnApprovedRaw);
  const relayUrl = resolveSmtpRelayUrl(dbSettings.smtp_relay_url);

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
      relayUrl,
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
      relayUrl,
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
    relayUrl,
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

async function sendViaRelay(
  config: Pick<SmtpConfig, 'host' | 'port' | 'secure' | 'user' | 'pass' | 'fromName' | 'fromEmail' | 'relayUrl'>,
  {
    to,
    subject,
    html,
    attachments,
  }: {
    to: string;
    subject: string;
    html: string;
    attachments?: Attachment[];
  }
): Promise<{ messageId?: string }> {
  if (!config.relayUrl) {
    throw new Error('Không tìm thấy URL SMTP HTTPS relay.');
  }

  const nonce = issueRelayNonce(config.user, to, subject);
  const serializedAttachments = (attachments || [])
    .map((att) => {
      let contentBase64: string | undefined;
      if (Buffer.isBuffer(att.content)) {
        contentBase64 = att.content.toString('base64');
      } else if (typeof att.content === 'string') {
        contentBase64 = Buffer.from(att.content).toString('base64');
      }
      if (!contentBase64) return null;
      return {
        filename: att.filename,
        cid: att.cid,
        contentType: att.contentType,
        contentBase64,
      };
    })
    .filter(Boolean);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (process.env.SMTP_RELAY_SECRET) {
    headers['x-relay-secret'] = process.env.SMTP_RELAY_SECRET;
  }

  const res = await fetch(config.relayUrl, {
    method: 'POST',
    headers,
    signal: AbortSignal.timeout(15000),
    body: JSON.stringify({
      nonce,
      host: config.host,
      port: config.port,
      secure: config.secure,
      user: config.user,
      pass: config.pass,
      fromName: config.fromName,
      fromEmail: config.fromEmail,
      to,
      subject,
      html,
      attachments: serializedAttachments,
    }),
  });

  const data: any = await res.json().catch(() => null);
  if (!res.ok || !data?.success) {
    throw new Error(data?.message || `HTTP ${res.status} từ SMTP relay`);
  }
  return { messageId: data.messageId };
}

export async function sendEmailWithCustomConfig(
  config: Pick<SmtpConfig, 'host' | 'port' | 'secure' | 'user' | 'pass' | 'fromName' | 'fromEmail' | 'relayUrl'>,
  {
    to,
    subject,
    html,
    attachments,
  }: {
    to: string;
    subject: string;
    html: string;
    attachments?: Attachment[];
  }
): Promise<SendEmailResult> {
  const relayUrl = config.relayUrl || resolveSmtpRelayUrl();
  const effectiveConfig = { ...config, relayUrl };

  const shouldTryDirectFirst = !relayUrl || Date.now() >= skipDirectSmtpUntil;
  if (shouldTryDirectFirst) {
    try {
      const transporter = nodemailer.createTransport({
        host: effectiveConfig.host,
        port: effectiveConfig.port,
        secure: effectiveConfig.secure,
        connectionTimeout: relayUrl ? 4500 : 10000,
        greetingTimeout: relayUrl ? 4500 : 10000,
        socketTimeout: 15000,
        auth: {
          user: effectiveConfig.user,
          pass: effectiveConfig.pass,
        },
      });

      const info = await transporter.sendMail({
        from: `"${effectiveConfig.fromName}" <${effectiveConfig.fromEmail}>`,
        to,
        subject,
        html,
        attachments,
      });

      console.log(`[SMTP REAL] Email sent to ${to}, MessageId: ${info.messageId}`);
      return { sent: true, simulated: false, viaRelay: false, messageId: info.messageId };
    } catch (directError: any) {
      if (!relayUrl || !isTimeoutOrBlockedError(directError)) {
        console.error(`[SMTP ERROR] Failed to send email to ${to}:`, directError);
        return {
          sent: false,
          simulated: false,
          error: directError?.message || 'Lỗi gửi email SMTP.',
        };
      }
      console.warn(`[SMTP DIRECT BLOCKED/TIMEOUT] Falling back to HTTPS relay (${relayUrl}): ${directError?.message}`);
    }
  }

  try {
    const relayRes = await sendViaRelay(effectiveConfig, { to, subject, html, attachments });
    // Skip blocked direct SMTP ports for 10 minutes once relay proves direct ports are firewalled
    skipDirectSmtpUntil = Date.now() + 10 * 60 * 1000;
    console.log(`[SMTP RELAY] Email sent to ${to}, MessageId: ${relayRes.messageId}`);
    return { sent: true, simulated: false, viaRelay: true, messageId: relayRes.messageId };
  } catch (relayError: any) {
    console.error(`[SMTP RELAY ERROR] Failed to send email to ${to}:`, relayError);
    return {
      sent: false,
      simulated: false,
      error: relayError?.message || 'Lỗi gửi email qua SMTP relay.',
    };
  }
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

    return await sendEmailWithCustomConfig(config, { to, subject, html, attachments });
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
