import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { hashToken } from '../lib/tokens';
import { config } from '../config';

// Extend Express Request with user info
declare global {
  namespace Express {
    interface Request {
      userId?: string;
      sessionId?: string;
    }
  }
}

const SESSION_COOKIE_NAME = 'session_token';

/**
 * Extract session from cookie, validate against DB, attach user to request.
 */
export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const rawToken = req.cookies?.[SESSION_COOKIE_NAME];

    if (!rawToken) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
      return;
    }

    const tokenHash = hashToken(rawToken);

    const session = await prisma.session.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!session || session.expiresAt < new Date()) {
      // Clean up expired session
      if (session) {
        await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
      }
      res.clearCookie(SESSION_COOKIE_NAME);
      res.status(401).json({
        success: false,
        error: { code: 'SESSION_EXPIRED', message: 'Session has expired' },
      });
      return;
    }

    if (session.user.accountStatus !== 'ACTIVE') {
      res.status(403).json({
        success: false,
        error: { code: 'ACCOUNT_SUSPENDED', message: 'Account is not active' },
      });
      return;
    }

    // Update last activity (throttled to every 5 minutes)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    if (session.lastActivityAt < fiveMinutesAgo) {
      await prisma.session.update({
        where: { id: session.id },
        data: { lastActivityAt: new Date() },
      }).catch(() => {});
    }

    req.userId = session.userId;
    req.sessionId = session.id;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'An internal error occurred' },
    });
  }
}

/**
 * Optional auth - attaches user if session exists but doesn't block.
 */
export async function optionalAuthMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const rawToken = req.cookies?.[SESSION_COOKIE_NAME];
    if (rawToken) {
      const tokenHash = hashToken(rawToken);
      const session = await prisma.session.findUnique({
        where: { tokenHash },
      });
      if (session && session.expiresAt > new Date()) {
        req.userId = session.userId;
        req.sessionId = session.id;
      }
    }
  } catch {
    // Non-blocking
  }
  next();
}

/**
 * Set session cookie on the response.
 */
export function setSessionCookie(res: Response, token: string): void {
  res.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: config.isProduction ? 'strict' : 'lax',
    maxAge: config.sessionMaxAge,
    path: '/',
  });
}

/**
 * Clear session cookie.
 */
export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: config.isProduction ? 'strict' : 'lax',
    path: '/',
  });
}

export { SESSION_COOKIE_NAME };
