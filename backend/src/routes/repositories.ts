import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';
import { verifyWorkspaceMembership, getOrCreateUserWorkspace, resolveWorkspaceContext } from '../lib/workspace';
import { GitService } from '../lib/git-service';
import { broadcastCollaborationEvent } from '../lib/realtime';
import * as fs from 'fs';
import * as path from 'path';

const router = Router();
router.use(authMiddleware);

/**
 * GET /api/repositories
 * List repositories in the active workspace with rich Git status
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const ws = await resolveWorkspaceContext(req);
    const workspaceId = ws.workspaceId;

    const repositories = await prisma.repository.findMany({
      where: { workspaceId },
      include: {
        project: { select: { id: true, name: true, color: true } },
        _count: { select: { tasks: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    // Enrich with live working-tree availability if localPath exists on server
    const enriched = await Promise.all(
      repositories.map(async (repo) => {
        let isLocalReachable = false;
        let liveMeta: any = null;

        if (repo.localPath && fs.existsSync(repo.localPath)) {
          isLocalReachable = true;
          try {
            liveMeta = await GitService.getRepositoryMetadata(repo.localPath);
          } catch {
            // Live metadata fallback to persisted DB values
          }
        }

        return {
          ...repo,
          isLocalReachable,
          liveBranch: liveMeta?.currentBranch || repo.defaultBranch,
          liveCommit: liveMeta?.latestCommit || (repo.latestCommit ? { shortHash: repo.latestCommit.slice(0, 7), hash: repo.latestCommit } : null),
          uncommittedChangesCount: liveMeta?.changedFilesCount ?? 0,
          isClean: liveMeta?.isClean ?? true,
        };
      })
    );

    res.json({
      success: true,
      data: { repositories: enriched },
    });
  } catch (error) {
    console.error('Error listing repositories:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to list repositories' } });
  }
});

/**
 * GET /api/repositories/:id
 * Retrieve comprehensive details for a single repository
 */
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const repoId = req.params.id as string;

    const repository = await prisma.repository.findUnique({
      where: { id: repoId },
      include: {
        project: { select: { id: true, name: true, color: true, icon: true } },
        tasks: {
          select: {
            id: true,
            title: true,
            status: true,
            priority: true,
            branchName: true,
            isVerified: true,
            verifiedAt: true,
            assignee: { select: { id: true, displayName: true, email: true } },
            _count: { select: { evidence: true } },
          },
          orderBy: { updatedAt: 'desc' },
        },
        _count: { select: { tasks: true } },
      },
    });

    if (!repository) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Repository not found' } });
      return;
    }

    const membership = await verifyWorkspaceMembership(userId, repository.workspaceId);
    if (!membership.allowed) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } });
      return;
    }

    // Live git metadata check
    let liveMeta: any = null;
    let isLocalReachable = false;
    if (repository.localPath && fs.existsSync(repository.localPath)) {
      isLocalReachable = true;
      try {
        liveMeta = await GitService.getRepositoryMetadata(repository.localPath);
      } catch (err) {
        console.error('Live metadata read failed:', err);
      }
    }

    res.json({
      success: true,
      data: {
        repository: {
          ...repository,
          isLocalReachable,
          liveMeta,
        },
      },
    });
  } catch (error) {
    console.error('Error getting repository details:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve repository' } });
  }
});

