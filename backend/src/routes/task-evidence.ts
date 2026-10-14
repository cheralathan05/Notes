import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';
import { verifyWorkspaceMembership } from '../lib/workspace';
import { broadcastTaskEvent } from '../lib/realtime';

const router = Router();
router.use(authMiddleware);

/**
 * Resolves a canonical task by raw cuid, TASK- prefix, or unique prefix
 */
export async function resolveCanonicalTask(taskId: string, include?: any) {
  const cleanId = taskId.replace(/^task-/i, '');
  let task = await prisma.task.findUnique({
    where: { id: cleanId },
    include,
  });
  if (!task) {
    task = await prisma.task.findUnique({
      where: { id: taskId },
      include,
    });
  }
  if (!task && cleanId.length >= 6) {
    task = await prisma.task.findFirst({
      where: { id: { startsWith: cleanId } },
      include,
    });
  }
  return task;
}

/**
 * POST /api/tasks/:id/claim
 * Claim exclusive lease on a task
 */
router.post('/:id/claim', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const taskId = req.params.id as string;
    const { leaseMinutes = 120 } = req.body;

    const task = await resolveCanonicalTask(taskId, {
      claimedBy: { select: { id: true, displayName: true, email: true } },
    });

    if (!task) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Task not found' } });
      return;
    }

    const membership = await verifyWorkspaceMembership(userId, task.workspaceId);
    if (!membership.allowed) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied to task workspace' } });
      return;
    }

    const now = new Date();

    // Check if task is ALREADY actively claimed by the requesting user
    if (
      task.claimedById === userId &&
      task.leaseExpiresAt &&
      task.leaseExpiresAt > now
    ) {
      res.json({
        success: true,
        data: {
          task,
          alreadyClaimed: true,
          message: `You already hold an active claim on this task until ${task.leaseExpiresAt.toLocaleTimeString()}. Status: ${task.status}.`,
        },
      });
      return;
    }

    const claimer = task.claimedBy as any;
    // Check if task is actively claimed by someone else
    if (
      task.claimedById &&
      task.claimedById !== userId &&
      task.leaseExpiresAt &&
      task.leaseExpiresAt > now
    ) {
      res.status(409).json({
        success: false,
        error: {
          code: 'TASK_ALREADY_CLAIMED',
          message: `Task is currently claimed by ${claimer?.displayName || claimer?.email || 'another user'} until ${task.leaseExpiresAt.toISOString()}`,
        },
      });
      return;
    }

    const leaseExpiresAt = new Date(now.getTime() + leaseMinutes * 60 * 1000);

    const updatedTask: any = await prisma.task.update({
      where: { id: task.id },
      data: {
        claimedById: userId,
        claimedAt: now,
        leaseExpiresAt,
        assigneeId: task.assigneeId || userId, // Auto-assign to claimer if unassigned
        status: task.status === 'BACKLOG' || task.status === 'TODO' ? 'IN_PROGRESS' : task.status,
      },
      include: {
        claimedBy: { select: { id: true, displayName: true, email: true } },
        assignee: { select: { id: true, displayName: true, email: true } },
      },
    });

    // Record activity
    await prisma.taskActivity.create({
      data: {
        taskId: task.id,
        userId,
        action: 'TASK_CLAIMED',
        metadata: { leaseMinutes, leaseExpiresAt: leaseExpiresAt.toISOString() },
      },
    });

    broadcastTaskEvent('TASK_UPDATED', task.workspaceId, {
      taskId: task.id,
      claimedById: userId,
      claimedByName: updatedTask.claimedBy?.displayName,
      leaseExpiresAt: leaseExpiresAt.toISOString(),
    });

    res.json({
      success: true,
      data: {
        task: updatedTask,
        message: `Task claimed successfully until ${leaseExpiresAt.toLocaleTimeString()}`,
      },
    });
  } catch (error) {
    console.error('Error claiming task:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to claim task' } });
  }
});

/**
 * POST /api/tasks/:id/release
 * Release exclusive claim on a task
 */
