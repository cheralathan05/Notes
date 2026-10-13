"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SESSION_COOKIE_NAME = void 0;
exports.authMiddleware = authMiddleware;
exports.optionalAuthMiddleware = optionalAuthMiddleware;
exports.setSessionCookie = setSessionCookie;
exports.clearSessionCookie = clearSessionCookie;
const prisma_1 = require("../lib/prisma");
const tokens_1 = require("../lib/tokens");
const config_1 = require("../config");
const SESSION_COOKIE_NAME = 'session_token';
exports.SESSION_COOKIE_NAME = SESSION_COOKIE_NAME;
/**
 * Extract session from cookie, validate against DB, attach user to request.
 */
async function authMiddleware(req, res, next) {
    try {
        const rawToken = req.cookies?.[SESSION_COOKIE_NAME];
        if (!rawToken) {
            res.status(401).json({
                success: false,
                error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
            });
            return;
        }
        const tokenHash = (0, tokens_1.hashToken)(rawToken);
        const session = await prisma_1.prisma.session.findUnique({
            where: { tokenHash },
            include: { user: true },
        });
        if (!session || session.expiresAt < new Date()) {
            // Clean up expired session
            if (session) {
                await prisma_1.prisma.session.delete({ where: { id: session.id } }).catch(() => { });
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
            await prisma_1.prisma.session.update({
                where: { id: session.id },
                data: { lastActivityAt: new Date() },
            }).catch(() => { });
        }
        req.userId = session.userId;
        req.sessionId = session.id;
        next();
    }
    catch (error) {
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
async function optionalAuthMiddleware(req, _res, next) {
    try {
        const rawToken = req.cookies?.[SESSION_COOKIE_NAME];
        if (rawToken) {
            const tokenHash = (0, tokens_1.hashToken)(rawToken);
            const session = await prisma_1.prisma.session.findUnique({
                where: { tokenHash },
            });
            if (session && session.expiresAt > new Date()) {
                req.userId = session.userId;
                req.sessionId = session.id;
            }
        }
    }
    catch {
        // Non-blocking
    }
    next();
}
/**
 * Set session cookie on the response.
 */
function setSessionCookie(res, token) {
    res.cookie(SESSION_COOKIE_NAME, token, {
        httpOnly: true,
        secure: config_1.config.isProduction,
        sameSite: config_1.config.isProduction ? 'strict' : 'lax',
        maxAge: config_1.config.sessionMaxAge,
        path: '/',
    });
}
/**
 * Clear session cookie.
 */
function clearSessionCookie(res) {
    res.clearCookie(SESSION_COOKIE_NAME, {
        httpOnly: true,
        secure: config_1.config.isProduction,
        sameSite: config_1.config.isProduction ? 'strict' : 'lax',
        path: '/',
    });
}
//# sourceMappingURL=auth.js.map