/**
 * POST /api/repositories
 * Register a new repository in the workspace (Local path or Remote Git URL)
 */
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const {
      workspaceId,
      projectId,
      name,
      slug,
      gitUrl,
      defaultBranch = 'main',
      localPath,
      description,
    } = req.body;

    let targetWorkspaceId = workspaceId || req.workspaceId;
    if (!targetWorkspaceId) {
      const ws = await getOrCreateUserWorkspace(userId);
      targetWorkspaceId = ws.workspaceId;
    }

    if (!name || !name.trim()) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Repository name is required' },
      });
      return;
    }

    const membership = await verifyWorkspaceMembership(userId, targetWorkspaceId);
    if (!membership || !membership.allowed) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } });
      return;
    }

    let detectedBranch = defaultBranch?.trim() || 'main';
    let detectedRemote = gitUrl?.trim() || undefined;
    let latestCommit: string | undefined = undefined;

    // If localPath is provided, validate it on the host
    if (localPath && localPath.trim()) {
      const cleanPath = path.normalize(localPath.trim());
      if (fs.existsSync(cleanPath)) {
        const isGit = await GitService.isGitRepository(cleanPath);
        if (isGit) {
          const meta = await GitService.getRepositoryMetadata(cleanPath);
          if (meta.currentBranch) detectedBranch = meta.currentBranch;
          if (meta.remoteUrl && !detectedRemote) detectedRemote = meta.remoteUrl;
          if (meta.latestCommit?.hash) latestCommit = meta.latestCommit.hash;
        }
      }
    }

    const repoSlug =
      slug?.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '-') ||
      name.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '-');

    const repository = await prisma.repository.upsert({
      where: {
        workspaceId_slug: {
          workspaceId: targetWorkspaceId,
          slug: repoSlug,
        },
      },
      update: {
        name: name.trim(),
        projectId: projectId || undefined,
        gitUrl: detectedRemote,
        defaultBranch: detectedBranch,
        localPath: localPath?.trim() || undefined,
        description: description?.trim() || undefined,
        status: 'CONNECTED',
        lastSyncedAt: new Date(),
        latestCommit,
      },
      create: {
        workspaceId: targetWorkspaceId,
        projectId: projectId || undefined,
        name: name.trim(),
        slug: repoSlug,
        gitUrl: detectedRemote,
        defaultBranch: detectedBranch,
        localPath: localPath?.trim() || undefined,
        description: description?.trim() || undefined,
        status: 'CONNECTED',
        lastSyncedAt: new Date(),
        latestCommit,
      },
      include: {
        project: { select: { id: true, name: true, color: true } },
        _count: { select: { tasks: true } },
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
      latestCommit,
    } = req.body;

    if (!repoName) {
      res.status(400).json({ success: false, error: { code: 'INVALID_INPUT', message: 'Repository name required' } });
      return;
    }

    // Determine target workspace
    let targetWorkspaceId = workspaceId || req.workspaceId;
    if (!targetWorkspaceId) {
      const ws = await getOrCreateUserWorkspace(userId);
      targetWorkspaceId = ws.workspaceId;
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
        latestCommit: latestCommit || undefined,
        status: 'CONNECTED',
        lastSyncedAt: new Date(),
      },
      create: {
        workspaceId: targetWorkspaceId,
        projectId: projectId || undefined,
        name: repoName,
        slug,
        gitUrl: gitRemoteUrl || undefined,
        defaultBranch: currentBranch,
        localPath: localPath || undefined,
        latestCommit: latestCommit || undefined,
        status: 'CONNECTED',
        lastSyncedAt: new Date(),
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
 * POST /api/repositories/:id/sync
 * Manually trigger synchronization of repository state
 */
router.post('/:id/sync', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const repoId = req.params.id as string;

    const repository = await prisma.repository.findUnique({
      where: { id: repoId },
    });

    if (!repository) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Repository not found' } });
      return;
    }

    const membership = await verifyWorkspaceMembership(userId, repository.workspaceId);
    if (!membership.allowed) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } });
      return;
    }

    let meta: any = null;
    let status = 'CONNECTED';
    let latestCommit = repository.latestCommit;
    let defaultBranch = repository.defaultBranch;

    if (repository.localPath && fs.existsSync(repository.localPath)) {
      try {
        meta = await GitService.getRepositoryMetadata(repository.localPath);
        if (meta.isGit) {
          if (meta.latestCommit?.hash) latestCommit = meta.latestCommit.hash;
          if (meta.currentBranch) defaultBranch = meta.currentBranch;
        } else {
          status = 'DISCONNECTED';
        }
      } catch (err) {
        status = 'ERROR';
      }
    }

    const updated = await prisma.repository.update({
      where: { id: repoId },
      data: {
        status,
        latestCommit,
        defaultBranch,
        lastSyncedAt: new Date(),
      },
      include: {
        project: { select: { id: true, name: true, color: true } },
        _count: { select: { tasks: true } },
      },
    });

    res.json({
      success: true,
      data: {
        repository: updated,
        liveMeta: meta,
        message: `Repository "${updated.name}" synchronized.`,
      },
    });
  } catch (error) {
    console.error('Error syncing repository:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to sync repository' } });
  }
});

/**
 * GET /api/repositories/:id/branches
 * Retrieve real branches from local working tree
 */
router.get('/:id/branches', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const repoId = req.params.id as string;

    const repository = await prisma.repository.findUnique({
      where: { id: repoId },
    });

    if (!repository) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Repository not found' } });
      return;
    }

    const membership = await verifyWorkspaceMembership(userId, repository.workspaceId);
    if (!membership.allowed) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } });
      return;
    }

    if (!repository.localPath || !fs.existsSync(repository.localPath)) {
      // Local path not accessible by server
      res.json({
        success: true,
        data: {
          branches: [
            {
              name: repository.defaultBranch,
              isCurrent: true,
              isRemote: false,
              commitHash: repository.latestCommit || 'HEAD',
              commitDate: repository.updatedAt.toISOString(),
              subject: 'Configured default branch',
            },
          ],
          isLocalReachable: false,
        },
      });
      return;
    }

    const branches = await GitService.getBranches(repository.localPath);

    res.json({
      success: true,
      data: {
        branches,
        isLocalReachable: true,
      },
    });
  } catch (error) {
    console.error('Error fetching branches:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to get branches' } });
  }
});

