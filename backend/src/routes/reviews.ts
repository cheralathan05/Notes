import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';
import { verifyWorkspaceMembership, getOrCreateUserWorkspace } from '../lib/workspace';
import { GitService } from '../lib/git-service';
import { logWorkspaceActivity } from '../lib/collaboration-auth';
import { broadcastCollaborationEvent } from '../lib/realtime';
import { ReviewStatus, ReviewActionType } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const router = Router();
router.use(authMiddleware);

/**
 * GET /api/reviews
 * List code reviews in the active workspace
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    let workspaceId = (req.query.workspaceId as string) || (req.headers['x-workspace-id'] as string) || req.workspaceId;

    if (!workspaceId) {
      const ws = await getOrCreateUserWorkspace(userId);
      workspaceId = ws.workspaceId;
    }

    const membership = await verifyWorkspaceMembership(userId, workspaceId);
    if (!membership.allowed) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied to workspace' } });
      return;
    }

    const { repositoryId, status, taskId } = req.query;

    const reviews = await prisma.codeReview.findMany({
      where: {
        workspaceId,
        ...(repositoryId ? { repositoryId: repositoryId as string } : {}),
        ...(status ? { status: status as ReviewStatus } : {}),
        ...(taskId ? { taskId: taskId as string } : {}),
      },
      include: {
        author: { select: { id: true, displayName: true, email: true, avatarUrl: true } },
        repository: { select: { id: true, name: true, slug: true, defaultBranch: true } },
        task: { select: { id: true, title: true, status: true, priority: true } },
        _count: { select: { comments: true, actions: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    res.json({
      success: true,
      data: { reviews },
    });
  } catch (error) {
    console.error('Error listing code reviews:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to list code reviews' } });
  }
});

/**
 * POST /api/reviews
 * Create a new code review
 */
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const {
      workspaceId: reqWorkspaceId,
      repositoryId,
      taskId,
      title,
      description,
      sourceBranch,
      targetBranch = 'main',
    } = req.body;

    let workspaceId = reqWorkspaceId || (req.headers['x-workspace-id'] as string) || req.workspaceId;
    if (!workspaceId) {
      const ws = await getOrCreateUserWorkspace(userId);
      workspaceId = ws.workspaceId;
    }

    if (!repositoryId || !title?.trim() || !sourceBranch?.trim()) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Repository, title, and source branch are required' },
      });
      return;
    }

    const membership = await verifyWorkspaceMembership(userId, workspaceId);
    if (!membership.allowed || membership.role === 'VIEWER') {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } });
      return;
    }

    // Verify repository belongs to workspace
    const repo = await prisma.repository.findFirst({
      where: { id: repositoryId, workspaceId },
    });
    if (!repo) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Repository not found in workspace' } });
      return;
    }

    // Verify task if provided
    if (taskId) {
      const task = await prisma.task.findFirst({
        where: { id: taskId, workspaceId },
      });
      if (!task) {
        res.status(400).json({ success: false, error: { code: 'INVALID_TASK', message: 'Task does not belong to this workspace' } });
        return;
      }
    }

    // Attempt to resolve commitHash from local working tree
    let commitHash: string | undefined = undefined;
    if (repo.localPath && fs.existsSync(repo.localPath)) {
      try {
        const branches = await GitService.getBranches(repo.localPath);
        const match = branches.find((b) => b.name === sourceBranch.trim());
        if (match) {
          commitHash = match.commitHash;
        }
      } catch {
        // Fallback gracefully
      }
    }

    const review = await prisma.codeReview.create({
      data: {
        workspaceId,
        repositoryId,
        taskId: taskId || undefined,
        authorId: userId,
        title: title.trim(),
        description: description?.trim() || undefined,
        sourceBranch: sourceBranch.trim(),
        targetBranch: targetBranch.trim() || 'main',
        status: 'REVIEW_REQUESTED',
        commitHash,
      },
      include: {
        author: { select: { id: true, displayName: true, email: true, avatarUrl: true } },
        repository: { select: { id: true, name: true, slug: true } },
        task: { select: { id: true, title: true, status: true } },
      },
    });

    // If linked to task, transition task to IN_REVIEW if it was TODO or IN_PROGRESS
    if (taskId) {
      await prisma.task.update({
        where: { id: taskId },
        data: {
          status: 'IN_REVIEW',
          branchName: sourceBranch.trim(),
          repositoryId,
        },
      });
    }

    await logWorkspaceActivity({
      workspaceId,
      userId,
      action: 'CREATED_CODE_REVIEW',
      entityType: 'CODE_REVIEW',
      entityId: review.id,
      metadata: { title: review.title, repositoryName: repo.name, sourceBranch, targetBranch },
    });

    broadcastCollaborationEvent('CODE_REVIEW_CREATED', workspaceId, {
      reviewId: review.id,
      title: review.title,
      author: review.author.displayName,
    });

    res.status(201).json({
      success: true,
      data: { review },
    });
  } catch (error) {
    console.error('Error creating code review:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create code review' } });
  }
});

