import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';
import { hashToken } from '../lib/tokens';

const router = Router();
router.use(authMiddleware);

/**
 * POST /api/developer/tokens
 * Generate a new high-entropy Developer API token for CLI / VS Code
 */
router.post('/tokens', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { name = 'Developer CLI Token', workspaceId, expiresInDays = 90 } = req.body;

    // Verify workspace membership
    const targetWorkspaceId = workspaceId || req.workspaceId;
    if (!targetWorkspaceId) {
      const firstMembership = await prisma.workspaceMember.findFirst({
        where: { userId },
        select: { workspaceId: true },
      });
      if (!firstMembership) {
        res.status(400).json({ success: false, error: { code: 'NO_WORKSPACE', message: 'No workspace found for user' } });
        return;
      }
    }

    const effectiveWorkspaceId = targetWorkspaceId || (await prisma.workspaceMember.findFirst({
      where: { userId },
      select: { workspaceId: true },
    }))?.workspaceId;

    if (!effectiveWorkspaceId) {
      res.status(400).json({ success: false, error: { code: 'NO_WORKSPACE', message: 'Workspace is required' } });
      return;
    }

    // Generate token: "atlas_dev_" + 32 random hex bytes (64 chars)
    const rawToken = `atlas_dev_${crypto.randomBytes(32).toString('hex')}`;
    const tokenHash = hashToken(rawToken);

    const expiresAt = expiresInDays > 0 ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000) : null;

    const tokenRecord = await prisma.developerToken.create({
      data: {
        userId,
        workspaceId: effectiveWorkspaceId,
        name: name.trim() || 'Developer CLI Token',
        tokenHash,
        expiresAt,
      },
      select: {
        id: true,
        name: true,
        workspaceId: true,
        expiresAt: true,
        createdAt: true,
      },
    });

    res.status(201).json({
      success: true,
      data: {
        token: rawToken, // Returned strictly once upon creation
        tokenRecord,
        instructions: 'Store this token safely. You can connect from your terminal using: atlas login --token ' + rawToken,
      },
    });
  } catch (error) {
    console.error('Error generating developer token:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to generate token' } });
  }
});

/**
 * GET /api/developer/tokens
 * List active developer tokens for the current user
 */
router.get('/tokens', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const tokens = await prisma.developerToken.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        workspaceId: true,
        workspace: { select: { name: true, slug: true } },
        lastUsedAt: true,
        expiresAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      data: { tokens },
    });
  } catch (error) {
    console.error('Error listing developer tokens:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to list tokens' } });
  }
});

/**
 * DELETE /api/developer/tokens/:id
 * Revoke a developer token
 */
router.delete('/tokens/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const tokenId = req.params.id as string;

    const token = await prisma.developerToken.findFirst({
      where: { id: tokenId, userId },
    });

    if (!token) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Token not found' } });
      return;
    }

    await prisma.developerToken.delete({ where: { id: tokenId } });

    res.json({
      success: true,
      data: { message: 'Developer token revoked successfully' },
    });
  } catch (error) {
    console.error('Error revoking developer token:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to revoke token' } });
  }
});

/**
 * GET /api/developer/me
 * Identity and workspace telemetry for Developer CLI & VS Code Extension
 */
router.get('/me', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        displayName: true,
        avatarUrl: true,
      },
    });

    if (!user) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
      return;
    }

    const memberships = await prisma.workspaceMember.findMany({
      where: { userId },
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
      orderBy: { joinedAt: 'asc' },
    });

    const activeWorkspaceId = req.workspaceId || memberships[0]?.workspaceId;

    // Assigned active tasks count
    const assignedTasksCount = await prisma.task.count({
      where: {
        assigneeId: userId,
        status: { in: ['TODO', 'IN_PROGRESS', 'IN_REVIEW'] },
        isArchived: false,
      },
    });

    // Currently claimed tasks count
    const claimedTasksCount = await prisma.task.count({
      where: {
        claimedById: userId,
        status: { notIn: ['DONE', 'CANCELLED'] },
        isArchived: false,
      },
    });

    res.json({
      success: true,
      data: {
        user,
        activeWorkspaceId,
        workspaces: memberships.map((m) => ({
          id: m.workspace.id,
          name: m.workspace.name,
          slug: m.workspace.slug,
          role: m.role,
        })),
        telemetry: {
          assignedTasksCount,
          claimedTasksCount,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching developer identity:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch identity' } });
  }
});

export default router;
