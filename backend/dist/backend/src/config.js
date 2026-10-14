"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
exports.validateEnv = validateEnv;
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
// Load .env files from both project root and backend directory reliably regardless of cwd
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '../../.env'), override: true });
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '../.env'), override: true });
dotenv_1.default.config({ override: true });
const requiredVars = ['DATABASE_URL', 'SESSION_SECRET'];
function validateEnv() {
    const missing = requiredVars.filter((key) => !process.env[key]);
    if (missing.length > 0) {
        console.error('❌ Missing required environment variables:');
        missing.forEach((key) => console.error(`   - ${key}`));
        process.exit(1);
    }
}
exports.config = {
    port: parseInt(process.env.PORT || '4000', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
    isProduction: process.env.NODE_ENV === 'production',
    // Database
    databaseUrl: process.env.DATABASE_URL || '',
    // Session
    sessionSecret: process.env.SESSION_SECRET || 'dev-secret-change-me',
    sessionMaxAge: parseInt(process.env.SESSION_MAX_AGE || String(7 * 24 * 60 * 60 * 1000), 10), // 7 days
    // URLs
    appBaseUrl: process.env.APP_BASE_URL || process.env.APP_URL || 'http://localhost:3000',
    apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:4000',
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
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
    passwordResetExpiry: 60 * 60 * 1000, // 1 hour
    resendCooldown: 60 * 1000, // 1 minute
    // CORS
    corsOrigin: process.env.FRONTEND_URL || 'http://localhost:3000',
};
//# sourceMappingURL=config.js.map