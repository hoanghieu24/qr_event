import nodemailer from 'nodemailer';
import { ENV } from './env';

const isSmtpConfigured =
  ENV.SMTP_USER &&
  ENV.SMTP_PASS &&
  ENV.SMTP_USER !== 'test@example.com' &&
  ENV.SMTP_PASS !== 'testpass';

export const transporter = nodemailer.createTransport({
  host: ENV.SMTP_HOST,
  port: ENV.SMTP_PORT,
  secure: ENV.SMTP_SECURE,
  auth: {
    user: ENV.SMTP_USER,
    pass: ENV.SMTP_PASS,
  },
});

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}): Promise<boolean> {
  try {
    if (!isSmtpConfigured) {
      console.log(`[SMTP SIMULATION] To: ${to} | Subject: "${subject}"`);
      console.log(`[SMTP SIMULATION] Content:`, html.substring(0, 300) + '...');
      return true;
    }

    const info = await transporter.sendMail({
      from: `"${ENV.SMTP_FROM_NAME}" <${ENV.SMTP_FROM_EMAIL}>`,
      to,
      subject,
      html,
    });

    console.log(`[SMTP REAL] Email sent to ${to}, MessageId: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error(`[SMTP ERROR] Failed to send email to ${to}:`, error);
    // Don't crash request if email fails, but log error
    return false;
  }
}