/**
 * GET /api/repositories/:id/commits
 * Retrieve real commit history from local working tree
 */
router.get('/:id/commits', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const repoId = req.params.id as string;
    const limit = parseInt((req.query.limit as string) || '30', 10);

    const repository = await prisma.repository.findUnique({
      where: { id: repoId },
    });

    if (!repository) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Repository not found' } });
      return;
    }

    const membership = await verifyWorkspaceMembership(userId, repository.workspaceId);
    if (!membership.allowed) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } });
      return;
    }

    if (!repository.localPath || !fs.existsSync(repository.localPath)) {
      res.json({
        success: true,
        data: {
          commits: repository.latestCommit
            ? [
                {
                  hash: repository.latestCommit,
                  shortHash: repository.latestCommit.slice(0, 7),
                  message: 'Latest tracked commit',
                  authorName: 'Git Committer',
                  authorEmail: '',
                  date: repository.updatedAt.toISOString(),
                  relativeDate: 'tracked',
                },
              ]
            : [],
          isLocalReachable: false,
        },
      });
      return;
    }

    const commits = await GitService.getCommits(repository.localPath, limit);

    // Cross reference commits with linked tasks in this workspace
    const workspaceTasks = await prisma.task.findMany({
      where: {
        workspaceId: repository.workspaceId,
        repositoryId: repository.id,
      },
      select: { id: true, title: true, status: true },
    });

    const enrichedCommits = commits.map((c) => {
      // Find if commit mentions any task ID or task title
      const matchedTask = workspaceTasks.find(
        (t) =>
          c.message.toLowerCase().includes(t.id.toLowerCase()) ||
          c.message.toLowerCase().includes(`task-${t.id.toLowerCase()}`) ||
          c.message.toLowerCase().includes(t.title.toLowerCase())
      );

      return {
        ...c,
        matchedTask: matchedTask ? { id: matchedTask.id, title: matchedTask.title, status: matchedTask.status } : null,
      };
    });

    res.json({
      success: true,
      data: {
        commits: enrichedCommits,
        isLocalReachable: true,
      },
    });
  } catch (error) {
    console.error('Error fetching commits:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to get commits' } });
  }
});

/**
 * GET /api/repositories/:id/status
 * Retrieve real working-tree status: modified files, branch status
 */
router.get('/:id/status', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const repoId = req.params.id as string;

    const repository = await prisma.repository.findUnique({
      where: { id: repoId },
    });

    if (!repository) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Repository not found' } });
      return;
    }

    const membership = await verifyWorkspaceMembership(userId, repository.workspaceId);
    if (!membership.allowed) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } });
      return;
    }

    if (!repository.localPath || !fs.existsSync(repository.localPath)) {
      res.json({
        success: true,
        data: {
          status: {
            branch: repository.defaultBranch,
            ahead: 0,
            behind: 0,
            files: [],
            isClean: true,
          },
          isLocalReachable: false,
        },
      });
      return;
    }

    const status = await GitService.getWorkingTreeStatus(repository.localPath);

    res.json({
      success: true,
      data: {
        status,
        isLocalReachable: true,
      },
    });
  } catch (error) {
    console.error('Error getting status:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to get working tree status' } });
  }
});

/**
 * GET /api/repositories/:id/diff
 * Retrieve safe unified diff preview
 */
router.get('/:id/diff', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const repoId = req.params.id as string;
    const file = req.query.file as string | undefined;

    const repository = await prisma.repository.findUnique({
      where: { id: repoId },
    });

    if (!repository) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Repository not found' } });
      return;
    }

    const membership = await verifyWorkspaceMembership(userId, repository.workspaceId);
    if (!membership.allowed) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } });
      return;
    }

    if (!repository.localPath || !fs.existsSync(repository.localPath)) {
      res.json({
        success: true,
        data: { diff: '', truncated: false, isLocalReachable: false },
      });
      return;
    }

    const diffResult = await GitService.getDiff(repository.localPath, file);

    res.json({
      success: true,
      data: {
        ...diffResult,
        file: file || null,
        isLocalReachable: true,
      },
    });
  } catch (error) {
    console.error('Error getting diff:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to get diff preview' } });
  }
});

/**
 * PATCH /api/repositories/:id
 * Update repository configuration
 */