router.post('/:id/release', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const taskId = req.params.id as string;

    const task = await resolveCanonicalTask(taskId);

    if (!task) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Task not found' } });
      return;
    }

    const membership = await verifyWorkspaceMembership(userId, task.workspaceId);
    if (!membership.allowed) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } });
      return;
    }

    // Only current claimer or workspace admin/owner can release
    const isClaimer = task.claimedById === userId;
    const isAdmin = Boolean(membership.role && ['OWNER', 'ADMIN'].includes(membership.role));

    if (!isClaimer && !isAdmin) {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Only the active claimer or a workspace admin can release this task' },
      });
      return;
    }

    const updatedTask = await prisma.task.update({
      where: { id: task.id },
      data: {
        claimedById: null,
        claimedAt: null,
        leaseExpiresAt: null,
      },
    });

    await prisma.taskActivity.create({
      data: {
        taskId: task.id,
        userId,
        action: 'TASK_RELEASED',
        metadata: { releasedBy: userId },
      },
    });

    broadcastTaskEvent('TASK_UPDATED', task.workspaceId, {
      taskId: task.id,
      claimedById: null,
      leaseExpiresAt: null,
    });

    res.json({
      success: true,
      data: { task: updatedTask, message: 'Task claim released' },
    });
  } catch (error) {
    console.error('Error releasing task claim:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to release task' } });
  }
});

/**
 * PATCH /api/tasks/:id/criteria
 * Update acceptance criteria checklist for a task
 */
router.patch('/:id/criteria', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const taskId = req.params.id as string;
    const { criteria } = req.body;

    if (!Array.isArray(criteria)) {
      res.status(400).json({ success: false, error: { code: 'INVALID_INPUT', message: 'Criteria must be an array' } });
      return;
    }

    const task = await resolveCanonicalTask(taskId);

    if (!task) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Task not found' } });
      return;
    }

    const membership = await verifyWorkspaceMembership(userId, task.workspaceId);
    if (!membership.allowed) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } });
      return;
    }

    // Format criteria items cleanly
    const formattedCriteria = criteria.map((c: any, index: number) => ({
      id: c.id || `crit_${index + 1}`,
      text: String(c.text || c).trim(),
      isCompleted: Boolean(c.isCompleted),
    }));

    const updatedTask = await prisma.task.update({
      where: { id: task.id },
      data: {
        acceptanceCriteria: formattedCriteria,
      },
    });

    broadcastTaskEvent('TASK_UPDATED', task.workspaceId, {
      taskId: task.id,
      acceptanceCriteria: formattedCriteria,
    });

    res.json({
      success: true,
      data: { task: updatedTask },
    });
  } catch (error) {
    console.error('Error updating task acceptance criteria:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update criteria' } });
  }
});

/**
 * POST /api/tasks/:id/evidence
 * Submit execution evidence (e.g. CLI checks run, test results, commit hash) and evaluate completion policy
 */
