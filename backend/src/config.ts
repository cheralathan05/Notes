import dotenv from 'dotenv';
dotenv.config({ path: '../.env' });

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
  appBaseUrl: process.env.APP_BASE_URL || 'http://localhost:3000',
  apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:4000',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',

  // Email
  emailProvider: process.env.EMAIL_PROVIDER || 'console',
  emailFrom: process.env.EMAIL_FROM || 'noreply@workspace.app',

  // Tokens
  emailVerificationExpiry: 24 * 60 * 60 * 1000, // 24 hours
  passwordResetExpiry: 60 * 60 * 1000,           // 1 hour
  resendCooldown: 60 * 1000,                      // 1 minute

  // CORS
  corsOrigin: process.env.FRONTEND_URL || 'http://localhost:3000',
} as const;