router.patch('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const repoId = req.params.id as string;
    const { name, description, defaultBranch, projectId, gitUrl, localPath } = req.body;

    const repository = await prisma.repository.findUnique({
      where: { id: repoId },
    });

    if (!repository) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Repository not found' } });
      return;
    }

    const membership = await verifyWorkspaceMembership(userId, repository.workspaceId);
    if (!membership.allowed) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } });
      return;
    }

    const updated = await prisma.repository.update({
      where: { id: repoId },
      data: {
        name: name !== undefined ? name.trim() : undefined,
        description: description !== undefined ? description.trim() : undefined,
        defaultBranch: defaultBranch !== undefined ? defaultBranch.trim() : undefined,
        projectId: projectId !== undefined ? projectId || null : undefined,
        gitUrl: gitUrl !== undefined ? gitUrl?.trim() || null : undefined,
        localPath: localPath !== undefined ? localPath?.trim() || null : undefined,
      },
      include: {
        project: { select: { id: true, name: true, color: true } },
        _count: { select: { tasks: true } },
      },
    });

    res.json({
      success: true,
      data: { repository: updated },
    });
  } catch (error) {
    console.error('Error updating repository:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update repository' } });
  }
});

/**
 * POST /api/repositories/:id/link-task
 * Link a task to this repository
 */
router.post('/:id/link-task', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const repoId = req.params.id as string;
    const { taskId, branchName } = req.body;

    if (!taskId) {
      res.status(400).json({ success: false, error: { code: 'INVALID_INPUT', message: 'taskId is required' } });
      return;
    }

    const repository = await prisma.repository.findUnique({
      where: { id: repoId },
    });

    if (!repository) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Repository not found' } });
      return;
    }

    const membership = await verifyWorkspaceMembership(userId, repository.workspaceId);
    if (!membership.allowed) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } });
      return;
    }

    const existingTask = await prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!existingTask) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Task not found' } });
      return;
    }

    if (existingTask.workspaceId !== repository.workspaceId) {
      res.status(400).json({
        success: false,
        error: { code: 'CROSS_WORKSPACE_FORBIDDEN', message: 'Task belongs to a different workspace' },
      });
      return;
    }

    let cleanBranch = existingTask.branchName;
    if (branchName && typeof branchName === 'string') {
      const trimmed = branchName.trim();
      if (trimmed) {
        if (!/^[a-zA-Z0-9._\-\/]+$/.test(trimmed)) {
          res.status(400).json({
            success: false,
            error: { code: 'INVALID_BRANCH_NAME', message: 'Invalid branch name format' },
          });
          return;
        }
        cleanBranch = trimmed;
      }
    }

    const task = await prisma.task.update({
      where: { id: taskId },
      data: {
        repositoryId: repoId,
        branchName: cleanBranch || undefined,
      },
    });

    broadcastCollaborationEvent('task:updated', repository.workspaceId, {
      taskId: task.id,
      title: task.title,
      repositoryId: repoId,
      branchName: task.branchName,
      actorId: userId,
    });

    res.json({
      success: true,
      data: { task, message: 'Task linked to repository successfully' },
    });
  } catch (error) {
    console.error('Error linking task to repository:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to link task' } });
  }
});

/**
 * POST /api/repositories/:id/unlink-task
 * Unlink a task from this repository
 */
router.post('/:id/unlink-task', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const repoId = req.params.id as string;
    const { taskId } = req.body;

    if (!taskId) {
      res.status(400).json({ success: false, error: { code: 'INVALID_INPUT', message: 'taskId is required' } });
      return;
    }

    const repository = await prisma.repository.findUnique({
      where: { id: repoId },
    });

    if (!repository) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Repository not found' } });
      return;
    }

    const membership = await verifyWorkspaceMembership(userId, repository.workspaceId);
    if (!membership.allowed) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } });
      return;
    }

    const existingTask = await prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!existingTask) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Task not found' } });
      return;
    }

    if (existingTask.workspaceId !== repository.workspaceId) {
      res.status(400).json({
        success: false,
        error: { code: 'CROSS_WORKSPACE_FORBIDDEN', message: 'Task belongs to a different workspace' },
      });
      return;
    }

    const task = await prisma.task.update({
      where: { id: taskId },
      data: {
        repositoryId: null,
      },
    });

    broadcastCollaborationEvent('task:updated', repository.workspaceId, {
      taskId: task.id,
      title: task.title,
      repositoryId: null,
      actorId: userId,
    });

    res.json({
      success: true,
      data: { task, message: 'Task unlinked from repository' },
    });
  } catch (error) {
    console.error('Error unlinking task from repository:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to unlink task' } });
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
