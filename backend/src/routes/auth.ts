import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { hashPassword, verifyPassword } from '../lib/password';
import { generateToken, generateSessionToken, hashToken } from '../lib/tokens';
import { getEmailProvider, buildVerificationEmail, buildPasswordResetEmail } from '../lib/email';
import { normalizeEmail, areEmailsMatching } from '../lib/email-identity';
import { setSessionCookie, clearSessionCookie, authMiddleware } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { config } from '../config';
import crypto from 'crypto';
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  verifyResetOtpSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from '../../shared-import';

const router = Router();

function getFrontendBaseUrl(req: Request): string {
  const origin = req.headers.origin;
  if (origin && typeof origin === 'string') {
    return origin.replace(/\/+$/, '');
  }
  const referer = req.headers.referer;
  if (referer && typeof referer === 'string') {
    try {
      const url = new URL(referer);
      return url.origin;
    } catch {}
  }
  return config.frontendUrl;
}

// ─── Helper: safe user serialization ─────────────────────────────────────────

function serializeUser(user: {
  id: string;
  email: string;
  displayName: string;
  emailVerified: boolean;
  onboardingComplete: boolean;
  avatarUrl: string | null;
  createdAt: Date;
  emailNormalized?: string | null;
}) {
  return {
    id: user.id,
    email: user.email,
    emailNormalized: user.emailNormalized || normalizeEmail(user.email),
    displayName: user.displayName,
    emailVerified: user.emailVerified,
    onboardingComplete: user.onboardingComplete,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt.toISOString(),
  };
}

// ─── POST /api/auth/register ─────────────────────────────────────────────────

router.post('/register', validate(registerSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, displayName } = req.body;
    const emailNormalized = normalizeEmail(email);

    // Check for existing user
    const existing = await prisma.user.findUnique({
      where: { emailNormalized },
    });

    if (existing) {
      // Generic message to prevent account enumeration
      res.status(409).json({
        success: false,
        error: {
          code: 'EMAIL_EXISTS',
          message: 'An account with this email address already exists',
        },
      });
      return;
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user
    const user = await prisma.user.create({
      data: {
        email: emailNormalized,
        emailNormalized,
        displayName,
        passwordHash,
      },
    });

    // Generate verification token
    const { raw: verifyToken, hash: verifyHash } = generateToken();
    await prisma.emailVerificationToken.create({
      data: {
        userId: user.id,
        tokenHash: verifyHash,
        expiresAt: new Date(Date.now() + config.emailVerificationExpiry),
      },
    });

    // Send verification email
    const frontendBase = getFrontendBaseUrl(req);
    const verifyUrl = `${frontendBase}/verify-email?token=${verifyToken}`;
    const emailContent = buildVerificationEmail(verifyUrl);
    try {
      await getEmailProvider().send({ ...emailContent, to: user.email });
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError);
      // Don't fail registration if email fails
    }

    // Create session
    const { raw: sessionToken, hash: sessionHash } = generateSessionToken();
    await prisma.session.create({
      data: {
        userId: user.id,
        tokenHash: sessionHash,
        expiresAt: new Date(Date.now() + config.sessionMaxAge),
        ipAddress: req.ip || null,
        userAgent: req.headers['user-agent']?.substring(0, 512) || null,
      },
    });

    setSessionCookie(res, sessionToken);

    res.status(201).json({
      success: true,
      data: { user: serializeUser(user), token: sessionToken },
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'An internal error occurred' },
    });
  }
});

// ─── POST /api/auth/login ────────────────────────────────────────────────────

