import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';
import { verifyWorkspaceMembership, getOrCreateUserWorkspace } from '../lib/workspace';
import { GitHubService } from '../lib/github-service';
import { broadcastCollaborationEvent } from '../lib/realtime';
import { logWorkspaceActivity } from '../lib/collaboration-auth';

const router = Router();
router.use(authMiddleware);

// Helper accessor for repository connection model
const repositoryConnectionClient = (prisma as any).repositoryConnection;

/**
 * GET /api/integrations/github/status
 * Check GitHub connection status for the active workspace
 */
router.get('/github/status', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    let workspaceId = (req.query.workspaceId as string) || (req.headers['x-workspace-id'] as string) || req.workspaceId;

    if (!workspaceId) {
      const ws = await getOrCreateUserWorkspace(userId);
      workspaceId = ws.workspaceId;
    }

    const membership = await verifyWorkspaceMembership(userId, workspaceId);
    if (!membership || !membership.allowed) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied to workspace' } });
      return;
    }

    const connection = await repositoryConnectionClient.findUnique({
      where: {
        workspaceId_provider: {
          workspaceId,
          provider: 'GITHUB',
        },
      },
    });

    if (!connection) {
      res.json({
        success: true,
        data: {
          connected: false,
          provider: 'GITHUB',
        },
      });
      return;
    }

    // Return sanitized connection info — NEVER expose private tokens
    res.json({
      success: true,
      data: {
        connected: connection.status === 'CONNECTED',
        provider: connection.provider,
        accountName: connection.accountName,
        accountId: connection.accountId,
        avatarUrl: connection.avatarUrl,
        scopes: connection.scopes,
        status: connection.status,
        lastSyncedAt: connection.lastSyncedAt,
        connectedAt: connection.createdAt,
      },
    });
  } catch (error) {
    console.error('Error getting GitHub integration status:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve GitHub status' } });
  }
});

/**
 * POST /api/integrations/github/connect
 * Connect a GitHub account/token to the workspace
 */
router.post('/github/connect', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { token, workspaceId } = req.body;

    let targetWorkspaceId: string = workspaceId || (req.headers['x-workspace-id'] as string) || req.workspaceId;
    if (!targetWorkspaceId) {
      const ws = await getOrCreateUserWorkspace(userId);
      targetWorkspaceId = ws.workspaceId;
    }

    if (!token || typeof token !== 'string' || !token.trim()) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'GitHub Personal Access Token or OAuth token is required.' },
      });
      return;
    }

    const membership = await verifyWorkspaceMembership(userId, targetWorkspaceId);
    if (!membership || !membership.allowed || !membership.role || !['OWNER', 'ADMIN'].includes(membership.role)) {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Only workspace administrators can connect repository integrations.' },
      });
      return;
    }

    // Verify token with GitHub API
    const verifyResult = await GitHubService.verifyToken(token.trim());
    if (!verifyResult.valid || !verifyResult.user) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_GITHUB_TOKEN',
          message: verifyResult.error || 'The GitHub token could not be verified with GitHub API.',
        },
      });
      return;
    }

    const { user, scopes } = verifyResult;

    // Encrypt token securely using AES-256-GCM
    const encryptedToken = GitHubService.encryptToken(token.trim());

    // Upsert the connection record
    const connection = await repositoryConnectionClient.upsert({
      where: {
        workspaceId_provider: {
          workspaceId: targetWorkspaceId,
          provider: 'GITHUB',
        },
      },
      update: {
        userId,
        accountName: user.login,
        accountId: String(user.id),
        avatarUrl: user.avatar_url,
        accessTokenEncrypted: encryptedToken,
        scopes: scopes || 'repo,read:user',
        status: 'CONNECTED',
        lastSyncedAt: new Date(),
      },
      create: {
        workspaceId: targetWorkspaceId,
        userId,
        provider: 'GITHUB',
        accountName: user.login,
        accountId: String(user.id),
        avatarUrl: user.avatar_url,
        accessTokenEncrypted: encryptedToken,
        scopes: scopes || 'repo,read:user',
        status: 'CONNECTED',
        lastSyncedAt: new Date(),
      },
    });

    // Log workspace activity audit record
    await logWorkspaceActivity({
      workspaceId: targetWorkspaceId,
      userId,
      action: 'GITHUB_CONNECTED',
      entityType: 'INTEGRATION',
      entityId: connection.id,
      metadata: {
        accountName: user.login,
        scopes: connection.scopes,
      },
    });

    broadcastCollaborationEvent('integration:connected', targetWorkspaceId, {
      provider: 'GITHUB',
      accountName: user.login,
      actorId: userId,
    });

    res.json({
      success: true,
      data: {
        connected: true,
        accountName: user.login,
        avatarUrl: user.avatar_url,
        scopes: connection.scopes,
        message: `Successfully connected GitHub account @${user.login}`,
      },
    });
  } catch (error: any) {
    console.error('Error connecting GitHub integration:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: `Failed to connect GitHub: ${error.message}` },
    });
  }
});

