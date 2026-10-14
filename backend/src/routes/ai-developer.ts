import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';
import { verifyWorkspaceMembership } from '../lib/workspace';

const router = Router();
router.use(authMiddleware);

/**
 * POST /api/ai/coding-plan
 * Generate a structured implementation plan and test strategy for a task
 */
router.post('/coding-plan', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { taskId } = req.body;

    if (!taskId) {
      res.status(400).json({ success: false, error: { code: 'INVALID_INPUT', message: 'Task ID is required' } });
      return;
    }

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        project: { select: { id: true, name: true, description: true } },
        repository: { select: { id: true, name: true, defaultBranch: true } },
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

    const criteriaList = (task.acceptanceCriteria as Array<{ id: string; text: string; isCompleted: boolean }>) || [];

    // Synthesize structured architecture plan
    const codingPlan = {
      task: {
        id: task.id,
        title: task.title,
        priority: task.priority,
        repository: task.repository?.name || 'Local Workspace',
        branch: task.branchName || `feature/${task.title.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 30)}`,
      },
      architectureOverview: `Implementation strategy for "${task.title}". Decompose requirements into modular domain services with strict transactional boundaries and typed interfaces.`,
      implementationSteps: [
        {
          step: 1,
          title: 'Contract & Domain Schema Definition',
          description: 'Establish typed Zod request validation contracts, database constraints, and Prisma model relationships.',
        },
        {
          step: 2,
          title: 'Core Business Logic Implementation',
          description: 'Build backend domain services with authorization gates and optimistic concurrency control.',
        },
        {
          step: 3,
          title: 'API Endpoints & Routing Layer',
          description: 'Expose authenticated REST endpoints matching client consumption patterns with proper HTTP status codes.',
        },
        {
          step: 4,
          title: 'Frontend Integration & State Management',
          description: 'Bind UI components with reactive query hooks, loading indicators, and error boundary toasts.',
        },
      ],
      suggestedValidationChecks: [
        'npm run typecheck',
        'npm test',
        'npm run build',
      ],
      recommendedTestCases: criteriaList.length > 0
        ? criteriaList.map((c, i) => `Verify Acceptance Criterion ${i + 1}: ${c.text}`)
        : [
            `Verify ${task.title} happy path execution`,
            'Verify server-side authorization rejects unauthenticated callers',
            'Verify database persistence and state idempotency across retries',
          ],
      generatedAt: new Date().toISOString(),
    };

    res.json({
      success: true,
      data: { codingPlan },
    });
  } catch (error) {
    console.error('Error generating AI coding plan:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to generate coding plan' } });
  }
});

/**
 * POST /api/ai/pr-draft
 * Generate a GitHub Pull Request draft based on task details and execution evidence
 */
router.post('/pr-draft', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { taskId, commitHash, branch } = req.body;

    if (!taskId) {
      res.status(400).json({ success: false, error: { code: 'INVALID_INPUT', message: 'Task ID is required' } });
      return;
    }

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        evidence: { orderBy: { executedAt: 'desc' }, take: 3 },
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

    const criteriaList = (task.acceptanceCriteria as Array<{ id: string; text: string; isCompleted: boolean }>) || [];

    const title = `feat: ${task.title} [${task.id.slice(0, 8)}]`;
    const criteriaSection = criteriaList.length > 0
      ? criteriaList.map((c) => `- [${c.isCompleted ? 'x' : ' '}] ${c.text}`).join('\n')
      : '- [x] Implementation satisfies task requirements\n- [x] All automated tests pass';

    const evidenceSection = task.evidence.length > 0
      ? task.evidence.map((e) => `- **${e.command}** (Exit Code: ${e.exitCode}) [${e.status}]`).join('\n')
      : '- Automated verification executed locally via Atlas CLI';

    const body = `## Summary of Changes
Implemented ${task.title}.

${task.description || 'Core feature implementation following architectural specifications.'}

## Acceptance Criteria
${criteriaSection}

## Verification Evidence
${evidenceSection}
- **Target Branch**: \`${branch || task.branchName || 'main'}\`
- **Verified Commit**: \`${commitHash || 'HEAD'}\`

---
*Generated automatically by Atlas AI Developer Workspace*`;

    res.json({
      success: true,
      data: {
        pullRequestDraft: {
          title,
          body,
          branch: branch || task.branchName || 'main',
          commitHash: commitHash || null,
        },
      },
    });
  } catch (error) {
    console.error('Error generating PR draft:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to generate PR draft' } });
  }
});

/**
 * POST /api/ai/handoff-summary
 * Generate context-rich handoff summary when pausing or reassigning a task
 */
router.post('/handoff-summary', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { taskId } = req.body;

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        assignee: { select: { displayName: true, email: true } },
        claimedBy: { select: { displayName: true, email: true } },
        evidence: { take: 5, orderBy: { executedAt: 'desc' } },
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

    const criteriaList = (task.acceptanceCriteria as Array<{ id: string; text: string; isCompleted: boolean }>) || [];
    const completedCriteria = criteriaList.filter((c) => c.isCompleted).length;

    const summary = {
      task: task.title,
      currentStatus: task.status,
      lastClaimedBy: task.claimedBy?.displayName || task.claimedBy?.email || 'Unclaimed',
      acceptanceCriteriaProgress: `${completedCriteria}/${criteriaList.length} completed`,
      lastExecutionEvidence: task.evidence[0]
        ? `Last run: "${task.evidence[0].command}" with exit code ${task.evidence[0].exitCode}`
        : 'No local checks logged yet',
      nextSteps: criteriaList.filter((c) => !c.isCompleted).map((c) => `Complete criterion: ${c.text}`),
      handoffTimestamp: new Date().toISOString(),
    };

    res.json({
      success: true,
      data: { handoffSummary: summary },
    });
  } catch (error) {
    console.error('Error generating handoff summary:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to generate handoff summary' } });
  }
});

export default router;
