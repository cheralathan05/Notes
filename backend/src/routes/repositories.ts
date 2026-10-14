import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';
import { verifyWorkspaceMembership } from '../lib/workspace';

const router = Router();
router.use(authMiddleware);

/**
 * GET /api/repositories
 * List repositories in the active workspace
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const workspaceId = (req.query.workspaceId as string) || req.workspaceId;

    if (!workspaceId) {
      res.status(400).json({ success: false, error: { code: 'WORKSPACE_REQUIRED', message: 'Workspace ID required' } });
      return;
    }

    const membership = await verifyWorkspaceMembership(userId, workspaceId);
    if (!membership) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied to workspace' } });
      return;
    }

    const repositories = await prisma.repository.findMany({
      where: { workspaceId },
      include: {
        project: { select: { id: true, name: true, color: true } },
        _count: { select: { tasks: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    res.json({
      success: true,
      data: { repositories },
    });
  } catch (error) {
    console.error('Error listing repositories:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to list repositories' } });
  }
});

/**
 * POST /api/repositories
 * Register a new repository in the workspace
 */
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const {
      workspaceId = req.workspaceId,
      projectId,
      name,
      slug,
      gitUrl,
      defaultBranch = 'main',
      localPath,
      description,
    } = req.body;

    if (!workspaceId || !name) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Workspace ID and repository name are required' },
      });
      return;
    }

    const membership = await verifyWorkspaceMembership(userId, workspaceId);
    if (!membership) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } });
      return;
    }

    const repoSlug =
      slug?.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '-') ||
      name.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '-');

    const repository = await prisma.repository.upsert({
      where: {
        workspaceId_slug: {
          workspaceId,
          slug: repoSlug,
        },
      },
      update: {
        name: name.trim(),
        projectId: projectId || undefined,
        gitUrl: gitUrl?.trim() || undefined,
        defaultBranch: defaultBranch?.trim() || 'main',
        localPath: localPath?.trim() || undefined,
        description: description?.trim() || undefined,
      },
      create: {
        workspaceId,
        projectId: projectId || undefined,
        name: name.trim(),
        slug: repoSlug,
        gitUrl: gitUrl?.trim() || undefined,
        defaultBranch: defaultBranch?.trim() || 'main',
        localPath: localPath?.trim() || undefined,
        description: description?.trim() || undefined,
      },
    });

    res.status(201).json({
      success: true,
      data: { repository },
    });
  } catch (error) {
    console.error('Error creating repository:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to register repository' } });
  }
});

/**
 * POST /api/repositories/connect
 * CLI command endpoint: Connect local repository to workspace/project
 */
router.post('/connect', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const {
      workspaceId = req.workspaceId,
      projectId,
      repoName,
      gitRemoteUrl,
      currentBranch = 'main',
      localPath,
    } = req.body;

    if (!repoName) {
      res.status(400).json({ success: false, error: { code: 'INVALID_INPUT', message: 'Repository name required' } });
      return;
    }

    // Determine target workspace
    let targetWorkspaceId = workspaceId;
    if (!targetWorkspaceId) {
      const firstMembership = await prisma.workspaceMember.findFirst({
        where: { userId },
        select: { workspaceId: true },
      });
      targetWorkspaceId = firstMembership?.workspaceId;
    }

    if (!targetWorkspaceId) {
      res.status(400).json({ success: false, error: { code: 'NO_WORKSPACE', message: 'Workspace required' } });
      return;
    }

    const slug = repoName.toLowerCase().replace(/[^a-z0-9-_]/g, '-');

    const repository = await prisma.repository.upsert({
      where: {
        workspaceId_slug: {
          workspaceId: targetWorkspaceId,
          slug,
        },
      },
      update: {
        projectId: projectId || undefined,
        gitUrl: gitRemoteUrl || undefined,
        defaultBranch: currentBranch,
        localPath: localPath || undefined,
      },
      create: {
        workspaceId: targetWorkspaceId,
        projectId: projectId || undefined,
        name: repoName,
        slug,
        gitUrl: gitRemoteUrl || undefined,
        defaultBranch: currentBranch,
        localPath: localPath || undefined,
      },
    });

    res.json({
      success: true,
      data: {
        repository,
        message: `Connected repository "${repository.name}" successfully.`,
      },
    });
  } catch (error) {
    console.error('Error connecting repository via CLI:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to connect repository' } });
  }
});

/**
 * DELETE /api/repositories/:id
 * Disconnect/delete repository from workspace
 */
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const repoId = req.params.id as string;

    const repo = await prisma.repository.findUnique({
      where: { id: repoId },
    });

    if (!repo) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Repository not found' } });
      return;
    }

    const membership = await verifyWorkspaceMembership(userId, repo.workspaceId);
    if (!membership.allowed || !membership.role || !['OWNER', 'ADMIN'].includes(membership.role)) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Only workspace admins can remove repositories' } });
      return;
    }

    await prisma.repository.delete({ where: { id: repoId } });

    res.json({
      success: true,
      data: { message: 'Repository disconnected successfully' },
    });
  } catch (error) {
    console.error('Error deleting repository:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to remove repository' } });
  }
});

export default router;