router.post('/:id/evidence', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const taskId = req.params.id as string;
    const {
      command,
      exitCode = 0,
      stdoutSnippet,
      stderrSnippet,
      commitHash,
      branch,
      changedFiles,
      pullRequestUrl,
      markCompletedIfVerified = true,
      idempotencyKey,
    } = req.body;

    if (!command) {
      res.status(400).json({ success: false, error: { code: 'INVALID_INPUT', message: 'Command is required' } });
      return;
    }

    const task = await resolveCanonicalTask(taskId);

    if (!task) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Task not found' } });
      return;
    }

    const membership = await verifyWorkspaceMembership(userId, task.workspaceId);
    if (!membership.allowed) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } });
      return;
    }

    // Idempotency: Return existing evidence if duplicate submission sent within 30s
    if (idempotencyKey) {
      const recentEvidence = await prisma.taskEvidence.findFirst({
        where: {
          taskId: task.id,
          userId,
          command: command.trim(),
          exitCode: Number(exitCode),
          executedAt: { gte: new Date(Date.now() - 30 * 1000) },
        },
        orderBy: { executedAt: 'desc' },
      });

      if (recentEvidence) {
        res.status(200).json({
          success: true,
          data: {
            evidence: recentEvidence,
            isVerified: task.isVerified,
            status: task.status,
            missingCriteria: [],
            message: 'Idempotent submission: verified record already processed.',
          },
        });
        return;
      }
    }

    const status = exitCode === 0 ? 'PASSED' : 'FAILED';

    // 1. Create TaskEvidence record
    const evidence = await prisma.taskEvidence.create({
      data: {
        taskId: task.id,
        userId,
        command: command.trim(),
        exitCode: Number(exitCode),
        stdoutSnippet: stdoutSnippet ? String(stdoutSnippet).slice(0, 4000) : null,
        stderrSnippet: stderrSnippet ? String(stderrSnippet).slice(0, 4000) : null,
        commitHash: commitHash ? String(commitHash).trim() : null,
        branch: branch ? String(branch).trim() : null,
        changedFiles: changedFiles || undefined,
        pullRequestUrl: pullRequestUrl ? String(pullRequestUrl).trim() : null,
        status,
      },
    });

    // 2. Evaluate Server-Side Completion Policy:
    // Criteria:
    // A) Exit code of submitted check must be 0
    // B) If acceptance criteria are defined, all items must be marked isCompleted: true
    const criteriaList = (task.acceptanceCriteria as Array<{ id: string; text: string; isCompleted: boolean }>) || [];
    const missingCriteria = criteriaList.filter((c) => !c.isCompleted).map((c) => c.text);
    const checksPassed = exitCode === 0;
    const allCriteriaSatisfied = missingCriteria.length === 0;

    const isVerified = checksPassed && allCriteriaSatisfied;

    let updatedTask: any = task;

    if (isVerified && markCompletedIfVerified) {
      updatedTask = await prisma.task.update({
        where: { id: task.id },
        data: {
          isVerified: true,
          verifiedAt: new Date(),
          status: 'DONE',
          completedAt: new Date(),
          claimedById: null, // Release claim upon successful completion
          leaseExpiresAt: null,
        },
      });

      await prisma.taskActivity.create({
        data: {
          taskId: task.id,
          userId,
          action: 'TASK_VERIFIED_COMPLETE',
          metadata: {
            evidenceId: evidence.id,
            command,
            commitHash,
            branch,
          },
        },
      });

      broadcastTaskEvent('TASK_VERIFIED', task.workspaceId, {
        taskId: task.id,
        status: 'DONE',
        isVerified: true,
        evidenceId: evidence.id,
      });
    }

    res.status(201).json({
      success: true,
      data: {
        evidence,
        isVerified,
        status: updatedTask.status,
        missingCriteria,
        message: isVerified
          ? 'Task verified complete! All checks passed and acceptance criteria satisfied.'
          : checksPassed
          ? `Checks passed, but ${missingCriteria.length} acceptance criteria remain incomplete.`
          : `Validation check failed with exit code ${exitCode}.`,
      },
    });
  } catch (error) {
    console.error('Error submitting task execution evidence:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to submit evidence' } });
  }
});

/**
 * GET /api/tasks/:id/evidence
 * List execution evidence submissions for a task
 */
router.get('/:id/evidence', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const taskId = req.params.id as string;

    const task = await resolveCanonicalTask(taskId);

    if (!task) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Task not found' } });
      return;
    }

    const membership = await verifyWorkspaceMembership(userId, task.workspaceId);
    if (!membership.allowed) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } });
      return;
    }

    const evidence = await prisma.taskEvidence.findMany({
      where: { taskId: task.id },
      include: {
        user: { select: { id: true, displayName: true, email: true } },
      },
      orderBy: { executedAt: 'desc' },
    });

    res.json({
      success: true,
      data: { evidence },
    });
  } catch (error) {
    console.error('Error fetching task evidence:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch evidence' } });
  }
});

