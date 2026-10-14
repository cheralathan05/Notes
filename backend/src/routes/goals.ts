import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { getOrCreateUserWorkspace } from '../lib/workspace';
import { goalsService } from '../lib/goals-service';
import { GoalStatus } from '@prisma/client';

const router = Router();
router.use(authMiddleware);

// ─── GET /api/goals ──────────────────────────────────────────────────────────
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const ws = await getOrCreateUserWorkspace(userId);
    const { status, category, projectId } = req.query;

    const goals = await goalsService.getGoals(ws.workspaceId, {
      status: status as GoalStatus | undefined,
      category: category ? String(category) : undefined,
      projectId: projectId ? String(projectId) : undefined,
    });

    res.json({
      success: true,
      data: { goals },
    });
  } catch (error: any) {
    console.error('Get goals error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message || 'Failed to fetch goals' },
    });
  }
});

// ─── POST /api/goals ─────────────────────────────────────────────────────────
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const ws = await getOrCreateUserWorkspace(userId);
    const { title, description, category, targetValue, currentValue, unit, targetDate, projectId } = req.body;

    if (!title || typeof title !== 'string') {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Goal title is required' },
      });
      return;
    }

    const goal = await goalsService.createGoal(ws.workspaceId, userId, {
      title,
      description,
      category,
      targetValue: targetValue !== undefined ? parseFloat(targetValue) : 100,
      currentValue: currentValue !== undefined ? parseFloat(currentValue) : 0,
      unit,
      targetDate: targetDate ? new Date(targetDate) : undefined,
      projectId,
    });

    res.status(201).json({
      success: true,
      data: { goal },
    });
  } catch (error: any) {
    console.error('Create goal error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message || 'Failed to create goal' },
    });
  }
});

// ─── POST /api/goals/:id/check-in ────────────────────────────────────────────
router.post('/:id/check-in', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const goalId = req.params.id as string;
    const { newValue, note } = req.body;

    if (newValue === undefined || isNaN(Number(newValue))) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Valid newValue is required for check-in' },
      });
      return;
    }

    const result = await goalsService.checkInGoal(goalId, userId, {
      newValue: Number(newValue),
      note,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('Goal check-in error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message || 'Failed to record check-in' },
    });
  }
});

// ─── DELETE /api/goals/:id ───────────────────────────────────────────────────
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const ws = await getOrCreateUserWorkspace(userId);
    const goalId = req.params.id as string;

    const result = await goalsService.deleteGoal(goalId, ws.workspaceId);

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('Delete goal error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message || 'Failed to delete goal' },
    });
  }
});

export default router;
