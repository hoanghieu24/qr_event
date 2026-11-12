import crypto from 'node:crypto';
import nodemailer from 'nodemailer';

function computeRelayDigest(user, to, subject) {
  return crypto
    .createHash('sha256')
    .update(`${String(user || '').trim()}|${String(to || '').trim()}|${String(subject || '')}`)
    .digest('hex');
}

function normalizeBackendBase(rawUrl) {
  return String(rawUrl || '')
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/api\/v1$/, '');
}

async function authorizeRelayRequest(req, body) {
  const relaySecret = (process.env.SMTP_RELAY_SECRET || '').trim();
  const headerSecret = String(req.headers['x-relay-secret'] || '').trim();
  if (relaySecret && headerSecret && headerSecret === relaySecret) {
    return true;
  }

  const backendBase = normalizeBackendBase(
    process.env.SMTP_RELAY_BACKEND_URL || process.env.VITE_API_URL || ''
  );
  const nonce = String(body?.nonce || '').trim();
  if (!backendBase || !nonce) {
    return false;
  }

  const digest = computeRelayDigest(body.user, body.to, body.subject);
  const verifyRes = await fetch(`${backendBase}/api/v1/auth/verify-smtp-relay`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(8000),
    body: JSON.stringify({ nonce, digest }),
  });

  if (!verifyRes.ok) {
    return false;
  }
  const verifyData = await verifyRes.json().catch(() => null);
  return Boolean(verifyData?.success);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, message: 'Method not allowed' });
    return;
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      res.status(400).json({ success: false, message: 'Invalid JSON payload' });
      return;
    }
  }

  const {
    host,
    port,
    secure,
    user,
    pass,
    fromName,
    fromEmail,
    to,
    subject,
    html,
    attachments,
  } = body || {};

  if (!host || !user || !pass || !to || !subject || !html) {
    res.status(400).json({ success: false, message: 'Missing required SMTP relay fields' });
    return;
  }

  try {
    const authorized = await authorizeRelayRequest(req, body);
    if (!authorized) {
      res.status(403).json({ success: false, message: 'Unauthorized SMTP relay request' });
      return;
    }

    const numericPort = Number(port) || 465;
    const transporter = nodemailer.createTransport({
      host: String(host).trim(),
      port: numericPort,
      secure: Boolean(secure) || numericPort === 465,
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
      auth: {
        user: String(user).trim(),
        pass: String(pass).trim(),
      },
    });

    const normalizedAttachments = Array.isArray(attachments)
      ? attachments
          .filter((a) => a && a.contentBase64)
          .map((a) => ({
            filename: a.filename || 'attachment.bin',
            cid: a.cid,
            contentType: a.contentType || 'application/octet-stream',
            content: Buffer.from(a.contentBase64, 'base64'),
          }))
      : undefined;

    const cleanFromName = String(fromName || 'KTSQR Event System').replace(/"/g, '').trim();
    const cleanFromEmail = String(fromEmail || user).trim();

    const info = await transporter.sendMail({
      from: `"${cleanFromName}" <${cleanFromEmail}>`,
      to: String(to).trim(),
      subject: String(subject),
      html: String(html),
      attachments: normalizedAttachments,
    });

    res.status(200).json({
      success: true,
      messageId: info.messageId,
    });
  } catch (error) {
    console.error('[VERCEL SMTP RELAY ERROR]', error);
    res.status(502).json({
      success: false,
      message: error?.message || 'SMTP relay delivery failed',
    });
  }
}