/**
 * GET /api/reviews/:id
 * Retrieve full details of a code review, including comments, actions, and real git diff
 */
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const reviewId = req.params.id as string;

    const review = await prisma.codeReview.findUnique({
      where: { id: reviewId },
      include: {
        author: { select: { id: true, displayName: true, email: true, avatarUrl: true } },
        repository: true,
        task: {
          select: {
            id: true,
            title: true,
            status: true,
            priority: true,
            acceptanceCriteria: true,
            isVerified: true,
          },
        },
        comments: {
          include: {
            user: { select: { id: true, displayName: true, email: true, avatarUrl: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
        actions: {
          include: {
            user: { select: { id: true, displayName: true, email: true, avatarUrl: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!review) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Code review not found' } });
      return;
    }

    const membership = await verifyWorkspaceMembership(userId, review.workspaceId);
    if (!membership.allowed) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } });
      return;
    }

    // Retrieve real git diff between targetBranch and sourceBranch
    let diff: string | null = null;
    let isLocalReachable = false;
    let commitRange: any[] = [];

    if (review.repository.localPath && fs.existsSync(review.repository.localPath)) {
      isLocalReachable = true;
      try {
        const repoPath = review.repository.localPath;
        // Fetch diff between target and source branch
        diff = await GitService.getBranchDiff(repoPath, review.targetBranch, review.sourceBranch);
        const commits = await GitService.getCommits(repoPath, 20);
        commitRange = commits;
      } catch (err) {
        console.warn('Could not generate git diff for review:', err);
      }
    }

    res.json({
      success: true,
      data: {
        review,
        diff,
        isLocalReachable,
        commitRange,
      },
    });
  } catch (error) {
    console.error('Error fetching code review details:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve review' } });
  }
});

/**
 * POST /api/reviews/:id/comments
 * Post a comment or inline diff note on a code review
 */
router.post('/:id/comments', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const reviewId = req.params.id as string;
    const { content, filePath, lineNumber } = req.body;

    if (!content || !content.trim()) {
      res.status(400).json({ success: false, error: { code: 'INVALID_INPUT', message: 'Comment content is required' } });
      return;
    }

    const review = await prisma.codeReview.findUnique({
      where: { id: reviewId },
      include: { author: true },
    });

    if (!review) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Review not found' } });
      return;
    }

    const membership = await verifyWorkspaceMembership(userId, review.workspaceId);
    if (!membership.allowed) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } });
      return;
    }

    const comment = await prisma.codeReviewComment.create({
      data: {
        reviewId,
        userId,
        filePath: filePath?.trim() || undefined,
        lineNumber: typeof lineNumber === 'number' ? lineNumber : undefined,
        content: content.trim(),
      },
      include: {
        user: { select: { id: true, displayName: true, email: true, avatarUrl: true } },
      },
    });

    // Notify author if someone else commented
    if (review.authorId !== userId) {
      await prisma.notification.create({
        data: {
          workspaceId: review.workspaceId,
          recipientId: review.authorId,
          actorId: userId,
          type: 'MENTION',
          title: 'New comment on code review',
          message: `${comment.user.displayName} commented on "${review.title}"`,
          linkUrl: `/reviews?id=${review.id}`,
        },
      });
    }

    broadcastCollaborationEvent('CODE_REVIEW_COMMENT_ADDED', review.workspaceId, {
      reviewId,
      commentId: comment.id,
      commenter: comment.user.displayName,
    });

    res.status(201).json({
      success: true,
      data: { comment },
    });
  } catch (error) {
    console.error('Error posting review comment:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to post comment' } });
  }
});

