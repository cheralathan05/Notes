"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEmailProvider = getEmailProvider;
exports.buildVerificationEmail = buildVerificationEmail;
exports.buildPasswordResetEmail = buildPasswordResetEmail;
const nodemailer_1 = __importDefault(require("nodemailer"));
// ─── Console Email Provider (Development) ────────────────────────────────────
class ConsoleEmailProvider {
    async send(message) {
        console.log('\n' + '═'.repeat(60));
        console.log('📧 EMAIL (Dev Console Transport)');
        console.log('═'.repeat(60));
        console.log(`To:      ${message.to}`);
        console.log(`Subject: ${message.subject}`);
        console.log('─'.repeat(60));
        console.log(message.text || message.html);
        console.log('═'.repeat(60) + '\n');
    }
}
// ─── SMTP Email Provider ─────────────────────────────────────────────────────
class SmtpEmailProvider {
    transporter;
    from;
    constructor() {
        this.from = process.env.EMAIL_FROM || 'noreply@workspace.app';
        this.transporter = nodemailer_1.default.createTransport({
            host: process.env.SMTP_HOST || 'localhost',
            port: parseInt(process.env.SMTP_PORT || '587', 10),
            secure: process.env.SMTP_SECURE === 'true',
            auth: process.env.SMTP_USER ? {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            } : undefined,
        });
    }
    async send(message) {
        await this.transporter.sendMail({
            from: this.from,
            to: message.to,
            subject: message.subject,
            html: message.html,
            text: message.text,
        });
    }
}
// ─── Provider Factory ────────────────────────────────────────────────────────
let emailProvider = null;
function getEmailProvider() {
    if (!emailProvider) {
        const provider = process.env.EMAIL_PROVIDER || 'console';
        switch (provider) {
            case 'smtp':
                emailProvider = new SmtpEmailProvider();
                break;
            case 'console':
            default:
                emailProvider = new ConsoleEmailProvider();
                break;
        }
    }
    return emailProvider;
}
// ─── Email Templates ─────────────────────────────────────────────────────────
const APP_NAME = 'Workspace';
function wrapHtml(content) {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0A0A0A; color: #F5F5F5; margin: 0; padding: 0; }
    .container { max-width: 560px; margin: 40px auto; padding: 40px; }
    .card { background: #151515; border: 1px solid #303030; border-radius: 8px; padding: 32px; }
    h1 { font-size: 20px; font-weight: 600; margin: 0 0 16px 0; color: #F5F5F5; }
    p { font-size: 14px; line-height: 1.6; color: #A3A3A3; margin: 0 0 16px 0; }
    .btn { display: inline-block; padding: 12px 24px; background: #F5F5F5; color: #0A0A0A; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: 500; }
    .footer { margin-top: 24px; font-size: 12px; color: #737373; }
    .code { font-family: monospace; background: #1B1B1B; padding: 2px 8px; border-radius: 4px; color: #F5F5F5; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      ${content}
    </div>
  </div>
</body>
</html>`;
}
function buildVerificationEmail(verifyUrl) {
    const html = wrapHtml(`
    <h1>Verify your email</h1>
    <p>Welcome to ${APP_NAME}! Please verify your email address by clicking the button below.</p>
    <p style="text-align: center; margin: 24px 0;">
      <a href="${verifyUrl}" class="btn">Verify Email</a>
    </p>
    <p>This link expires in 24 hours. If you didn't create an account, you can safely ignore this email.</p>
    <div class="footer">
      <p>If the button doesn't work, copy and paste this URL into your browser:</p>
      <p style="word-break: break-all; color: #737373;">${verifyUrl}</p>
    </div>
  `);
    return {
        subject: `Verify your email — ${APP_NAME}`,
        html,
        text: `Verify your email for ${APP_NAME}.\n\nClick this link to verify: ${verifyUrl}\n\nThis link expires in 24 hours.`,
    };
}
function buildPasswordResetEmail(resetUrl) {
    const html = wrapHtml(`
    <h1>Reset your password</h1>
    <p>We received a request to reset your password. Click the button below to choose a new one.</p>
    <p style="text-align: center; margin: 24px 0;">
      <a href="${resetUrl}" class="btn">Reset Password</a>
    </p>
    <p>This link expires in 1 hour. If you didn't request a password reset, you can safely ignore this email.</p>
    <div class="footer">
      <p>If the button doesn't work, copy and paste this URL into your browser:</p>
      <p style="word-break: break-all; color: #737373;">${resetUrl}</p>
    </div>
  `);
    return {
        subject: `Reset your password — ${APP_NAME}`,
        html,
        text: `Reset your password for ${APP_NAME}.\n\nClick this link to reset: ${resetUrl}\n\nThis link expires in 1 hour.`,
    };
}
//# sourceMappingURL=email.js.map