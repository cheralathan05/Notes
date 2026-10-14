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
      workspaceId?: string;
    }
  }
}

const SESSION_COOKIE_NAME = 'session_token';

/**
 * Extract session or developer token, validate against DB, attach user to request.
 */
export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const rawToken =
      req.cookies?.[SESSION_COOKIE_NAME] ||
      (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null) ||
      (typeof req.headers['x-atlas-token'] === 'string' ? req.headers['x-atlas-token'] : null) ||
      (typeof req.query?.token === 'string' ? req.query.token : null);

    if (!rawToken) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
      return;
    }

    const tokenHash = hashToken(rawToken);

    // 1. Check standard user session
    const session = await prisma.session.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (session) {
      if (session.expiresAt < new Date()) {
        await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
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
      return;
    }

    // 2. Check developer API token (for Developer CLI and VS Code Extension)
    const devToken = await prisma.developerToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (devToken) {
      if (devToken.expiresAt && devToken.expiresAt < new Date()) {
        res.status(401).json({
          success: false,
          error: { code: 'TOKEN_EXPIRED', message: 'Developer API token has expired' },
        });
        return;
      }

      if (devToken.user.accountStatus !== 'ACTIVE') {
        res.status(403).json({
          success: false,
          error: { code: 'ACCOUNT_SUSPENDED', message: 'Account is not active' },
        });
        return;
      }

      // Update lastUsedAt asynchronously
      prisma.developerToken.update({
        where: { id: devToken.id },
        data: { lastUsedAt: new Date() },
      }).catch(() => {});

      req.userId = devToken.userId;
      req.workspaceId = devToken.workspaceId;
      req.sessionId = `dev_${devToken.id}`;
      next();
      return;
    }

    res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Invalid authentication credentials' },
    });
    return;
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
  const sameSite = config.isProduction
    ? ((process.env.COOKIE_SAME_SITE as 'none' | 'lax' | 'strict') || 'none')
    : 'lax';
  res.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: config.isProduction,
    sameSite,
    maxAge: config.sessionMaxAge,
    path: '/',
  });
}

/**
 * Clear session cookie.
 */
export function clearSessionCookie(res: Response): void {
  const sameSite = config.isProduction
    ? ((process.env.COOKIE_SAME_SITE as 'none' | 'lax' | 'strict') || 'none')
    : 'lax';
  res.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    secure: config.isProduction,
    sameSite,
    path: '/',
  });
}

export { SESSION_COOKIE_NAME };
