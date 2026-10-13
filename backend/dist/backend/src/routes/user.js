"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const password_1 = require("../lib/password");
const tokens_1 = require("../lib/tokens");
const auth_1 = require("../middleware/auth");
const validate_1 = require("../middleware/validate");
const shared_import_1 = require("../../shared-import");
const router = (0, express_1.Router)();
// All user routes require authentication
router.use(auth_1.authMiddleware);
// ─── PUT /api/user/profile ───────────────────────────────────────────────────
router.put('/profile', (0, validate_1.validate)(shared_import_1.updateProfileSchema), async (req, res) => {
    try {
        const { displayName, avatarUrl } = req.body;
        const updateData = {};
        if (displayName !== undefined)
            updateData.displayName = displayName;
        if (avatarUrl !== undefined)
            updateData.avatarUrl = avatarUrl;
        const user = await prisma_1.prisma.user.update({
            where: { id: req.userId },
            data: updateData,
        });
        res.json({
            success: true,
            data: {
                user: {
                    id: user.id,
                    email: user.email,
                    displayName: user.displayName,
                    emailVerified: user.emailVerified,
                    onboardingComplete: user.onboardingComplete,
                    avatarUrl: user.avatarUrl,
                    createdAt: user.createdAt.toISOString(),
                },
            },
        });
    }
    catch (error) {
        console.error('Profile update error:', error);
        res.status(500).json({
            success: false,
            error: { code: 'INTERNAL_ERROR', message: 'An internal error occurred' },
        });
    }
});
// ─── POST /api/user/change-password ──────────────────────────────────────────
router.post('/change-password', (0, validate_1.validate)(shared_import_1.changePasswordSchema), async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const user = await prisma_1.prisma.user.findUnique({
            where: { id: req.userId },
        });
        if (!user) {
            res.status(404).json({
                success: false,
                error: { code: 'USER_NOT_FOUND', message: 'User not found' },
            });
            return;
        }
        const valid = await (0, password_1.verifyPassword)(user.passwordHash, currentPassword);
        if (!valid) {
            res.status(400).json({
                success: false,
                error: { code: 'INVALID_PASSWORD', message: 'Current password is incorrect' },
            });
            return;
        }
        const passwordHash = await (0, password_1.hashPassword)(newPassword);
        // Update password and revoke all other sessions
        await prisma_1.prisma.$transaction([
            prisma_1.prisma.user.update({
                where: { id: user.id },
                data: { passwordHash },
            }),
            prisma_1.prisma.session.deleteMany({
                where: {
                    userId: user.id,
                    id: { not: req.sessionId },
                },
            }),
        ]);
        res.json({
            success: true,
            data: { message: 'Password changed successfully' },
        });
    }
    catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({
            success: false,
            error: { code: 'INTERNAL_ERROR', message: 'An internal error occurred' },
        });
    }
});
// ─── GET /api/user/sessions ──────────────────────────────────────────────────
router.get('/sessions', async (req, res) => {
    try {
        const sessions = await prisma_1.prisma.session.findMany({
            where: {
                userId: req.userId,
                expiresAt: { gte: new Date() },
            },
            orderBy: { lastActivityAt: 'desc' },
            select: {
                id: true,
                createdAt: true,
                lastActivityAt: true,
                ipAddress: true,
                userAgent: true,
            },
        });
        const currentTokenHash = req.cookies?.[auth_1.SESSION_COOKIE_NAME]
            ? (0, tokens_1.hashToken)(req.cookies[auth_1.SESSION_COOKIE_NAME])
            : null;
        // Determine current session
        let currentSessionId = null;
        if (currentTokenHash) {
            const currentSession = await prisma_1.prisma.session.findUnique({
                where: { tokenHash: currentTokenHash },
                select: { id: true },
            });
            currentSessionId = currentSession?.id || null;
        }
        res.json({
            success: true,
            data: {
                sessions: sessions.map((s) => ({
                    id: s.id,
                    createdAt: s.createdAt.toISOString(),
                    lastActivityAt: s.lastActivityAt.toISOString(),
                    ipAddress: s.ipAddress,
                    userAgent: s.userAgent,
                    isCurrent: s.id === currentSessionId,
                })),
            },
        });
    }
    catch (error) {
        console.error('List sessions error:', error);
        res.status(500).json({
            success: false,
            error: { code: 'INTERNAL_ERROR', message: 'An internal error occurred' },
        });
    }
});
// ─── DELETE /api/user/sessions/:id ───────────────────────────────────────────
router.delete('/sessions/:id', async (req, res) => {
    try {
        const id = req.params.id;
        // Verify the session belongs to the user
        const session = await prisma_1.prisma.session.findFirst({
            where: { id, userId: req.userId },
        });
        if (!session) {
            res.status(404).json({
                success: false,
                error: { code: 'SESSION_NOT_FOUND', message: 'Session not found' },
            });
            return;
        }
        // Check if trying to revoke current session
        if (id === req.sessionId) {
            res.status(400).json({
                success: false,
                error: { code: 'CANNOT_REVOKE_CURRENT', message: 'Use logout to end your current session' },
            });
            return;
        }
        await prisma_1.prisma.session.delete({ where: { id } });
        res.json({
            success: true,
            data: { message: 'Session revoked' },
        });
    }
    catch (error) {
        console.error('Revoke session error:', error);
        res.status(500).json({
            success: false,
            error: { code: 'INTERNAL_ERROR', message: 'An internal error occurred' },
        });
    }
});
// ─── POST /api/user/sessions/revoke-others ───────────────────────────────────
router.post('/sessions/revoke-others', async (req, res) => {
    try {
        const result = await prisma_1.prisma.session.deleteMany({
            where: {
                userId: req.userId,
                id: { not: req.sessionId },
            },
        });
        res.json({
            success: true,
            data: { message: `Revoked ${result.count} session(s)`, count: result.count },
        });
    }
    catch (error) {
        console.error('Revoke all sessions error:', error);
        res.status(500).json({
            success: false,
            error: { code: 'INTERNAL_ERROR', message: 'An internal error occurred' },
        });
    }
});
// ─── POST /api/user/onboarding ───────────────────────────────────────────────
router.post('/onboarding', async (req, res) => {
    try {
        const { displayName, workspaceName } = req.body;
        const user = await prisma_1.prisma.user.findUnique({ where: { id: req.userId } });
        if (!user) {
            res.status(404).json({
                success: false,
                error: { code: 'USER_NOT_FOUND', message: 'User not found' },
            });
            return;
        }
        if (user.onboardingComplete) {
            res.status(400).json({
                success: false,
                error: { code: 'ALREADY_ONBOARDED', message: 'Onboarding already completed' },
            });
            return;
        }
        // Create workspace and mark onboarding complete atomically
        const wsName = workspaceName || `${displayName}'s Workspace`;
        const slug = wsName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + Date.now().toString(36);
        await prisma_1.prisma.$transaction(async (tx) => {
            await tx.user.update({
                where: { id: user.id },
                data: {
                    displayName,
                    onboardingComplete: true,
                },
            });
            const workspace = await tx.workspace.create({
                data: {
                    name: wsName,
                    slug,
                },
            });
            await tx.workspaceMember.create({
                data: {
                    workspaceId: workspace.id,
                    userId: user.id,
                    role: 'OWNER',
                },
            });
        });
        const updatedUser = await prisma_1.prisma.user.findUnique({ where: { id: user.id } });
        res.json({
            success: true,
            data: {
                user: updatedUser ? {
                    id: updatedUser.id,
                    email: updatedUser.email,
                    displayName: updatedUser.displayName,
                    emailVerified: updatedUser.emailVerified,
                    onboardingComplete: updatedUser.onboardingComplete,
                    avatarUrl: updatedUser.avatarUrl,
                    createdAt: updatedUser.createdAt.toISOString(),
                } : null,
            },
        });
    }
    catch (error) {
        console.error('Onboarding error:', error);
        res.status(500).json({
            success: false,
            error: { code: 'INTERNAL_ERROR', message: 'An internal error occurred' },
        });
    }
});
exports.default = router;
//# sourceMappingURL=user.js.map