router.post('/login', validate(loginSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;
    const emailNormalized = normalizeEmail(email);

    let user = await prisma.user.findUnique({
      where: { emailNormalized },
    });

    // Fallback: check matching identity across institutional/alias variants
    if (!user) {
      const candidates = await prisma.user.findMany({
        select: { id: true, email: true, emailNormalized: true, passwordHash: true, displayName: true, emailVerified: true, onboardingComplete: true, avatarUrl: true, createdAt: true, accountStatus: true },
        take: 20,
      });
      user = candidates.find((c) => areEmailsMatching(c.email, email) || areEmailsMatching(c.emailNormalized, email)) as any || null;
    }

    if (!user) {
      // Generic error to prevent enumeration
      res.status(401).json({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
      });
      return;
    }

    if (user.accountStatus !== 'ACTIVE') {
      res.status(403).json({
        success: false,
        error: { code: 'ACCOUNT_SUSPENDED', message: 'This account is not active' },
      });
      return;
    }

    const valid = await verifyPassword(user.passwordHash, password);
    if (!valid) {
      res.status(401).json({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
      });
      return;
    }

    // Create session
    const { raw: sessionToken, hash: sessionHash } = generateSessionToken();
    await prisma.session.create({
      data: {
        userId: user.id,
        tokenHash: sessionHash,
        expiresAt: new Date(Date.now() + config.sessionMaxAge),
        ipAddress: req.ip || null,
        userAgent: req.headers['user-agent']?.substring(0, 512) || null,
      },
    });

    setSessionCookie(res, sessionToken);

    res.json({
      success: true,
      data: { user: serializeUser(user), token: sessionToken },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'An internal error occurred' },
    });
  }
});

// ─── POST /api/auth/demo-login ───────────────────────────────────────────────

router.post('/demo-login', async (req: Request, res: Response): Promise<void> => {
  try {
    const role = (req.body?.role || 'owner').toString().toLowerCase();
    const isCollab = role === 'collaborator' || role === 'member';

    const demoEmail = isCollab
      ? 'collaborator.demo@kronos.io'
      : 'architect.demo@kronos.io';
    const displayName = isCollab
      ? 'Alex Rivera (Collaborator)'
      : 'Cheralathan (Principal Architect)';

    const emailNormalized = normalizeEmail(demoEmail);

    let user = await prisma.user.findUnique({
      where: { emailNormalized },
    });

    if (!user) {
      const defaultPasswordHash = await hashPassword('Krono$MasterDemo2026!');
      user = await prisma.user.create({
        data: {
          email: demoEmail,
          emailNormalized,
          displayName,
          passwordHash: defaultPasswordHash,
          emailVerified: true,
          onboardingComplete: true,
          accountStatus: 'ACTIVE',
        },
      });

      const workspace = await prisma.workspace.create({
        data: {
          name: `${displayName}'s Workspace`,
          slug: `workspace-${Date.now().toString(36)}`,
          description: 'Primary sovereign engineering workspace',
        },
      });

      await prisma.workspaceMember.create({
        data: {
          workspaceId: workspace.id,
          userId: user.id,
          role: 'OWNER',
        },
      });

      const project = await prisma.project.create({
        data: {
          workspaceId: workspace.id,
          creatorId: user.id,
          name: 'Atlas Sovereign Monolith',
          slug: 'atlas-sovereign-monolith',
          description: 'Production monolithic engineering platform with real-time sync and sovereign security.',
          status: 'ACTIVE',
          health: 'ON_TRACK',
          progress: 92,
        },
      });

      await prisma.task.create({
        data: {
          workspaceId: workspace.id,
          creatorId: user.id,
          assigneeId: user.id,
          projectId: project.id,
          title: 'Verify monolithic end-to-end full-stack integration',
          description: 'Automated verification across Auth, Projects, Tasks, Docs, Git, CLI, and Collab.',
          status: 'DONE',
          priority: 'URGENT',
        },
      });

      await prisma.task.create({
        data: {
          workspaceId: workspace.id,
          creatorId: user.id,
          assigneeId: user.id,
          projectId: project.id,
          title: 'Deploy zero-trust cryptographic session validator',
          description: 'Argon2id hashing with quantum-resistant key derivation parameters.',
          status: 'IN_PROGRESS',
          priority: 'HIGH',
        },
      });

      await prisma.document.create({
        data: {
          workspaceId: workspace.id,
          creatorId: user.id,
          title: 'Atlas Architectural Specification & Operational Guide',
          content: '# Project Atlas — Unified Sovereign Monolith\n\nProduction Next.js + Express + PostgreSQL architecture.\n\n### Core Invariants\n- **Zero Mock Data**: 100% real database transactions.\n- **OCC Versioning**: Optimistic concurrency on every mutation.\n- **Full Multi-User Scoping**: Scoped strictly by workspace context.',
          status: 'PUBLISHED',
        },
      });
    }

    const { raw: sessionToken, hash: sessionHash } = generateSessionToken();
    await prisma.session.create({
      data: {
        userId: user.id,
        tokenHash: sessionHash,
        expiresAt: new Date(Date.now() + config.sessionMaxAge),
        ipAddress: req.ip || null,
        userAgent: req.headers['user-agent']?.substring(0, 512) || null,
      },
    });

    setSessionCookie(res, sessionToken);

    res.json({
      success: true,
      data: { user: serializeUser(user), token: sessionToken },
    });
  } catch (error) {
    console.error('Demo login error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to initiate demo operator session' },
    });
  }
});

