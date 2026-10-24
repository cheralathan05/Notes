import dotenv from 'dotenv';
import path from 'path';

// Load .env files from both project root and backend directory reliably regardless of cwd
dotenv.config({ path: path.resolve(__dirname, '../../.env'), override: true });
dotenv.config({ path: path.resolve(__dirname, '../.env'), override: true });
dotenv.config({ override: true });

const requiredVars = ['DATABASE_URL', 'SESSION_SECRET'];

export function validateEnv(): void {
  const missing = requiredVars.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach((key) => console.error(`   - ${key}`));
    process.exit(1);
  }
}

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',

  // Database
  databaseUrl: process.env.DATABASE_URL || '',

  // Session
  sessionSecret: process.env.SESSION_SECRET || 'dev-secret-change-me',
  sessionMaxAge: parseInt(process.env.SESSION_MAX_AGE || String(7 * 24 * 60 * 60 * 1000), 10), // 7 days

  // URLs
  appBaseUrl: (() => {
    const raw = (process.env.APP_BASE_URL || process.env.APP_URL || process.env.FRONTEND_URL || 'http://localhost:3001').trim().replace(/\/+$/, '');
    if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
    return `https://${raw}`;
  })(),
  apiBaseUrl: (process.env.API_BASE_URL || 'http://localhost:4000').trim().replace(/\/+$/, ''),
  frontendUrl: (() => {
    const raw = (process.env.FRONTEND_URL || process.env.APP_BASE_URL || process.env.APP_URL || 'http://localhost:3001').trim().replace(/\/+$/, '');
    if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
    return `https://${raw}`;
  })(),

  // Email & SMTP
  emailProvider: process.env.EMAIL_PROVIDER || (process.env.SMTP_USER ? 'smtp' : 'console'),
  emailFrom: process.env.EMAIL_FROM || process.env.SMTP_USER || 'noreply@workspace.app',
  smtpService: process.env.SMTP_SERVICE,
  smtpHost: process.env.SMTP_HOST || 'smtp.gmail.com',
  smtpPort: parseInt(process.env.SMTP_PORT || '587', 10),
  smtpSecure: process.env.SMTP_SECURE === 'true' || process.env.SMTP_PORT === '465',
  smtpUser: process.env.SMTP_USER || '',
  smtpPass: process.env.SMTP_PASS || '',

  // Tokens
  emailVerificationExpiry: 24 * 60 * 60 * 1000, // 24 hours
  passwordResetExpiry: 60 * 60 * 1000,           // 1 hour
  resendCooldown: 60 * 1000,                      // 1 minute

  // CORS
  corsOrigin: process.env.FRONTEND_URL || 'http://localhost:3001,http://localhost:3000',
} as const;

