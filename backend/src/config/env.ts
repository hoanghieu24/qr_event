import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

const envFile = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(__dirname, '../../.env'),
  path.resolve(__dirname, '../../../.env'),
].find((candidate) => fs.existsSync(candidate));

if (envFile) dotenv.config({ path: envFile });

export const ENV = {
  PORT: parseInt(process.env.PORT || '5000', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  APP_URL: process.env.APP_URL || 'http://localhost:5000',
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',

  DATABASE_URL: process.env.DATABASE_URL || process.env.MYSQL_URL || '',
  DB_HOST: process.env.DB_HOST || '127.0.0.1',
  DB_PORT: parseInt(process.env.DB_PORT || '3306', 10),
  DB_USER: process.env.DB_USER || 'root',
  DB_PASSWORD: process.env.DB_PASSWORD || '',
  DB_NAME: process.env.DB_NAME || 'event_qr_db',
  DB_SSL: process.env.DB_SSL === 'true' || process.env.DB_SSL === '1' || Boolean(process.env.DATABASE_URL),

  JWT_SECRET: process.env.JWT_SECRET || 'secret-jwt-key-2026',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  INVITE_HMAC_SECRET: process.env.INVITE_HMAC_SECRET || 'invite-hmac-secret-123',
  QR_HMAC_SECRET: process.env.QR_HMAC_SECRET || 'qr-hmac-secret-456',

  SMTP_HOST: process.env.SMTP_HOST || 'smtp.gmail.com',
  SMTP_PORT: parseInt(process.env.SMTP_PORT || '587', 10),
  SMTP_SECURE: process.env.SMTP_SECURE === 'true',
  SMTP_USER: process.env.SMTP_USER || '',
  SMTP_PASS: process.env.SMTP_PASS || '',
  SMTP_FROM_NAME: process.env.SMTP_FROM_NAME || 'EventGo.vn',
  SMTP_FROM_EMAIL: process.env.SMTP_FROM_EMAIL || 'no-reply@eventqr.com',

  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME || '',
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY || '',
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET || '',
};