// ─── POST /api/auth/logout ───────────────────────────────────────────────────

router.post('/logout', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    if (req.sessionId) {
      await prisma.session.delete({ where: { id: req.sessionId } }).catch(() => {});
    }
    clearSessionCookie(res);
    res.json({ success: true });
  } catch (error) {
    console.error('Logout error:', error);
    clearSessionCookie(res);
    res.json({ success: true });
  }
});

// ─── GET /api/auth/me ────────────────────────────────────────────────────────

router.get('/me', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
    });

    if (!user) {
      res.status(404).json({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'User not found' },
      });
      return;
    }

    res.json({
      success: true,
      data: { user: serializeUser(user) },
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'An internal error occurred' },
    });
  }
});

// ─── POST /api/auth/verify-email ─────────────────────────────────────────────

router.post('/verify-email', validate(verifyEmailSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.body;
    const tokenHash = hashToken(token);

    const verificationToken = await prisma.emailVerificationToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!verificationToken) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_TOKEN', message: 'Invalid or expired verification link' },
      });
      return;
    }

    if (verificationToken.usedAt) {
      res.status(400).json({
        success: false,
        error: { code: 'TOKEN_USED', message: 'This verification link has already been used' },
      });
      return;
    }

    if (verificationToken.expiresAt < new Date()) {
      res.status(400).json({
        success: false,
        error: { code: 'TOKEN_EXPIRED', message: 'This verification link has expired' },
      });
      return;
    }

    // Mark verified atomically
    await prisma.$transaction([
      prisma.user.update({
        where: { id: verificationToken.userId },
        data: { emailVerified: true },
      }),
      prisma.emailVerificationToken.update({
        where: { id: verificationToken.id },
        data: { usedAt: new Date() },
      }),
    ]);

    res.json({
      success: true,
      data: { message: 'Email verified successfully' },
    });
  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'An internal error occurred' },
    });
  }
});

// ─── POST /api/auth/resend-verification ──────────────────────────────────────

router.post('/resend-verification', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
    });

    if (!user) {
      res.json({ success: true, data: { message: 'If an account exists, a verification email will be sent' } });
      return;
    }

    if (user.emailVerified) {
      res.status(400).json({
        success: false,
        error: { code: 'ALREADY_VERIFIED', message: 'Email is already verified' },
      });
      return;
    }

    // Check cooldown
    const recentToken = await prisma.emailVerificationToken.findFirst({
      where: {
        userId: user.id,
        createdAt: { gte: new Date(Date.now() - config.resendCooldown) },
      },
    });

    if (recentToken) {
      res.status(429).json({
        success: false,
        error: { code: 'RATE_LIMITED', message: 'Please wait before requesting another verification email' },
      });
      return;
    }

    // Generate new token
    const { raw: verifyToken, hash: verifyHash } = generateToken();
    await prisma.emailVerificationToken.create({
      data: {
        userId: user.id,
        tokenHash: verifyHash,
        expiresAt: new Date(Date.now() + config.emailVerificationExpiry),
      },
    });

    const frontendBase = getFrontendBaseUrl(req);
    const verifyUrl = `${frontendBase}/verify-email?token=${verifyToken}`;
    const emailContent = buildVerificationEmail(verifyUrl);
    await getEmailProvider().send({ ...emailContent, to: user.email });

    res.json({
      success: true,
      data: { message: 'Verification email sent' },
    });
  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'An internal error occurred' },
    });
  }
});

// ─── POST /api/auth/forgot-password ──────────────────────────────────────────