/**
 * POST /api/reviews/:id/actions
 * Submit review verdict: APPROVE, REQUEST_CHANGES, CLOSE, REOPEN
 */
router.post('/:id/actions', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const reviewId = req.params.id as string;
    const { action, summary } = req.body;

    const validActions: ReviewActionType[] = ['APPROVE', 'REQUEST_CHANGES', 'COMMENT', 'CLOSE', 'REOPEN'];
    if (!action || !validActions.includes(action)) {
      res.status(400).json({ success: false, error: { code: 'INVALID_ACTION', message: 'Valid review action required' } });
      return;
    }

    const review = await prisma.codeReview.findUnique({
      where: { id: reviewId },
      include: { author: true, task: true },
    });

    if (!review) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Review not found' } });
      return;
    }

    const membership = await verifyWorkspaceMembership(userId, review.workspaceId);
    if (!membership.allowed || membership.role === 'VIEWER') {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient review permissions' } });
      return;
    }

    // Author cannot self-approve their own review
    if (action === 'APPROVE' && review.authorId === userId) {
      res.status(400).json({
        success: false,
        error: { code: 'SELF_APPROVAL_DISALLOWED', message: 'Independent peer review required: authors cannot approve their own code review' },
      });
      return;
    }

    let nextStatus: ReviewStatus = review.status;
    if (action === 'APPROVE') nextStatus = 'APPROVED';
    else if (action === 'REQUEST_CHANGES') nextStatus = 'CHANGES_REQUESTED';
    else if (action === 'CLOSE') nextStatus = 'CLOSED';
    else if (action === 'REOPEN') nextStatus = 'OPEN';

    const [recordedAction, updatedReview] = await prisma.$transaction([
      prisma.codeReviewAction.create({
        data: {
          reviewId,
          userId,
          action,
          summary: summary?.trim() || undefined,
        },
        include: {
          user: { select: { id: true, displayName: true, email: true } },
        },
      }),
      prisma.codeReview.update({
        where: { id: reviewId },
        data: { status: nextStatus },
        include: {
          author: { select: { id: true, displayName: true, email: true } },
          repository: { select: { id: true, name: true } },
          task: { select: { id: true, title: true, status: true } },
        },
      }),
    ]);

    // Notify author of review verdict
    if (review.authorId !== userId) {
      await prisma.notification.create({
        data: {
          workspaceId: review.workspaceId,
          recipientId: review.authorId,
          actorId: userId,
          type: 'TASK_STATUS_CHANGED',
          title: `Code Review ${action}`,
          message: `${recordedAction.user.displayName} ${action.toLowerCase().replace('_', ' ')} your review "${review.title}"`,
          linkUrl: `/reviews?id=${review.id}`,
        },
      });
    }

    await logWorkspaceActivity({
      workspaceId: review.workspaceId,
      userId,
      action: `REVIEW_${action}`,
      entityType: 'CODE_REVIEW',
      entityId: review.id,
      metadata: { reviewTitle: review.title, verdict: action, newStatus: nextStatus },
    });

    broadcastCollaborationEvent('CODE_REVIEW_ACTION_RECORDED', review.workspaceId, {
      reviewId,
      action,
      reviewer: recordedAction.user.displayName,
      status: nextStatus,
    });

    res.json({
      success: true,
      data: {
        action: recordedAction,
        review: updatedReview,
      },
    });
  } catch (error) {
    console.error('Error submitting review action:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to record review action' } });
  }
});

export default router;
