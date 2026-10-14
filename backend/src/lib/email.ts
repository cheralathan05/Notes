import nodemailer from 'nodemailer';

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface EmailProvider {
  send(message: EmailMessage): Promise<void>;
}

// ─── Console Email Provider (Development) ────────────────────────────────────

class ConsoleEmailProvider implements EmailProvider {
  async send(message: EmailMessage): Promise<void> {
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

// ─── SMTP / Gmail Email Provider ─────────────────────────────────────────────

export class SmtpEmailProvider implements EmailProvider {
  private transporter: nodemailer.Transporter;
  private from: string;
  private serviceType: string;

  constructor() {
    const rawFrom = process.env.EMAIL_FROM || process.env.SMTP_USER || 'noreply@workspace.app';
    const fromName = process.env.EMAIL_FROM_NAME || 'KRONOS Workspace';

    // Format from field cleanly
    if (rawFrom.includes('<') && rawFrom.includes('>')) {
      this.from = rawFrom;
    } else {
      this.from = `"${fromName}" <${rawFrom}>`;
    }

    const host = process.env.SMTP_HOST || 'smtp.gmail.com';
    const port = parseInt(process.env.SMTP_PORT || '465', 10);
    const user = (process.env.SMTP_USER || '').trim();
    const pass = (process.env.SMTP_PASS || '').trim();
    const service = (process.env.SMTP_SERVICE || '').toLowerCase().trim();

    const isGmail =
      service === 'gmail' ||
      host.toLowerCase().includes('gmail') ||
      (!process.env.SMTP_HOST && user.toLowerCase().endsWith('@gmail.com'));

    this.serviceType = isGmail ? 'Gmail' : `SMTP (${host}:${port})`;

    if (isGmail) {
      this.transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: user
          ? {
              user,
              pass,
            }
          : undefined,
      });
    } else {
      const isSecure = process.env.SMTP_SECURE === 'true' || port === 465;
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: isSecure,
        auth: user
          ? {
              user,
              pass,
            }
          : undefined,
        tls: {
          rejectUnauthorized: process.env.NODE_ENV === 'production',
        },
      });
    }
  }

  async verify(): Promise<{ success: boolean; message: string }> {
    try {
      await this.transporter.verify();
      return { success: true, message: `SMTP connection established successfully via ${this.serviceType}` };
    } catch (err: any) {
      const msg = err?.message || 'SMTP handshake failed';
      return { success: false, message: msg };
    }
  }

  async send(message: EmailMessage): Promise<void> {
    try {
      const info = await this.transporter.sendMail({
        from: this.from,
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
      });
      console.log(`📧 [EMAIL DELIVERED] Sent to: ${message.to} | Subject: "${message.subject}" | ID: ${info.messageId}`);
    } catch (err: any) {
      console.error(`❌ [EMAIL DISPATCH ERROR] Failed sending to ${message.to}:`, err.message);
      if (err.code === 'EAUTH' || err.responseCode === 535) {
        console.error('⚠️ SMTP Authentication Failed.');
        console.error('💡 If you are using Gmail: You must generate a 16-character App Password at https://myaccount.google.com/apppasswords');
        console.error('   Ensure 2-Step Verification is enabled, then create an App Password for "Mail" and set SMTP_PASS=xxxx-xxxx-xxxx-xxxx in your .env file.');
      }
      throw err;
    }
  }
}

// ─── Provider Factory ────────────────────────────────────────────────────────

let emailProvider: EmailProvider | null = null;
let cachedConfigKey = '';

export function resetEmailProvider(): void {
  emailProvider = null;
  cachedConfigKey = '';
}

export function getEmailProvider(): EmailProvider {
  const provider = (process.env.EMAIL_PROVIDER || '').toLowerCase().trim();
  const smtpUser = (process.env.SMTP_USER || '').trim();
  const smtpPass = (process.env.SMTP_PASS || '').trim();
  const currentKey = `${provider}:${smtpUser}:${smtpPass}`;

  if (!emailProvider || currentKey !== cachedConfigKey) {
    cachedConfigKey = currentKey;
    const hasSmtpConfig = Boolean(smtpUser || process.env.SMTP_HOST);

    // If explicit smtp/gmail OR if user configured SMTP_USER and didn't force console
    if (provider === 'smtp' || provider === 'gmail' || (hasSmtpConfig && provider !== 'console')) {
      emailProvider = new SmtpEmailProvider();
    } else {
      emailProvider = new ConsoleEmailProvider();
    }
  }
  return emailProvider;
}


// ─── Email Templates ─────────────────────────────────────────────────────────

const APP_NAME = 'KRONOS';