/**
 * GET /api/tasks/:id/eligibility
 * Check whether a task satisfies all requirements to transition to DONE
 */
router.get('/:id/eligibility', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const taskId = req.params.id as string;

    const task = await resolveCanonicalTask(taskId, {
      claimedBy: { select: { id: true, displayName: true, email: true } },
      project: { select: { id: true, name: true } },
      blockedBy: {
        include: {
          blockingTask: { select: { id: true, title: true, status: true } },
        },
      },
    });

    if (!task) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Task not found' } });
      return;
    }

    const membership = await verifyWorkspaceMembership(userId, task.workspaceId);
    if (!membership.allowed) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } });
      return;
    }

    const latestEvidence = await prisma.taskEvidence.findFirst({
      where: { taskId: task.id },
      orderBy: { executedAt: 'desc' },
    });

    const criteria = (task.acceptanceCriteria as Array<{ id: string; text: string; isCompleted: boolean }>) || [];
    const missingCriteria = criteria.filter((c) => !c.isCompleted).map((c) => c.text);
    const blockers = (task.blockedBy || [])
      .filter((b: any) => b.blockingTask.status !== 'DONE')
      .map((b: any) => `[${b.blockingTask.status}] ${b.blockingTask.title}`);

    const hasPassingCheck = Boolean(latestEvidence && latestEvidence.status === 'PASSED' && latestEvidence.exitCode === 0);
    const allCriteriaSatisfied = criteria.length === 0 || missingCriteria.length === 0;
    const isBlocked = blockers.length > 0;
    const isCompleted = task.status === 'DONE';
    const eligible = !isBlocked && !isCompleted && hasPassingCheck && allCriteriaSatisfied;

    const claimer = (task as any).claimedBy;
    const isClaimed = Boolean(task.claimedById);

    res.json({
      success: true,
      data: {
        task: {
          id: task.id,
          title: task.title,
          status: task.status,
          priority: task.priority,
          isVerified: task.isVerified,
          verifiedAt: task.verifiedAt,
        },
        eligible,
        missingCriteria,
        hasPassingCheck,
        latestEvidence,
        blockers,
        claim: {
          isClaimed,
          claimedByMe: task.claimedById === userId,
          claimedByName: claimer?.displayName,
          leaseExpiresAt: task.leaseExpiresAt,
        },
        requirements: {
          criteriaConfigured: criteria.length > 0,
          criteriaCount: criteria.length,
          criteriaCompletedCount: criteria.filter((c) => c.isCompleted).length,
        },
      },
    });
  } catch (error: any) {
    console.error('Error checking task completion eligibility:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to check eligibility' } });
  }
});

/**
 * POST /api/tasks/:id/submit-review
 * Submit task for review (transitions to IN_REVIEW)
 */
router.post('/:id/submit-review', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const taskId = req.params.id as string;
    const { notes, prUrl } = req.body;

    const task = await resolveCanonicalTask(taskId);
    if (!task) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Task not found' } });
      return;
    }

    const membership = await verifyWorkspaceMembership(userId, task.workspaceId);
    if (!membership.allowed) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } });
      return;
    }

    const updatedTask = await prisma.task.update({
      where: { id: task.id },
      data: {
        status: 'IN_REVIEW',
      },
      include: {
        assignee: { select: { id: true, displayName: true, email: true } },
      },
    });

    await prisma.taskActivity.create({
      data: {
        taskId: task.id,
        userId,
        action: 'SUBMITTED_FOR_REVIEW',
        metadata: { notes: notes || 'Submitted for code and verification review', prUrl },
      },
    });

    broadcastTaskEvent('TASK_UPDATED', task.workspaceId, {
      taskId: task.id,
      status: 'IN_REVIEW',
    });

    res.json({
      success: true,
      data: {
        task: updatedTask,
        message: 'Task submitted for review successfully',
      },
    });
  } catch (error: any) {
    console.error('Submit for review error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to submit task for review' } });
  }
});

export default router;