/**
 * GET /api/integrations/github/repos
 * List all repositories accessible to the connected GitHub account
 */
router.get('/github/repos', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    let workspaceId = (req.query.workspaceId as string) || (req.headers['x-workspace-id'] as string) || req.workspaceId;

    if (!workspaceId) {
      const ws = await getOrCreateUserWorkspace(userId);
      workspaceId = ws.workspaceId;
    }

    const membership = await verifyWorkspaceMembership(userId, workspaceId);
    if (!membership || !membership.allowed) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied to workspace' } });
      return;
    }

    const connection = await repositoryConnectionClient.findUnique({
      where: {
        workspaceId_provider: {
          workspaceId,
          provider: 'GITHUB',
        },
      },
    });

    if (!connection || connection.status !== 'CONNECTED') {
      res.status(400).json({
        success: false,
        error: { code: 'GITHUB_NOT_CONNECTED', message: 'GitHub integration is not connected in this workspace.' },
      });
      return;
    }

    let token: string;
    try {
      token = GitHubService.decryptToken(connection.accessTokenEncrypted);
    } catch {
      res.status(500).json({
        success: false,
        error: { code: 'DECRYPTION_FAILED', message: 'Could not decrypt GitHub credentials.' },
      });
      return;
    }

    try {
      const repositories = await GitHubService.listUserRepositories(token);

      // Update sync timestamp
      await repositoryConnectionClient.update({
        where: { id: connection.id },
        data: { lastSyncedAt: new Date() },
      });

      res.json({
        success: true,
        data: {
          repositories,
          accountName: connection.accountName,
        },
      });
    } catch (apiErr: any) {
      if (apiErr.message?.includes('401')) {
        await repositoryConnectionClient.update({
          where: { id: connection.id },
          data: { status: 'REVOKED' },
        });
      }
      res.status(502).json({
        success: false,
        error: { code: 'GITHUB_API_ERROR', message: apiErr.message },
      });
    }
  } catch (error) {
    console.error('Error listing GitHub repos:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to list GitHub repositories' } });
  }
});

/**
 * POST /api/integrations/github/import
 * Import a GitHub repository directly into the workspace
 */
router.post('/github/import', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { fullName, projectId, workspaceId, localPath } = req.body;

    let targetWorkspaceId: string = workspaceId || (req.headers['x-workspace-id'] as string) || req.workspaceId;
    if (!targetWorkspaceId) {
      const ws = await getOrCreateUserWorkspace(userId);
      targetWorkspaceId = ws.workspaceId;
    }

    if (!fullName || !fullName.includes('/')) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Valid repository full name (owner/repo) is required.' },
      });
      return;
    }

    const membership = await verifyWorkspaceMembership(userId, targetWorkspaceId);
    if (!membership || !membership.allowed) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } });
      return;
    }

    const connection = await repositoryConnectionClient.findUnique({
      where: {
        workspaceId_provider: {
          workspaceId: targetWorkspaceId,
          provider: 'GITHUB',
        },
      },
    });

    if (!connection || connection.status !== 'CONNECTED') {
      res.status(400).json({
        success: false,
        error: { code: 'GITHUB_NOT_CONNECTED', message: 'GitHub is not connected in this workspace.' },
      });
      return;
    }

    const token = GitHubService.decryptToken(connection.accessTokenEncrypted);
    const [owner, repoName] = fullName.split('/');
    const remoteRepo = await GitHubService.getRepository(token, owner, repoName);

    const slug = remoteRepo.name.toLowerCase().replace(/[^a-z0-9-_]/g, '-');

    const repository = await prisma.repository.upsert({
      where: {
        workspaceId_slug: {
          workspaceId: targetWorkspaceId,
          slug,
        },
      },
      update: {
        name: remoteRepo.name,
        projectId: projectId || undefined,
        gitUrl: remoteRepo.htmlUrl,
        defaultBranch: remoteRepo.defaultBranch,
        description: remoteRepo.description || undefined,
        localPath: localPath?.trim() || undefined,
        status: 'CONNECTED',
        lastSyncedAt: new Date(),
      },
      create: {
        workspaceId: targetWorkspaceId,
        projectId: projectId || undefined,
        name: remoteRepo.name,
        slug,
        gitUrl: remoteRepo.htmlUrl,
        defaultBranch: remoteRepo.defaultBranch,
        description: remoteRepo.description || undefined,
        localPath: localPath?.trim() || undefined,
        status: 'CONNECTED',
        lastSyncedAt: new Date(),
      },
      include: {
        project: { select: { id: true, name: true, color: true } },
        _count: { select: { tasks: true } },
      },
    });

    // Log workspace activity
    await logWorkspaceActivity({
      workspaceId: targetWorkspaceId,
      userId,
      action: 'REPOSITORY_CREATED',
      entityType: 'REPOSITORY',
      entityId: repository.id,
      metadata: {
        gitUrl: remoteRepo.htmlUrl,
        defaultBranch: remoteRepo.defaultBranch,
      },
    });

    broadcastCollaborationEvent('repository:created', targetWorkspaceId, {
      repositoryId: repository.id,
      name: repository.name,
      gitUrl: repository.gitUrl,
      actorId: userId,
    });

    res.status(201).json({
      success: true,
      data: {
        repository,
        message: `Imported "${repository.name}" from GitHub successfully.`,
      },
    });
  } catch (error: any) {
    console.error('Error importing GitHub repo:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: `Failed to import repository: ${error.message}` },
    });
  }
});