router.post('/forgot-password', validate(forgotPasswordSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;
    const emailNormalized = email.toLowerCase().trim();

    // Generic response to avoid account enumeration
    const genericResponse = {
      success: true,
      data: { message: 'If an account with that email exists, a password reset code has been sent.' },
    };

    const user = await prisma.user.findUnique({
      where: { emailNormalized },
    });

    if (!user) {
      res.json(genericResponse);
      return;
    }

    // Check cooldown
    const recentToken = await prisma.passwordResetToken.findFirst({
      where: {
        userId: user.id,
        createdAt: { gte: new Date(Date.now() - config.resendCooldown) },
      },
    });

    if (recentToken) {
      res.json(genericResponse);
      return;
    }

    // Generate 6-digit OTP and recovery token
    const otp = crypto.randomInt(100000, 999999).toString();
    const otpHash = hashToken(otp);
    const { raw: resetToken, hash: resetHash } = generateToken();

    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: resetHash,
        otpHash,
        attempts: 0,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15-minute OTP lifetime
      },
    });

    const frontendBase = getFrontendBaseUrl(req);
    const resetUrl = `${frontendBase}/reset-password?token=${resetToken}`;
    const emailContent = buildPasswordResetEmail(resetUrl, otp);
    try {
      await getEmailProvider().send({ ...emailContent, to: user.email });
    } catch (emailError) {
      console.error('Failed to send reset email:', emailError);
    }

    res.json(genericResponse);
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'An internal error occurred' },
    });
  }
});

// ─── POST /api/auth/verify-reset-otp ─────────────────────────────────────────

router.post('/verify-reset-otp', validate(verifyResetOtpSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, otp } = req.body;
    const emailNormalized = email.toLowerCase().trim();

    const user = await prisma.user.findUnique({
      where: { emailNormalized },
    });

    if (!user) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_OTP', message: 'Invalid or expired verification code' },
      });
      return;
    }

    const resetToken = await prisma.passwordResetToken.findFirst({
      where: {
        userId: user.id,
        usedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!resetToken || !resetToken.otpHash) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_OTP', message: 'No active password recovery request found' },
      });
      return;
    }

    if (resetToken.expiresAt < new Date()) {
      res.status(400).json({
        success: false,
        error: { code: 'OTP_EXPIRED', message: 'Verification code has expired. Please request a new code.' },
      });
      return;
    }

    if (resetToken.attempts >= 5) {
      res.status(429).json({
        success: false,
        error: { code: 'MAX_ATTEMPTS_EXCEEDED', message: 'Maximum verification attempts exceeded. Please request a new code.' },
      });
      return;
    }

    const inputOtpHash = hashToken(otp.trim());
    if (resetToken.otpHash !== inputOtpHash) {
      const newAttempts = resetToken.attempts + 1;
      await prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { attempts: newAttempts },
      });

      const remaining = Math.max(0, 5 - newAttempts);
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_OTP',
          message: `Incorrect verification code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`,
        },
      });
      return;
    }

    // Success! Generate single-use reset authorization token
    const { raw: resetAuthToken, hash: resetAuthHash } = generateToken();
    await prisma.passwordResetToken.update({
      where: { id: resetToken.id },
      data: {
        resetAuthHash,
      },
    });

    res.json({
      success: true,
      data: {
        resetAuthToken,
        message: 'Verification code confirmed. You may now reset your password.',
      },
    });
  } catch (error) {
    console.error('Verify reset OTP error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'An internal error occurred' },
    });
  }
});

// ─── POST /api/auth/reset-password ───────────────────────────────────────────

router.post('/reset-password', validate(resetPasswordSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const { token, password } = req.body;
    const tokenHash = hashToken(token);

    const resetToken = await prisma.passwordResetToken.findFirst({
      where: {
        OR: [
          { tokenHash },
          { resetAuthHash: tokenHash },
        ],
      },
      include: { user: true },
    });

    if (!resetToken) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_TOKEN', message: 'Invalid or expired reset authorization' },
      });
      return;
    }

    if (resetToken.usedAt) {
      res.status(400).json({
        success: false,
        error: { code: 'TOKEN_USED', message: 'This reset authorization has already been used' },
      });
      return;
    }

    if (resetToken.expiresAt < new Date()) {
      res.status(400).json({
        success: false,
        error: { code: 'TOKEN_EXPIRED', message: 'This reset authorization has expired' },
      });
      return;
    }

    const passwordHash = await hashPassword(password);

    // Reset password and invalidate all sessions atomically
    await prisma.$transaction([
      prisma.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash },
      }),
      prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      }),
      prisma.session.deleteMany({
        where: { userId: resetToken.userId },
      }),
    ]);

    res.json({
      success: true,
      data: { message: 'Password reset successfully. Please sign in with your new credentials.' },
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'An internal error occurred' },
    });
  }
});

export default router;