function wrapHtml(content: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #080808; color: #FAFAFA; margin: 0; padding: 0; }
    .container { max-width: 560px; margin: 40px auto; padding: 24px; }
    .card { background: #101010; border: 1px solid #2D2D2D; border-radius: 4px; padding: 36px; }
    .brand { font-size: 13px; font-weight: 700; letter-spacing: 3px; color: #737373; text-transform: uppercase; margin-bottom: 24px; }
    h1 { font-size: 20px; font-weight: 600; letter-spacing: -0.02em; margin: 0 0 16px 0; color: #FAFAFA; }
    p { font-size: 14px; line-height: 1.6; color: #A3A3A3; margin: 0 0 16px 0; }
    .otp-box { margin: 28px 0; text-align: center; }
    .otp-label { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 2px; color: #737373; margin-bottom: 8px; }
    .otp-code { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #FAFAFA; background: #151515; border: 1px solid #2D2D2D; border-radius: 4px; padding: 14px 24px; display: inline-block; }
    .btn { display: inline-block; padding: 12px 24px; background: #F5F5F5; color: #111111; text-decoration: none; border-radius: 4px; font-size: 13px; font-weight: 600; letter-spacing: 0.5px; }
    .footer { margin-top: 32px; padding-top: 20px; border-top: 1px solid #1D1D1D; font-size: 11px; color: #737373; line-height: 1.5; }
    .code { font-family: monospace; background: #151515; padding: 2px 6px; border-radius: 3px; color: #FAFAFA; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="brand">K R O N O S</div>
      ${content}
    </div>
  </div>
</body>
</html>`;
}

export function buildVerificationEmail(verifyUrl: string): Omit<EmailMessage, 'to'> {
  const html = wrapHtml(`
    <h1>Verify your security authorization</h1>
    <p>Welcome to ${APP_NAME}. Please confirm your email address to activate your cryptographically protected account.</p>
    <p style="text-align: center; margin: 28px 0;">
      <a href="${verifyUrl}" class="btn">Verify Account</a>
    </p>
    <p>This verification link expires in 24 hours. If you did not initiate this registration, no further action is required.</p>
    <div class="footer">
      <p>Direct URL: <span class="code">${verifyUrl}</span></p>
    </div>
  `);

  return {
    subject: `[${APP_NAME}] Verify your email authorization`,
    html,
    text: `Verify your authorization for ${APP_NAME}.\n\nDirect Link: ${verifyUrl}\n\nThis verification link expires in 24 hours.`,
  };
}

export function buildPasswordResetEmail(resetUrl: string, otp?: string): Omit<EmailMessage, 'to'> {
  const html = wrapHtml(`
    <h1>Password Recovery Request</h1>
    <p>A request was received to reset your account credentials on ${APP_NAME}.</p>
    ${
      otp
        ? `
      <div class="otp-box">
        <div class="otp-label">Single-Use Verification Code</div>
        <div class="otp-code">${otp}</div>
      </div>
      <p style="text-align: center; font-size: 13px; color: #737373;">Enter this 6-digit code in the verification screen. It expires in 15 minutes.</p>
    `
        : ''
    }
    <p style="text-align: center; margin: 24px 0;">
      <a href="${resetUrl}" class="btn">Reset Password Directly</a>
    </p>
    <p>If you did not request credential recovery, please ensure your account is secure. All active sessions will remain active until you confirm a new password.</p>
    <div class="footer">
      <p>Direct Recovery URL: <span class="code">${resetUrl}</span></p>
    </div>
  `);

  return {
    subject: `[${APP_NAME}] Recovery code: ${otp || 'Password reset'}`,
    html,
    text: `Password recovery for ${APP_NAME}.\n\n` +
      (otp ? `YOUR 6-DIGIT VERIFICATION CODE: ${otp}\n(Expires in 15 minutes)\n\n` : '') +
      `Or click this link: ${resetUrl}\n\nIf you did not request this, ignore this email.`,
  };
}

export function buildDocumentInvitationEmail(
  inviteUrl: string,
  inviterName: string,
  documentTitle: string,
  role: string,
  message?: string
): Omit<EmailMessage, 'to'> {
  const html = wrapHtml(`
    <h1>Collaborator Authorization Invitation</h1>
    <p><strong>${inviterName}</strong> has invited you to collaborate on the sovereign workspace document <strong>${documentTitle}</strong> with <strong>${role}</strong> access.</p>
    ${
      message
        ? `<blockquote style="border-left: 2px solid #555; padding-left: 12px; margin: 16px 0; color: #A3A3A3; font-style: italic;">"${message}"</blockquote>`
        : ''
    }
    <p style="text-align: center; margin: 28px 0;">
      <a href="${inviteUrl}" class="btn">Accept Invitation & Open Document</a>
    </p>
    <p style="font-size: 12px; color: #737373;">This single-use cryptographic invitation link expires in 7 days. If you do not have an active session, you will be prompted to authenticate with this invited email address.</p>
    <div class="footer">
      <p>Direct URL: <span class="code">${inviteUrl}</span></p>
    </div>
  `);

  return {
    subject: `[${APP_NAME}] ${inviterName} invited you to "${documentTitle}" (${role})`,
    html,
    text: `${inviterName} invited you to collaborate on "${documentTitle}" with ${role} access on ${APP_NAME}.\n\nAccept Link: ${inviteUrl}\n\nThis invitation expires in 7 days.`,
  };
}