/**
 * GET /api/integrations/github/activity
 * Fetch live commits and pull requests directly from GitHub API
 */
router.get('/github/activity', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const owner = req.query.owner as string;
    const repo = req.query.repo as string;
    let workspaceId = (req.query.workspaceId as string) || req.workspaceId;

    if (!owner || !repo) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'owner and repo parameters are required.' },
      });
      return;
    }

    if (!workspaceId) {
      workspaceId = (req.headers['x-workspace-id'] as string) || req.workspaceId;
    }
    if (!workspaceId) {
      const ws = await getOrCreateUserWorkspace(userId);
      workspaceId = ws.workspaceId;
    }

    const membership = await verifyWorkspaceMembership(userId, workspaceId);
    if (!membership || !membership.allowed) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } });
      return;
    }

    const connection = await repositoryConnectionClient.findUnique({
      where: {
        workspaceId_provider: {
          workspaceId,
          provider: 'GITHUB',
        },
      },
    });

    if (!connection || connection.status !== 'CONNECTED') {
      res.status(400).json({
        success: false,
        error: { code: 'GITHUB_NOT_CONNECTED', message: 'GitHub integration is not connected.' },
      });
      return;
    }

    const token = GitHubService.decryptToken(connection.accessTokenEncrypted);

    const [commits, pullRequests] = await Promise.all([
      GitHubService.getCommits(token, owner, repo, 15).catch(() => []),
      GitHubService.getPullRequests(token, owner, repo, 10).catch(() => []),
    ]);

    res.json({
      success: true,
      data: {
        commits,
        pullRequests,
        owner,
        repo,
      },
    });
  } catch (error: any) {
    console.error('Error fetching GitHub activity:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message },
    });
  }
});

/**
 * DELETE /api/integrations/github/disconnect
 * Disconnect GitHub integration from workspace
 */
router.delete('/github/disconnect', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    let workspaceId = (req.query.workspaceId as string) || (req.body?.workspaceId as string) || (req.headers['x-workspace-id'] as string) || req.workspaceId || '';

    if (!workspaceId) {
      const ws = await getOrCreateUserWorkspace(userId);
      workspaceId = ws.workspaceId;
    }

    const membership = await verifyWorkspaceMembership(userId, workspaceId);
    if (!membership || !membership.allowed || !membership.role || !['OWNER', 'ADMIN'].includes(membership.role)) {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Only workspace administrators can disconnect integrations.' },
      });
      return;
    }

    const existing = await repositoryConnectionClient.findUnique({
      where: {
        workspaceId_provider: {
          workspaceId,
          provider: 'GITHUB',
        },
      },
    });

    if (existing) {
      await repositoryConnectionClient.delete({
        where: { id: existing.id },
      });

      await logWorkspaceActivity({
        workspaceId,
        userId,
        action: 'GITHUB_DISCONNECTED',
        entityType: 'INTEGRATION',
        entityId: existing.id,
        metadata: {
          accountName: existing.accountName,
        },
      });

      broadcastCollaborationEvent('integration:disconnected', workspaceId, {
        provider: 'GITHUB',
        actorId: userId,
      });
    }

    res.json({
      success: true,
      data: { message: 'GitHub integration disconnected successfully.' },
    });
  } catch (error) {
    console.error('Error disconnecting GitHub:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to disconnect GitHub' } });
  }
});

export default router;
