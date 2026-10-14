import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

import { getEmailProvider, resetEmailProvider } from '../src/lib/email';

async function run() {
  console.log('\n' + '═'.repeat(60));
  console.log('📬 KRONOS WORKSPACE — EMAIL CONFIGURATION TEST');
  console.log('═'.repeat(60));

  const provider = (process.env.EMAIL_PROVIDER || 'console').toLowerCase().trim();
  const smtpUser = process.env.SMTP_USER || '';
  const smtpPass = process.env.SMTP_PASS || '';
  const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
  const smtpPort = process.env.SMTP_PORT || '465';

  console.log(`• Configured Provider: ${provider}`);
  console.log(`• SMTP Host:          ${smtpHost}:${smtpPort}`);
  console.log(`• SMTP User:          ${smtpUser || '(not set)'}`);
  console.log(`• SMTP Password:      ${smtpPass ? '******** (configured)' : '(NOT SET - App Password required)'}`);
  console.log(`• Sender From:        ${process.env.EMAIL_FROM || smtpUser || 'noreply@workspace.app'}`);
  console.log('─'.repeat(60));

  if (!smtpPass && (provider === 'smtp' || provider === 'gmail')) {
    console.log('⚠️  WARNING: SMTP_PASS is currently empty in your .env file!');
    console.log('💡 For Gmail:');
    console.log('   1. Visit: https://myaccount.google.com/apppasswords');
    console.log('   2. Ensure 2-Step Verification is enabled on your Google account.');
    console.log('   3. Generate an App Password for "Mail".');
    console.log('   4. Paste the 16-character code into SMTP_PASS in your .env file.\n');
  }

  resetEmailProvider();
  const emailService = getEmailProvider();

  const recipient = smtpUser || 'cheralathannandha9098@gmail.com';
  console.log(`🚀 Attempting test dispatch to: ${recipient}...`);

  try {
    await emailService.send({
      to: recipient,
      subject: '✅ [KRONOS Workspace] SMTP Email Verification Test',
      html: `
        <div style="font-family: sans-serif; background: #0a0a0a; color: #f5f5f5; padding: 32px; border-radius: 8px;">
          <h2 style="color: #4caf50; margin-top: 0;">Email System Operational</h2>
          <p>Your KRONOS Workspace email integration is now connected and operational.</p>
          <div style="background: #181818; padding: 16px; border: 1px solid #333; margin: 20px 0; font-family: monospace;">
            <strong>Provider:</strong> ${provider}<br/>
            <strong>User:</strong> ${smtpUser}<br/>
            <strong>Dispatched At:</strong> ${new Date().toISOString()}
          </div>
          <p style="color: #999; font-size: 12px;">This test was initiated via the KRONOS email verification diagnostic.</p>
        </div>
      `,
      text: `Your KRONOS Workspace email integration is operational.\n\nProvider: ${provider}\nUser: ${smtpUser}\nTime: ${new Date().toISOString()}`,
    });

    console.log('✅ TEST COMPLETED SUCCESSFULLY! Email delivered to inbox/console.\n');
  } catch (err: any) {
    console.error('❌ EMAIL DISPATCH FAILED:', err.message || err);
    if (err.code === 'EAUTH' || err.responseCode === 535) {
      console.error('\n🔑 AUTHENTICATION ERROR (535):');
      console.error('Google rejected the login. You cannot use your regular account password.');
      console.error('You MUST use a 16-character Google App Password:');
      console.error('1. Go to https://myaccount.google.com/apppasswords');
      console.error('2. Generate a new App Password named "Kronos"');
      console.error('3. Set SMTP_PASS="your-16-char-password" in .env and rerun.\n');
    }
  }
}

run();
