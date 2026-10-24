import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { resolveWorkspaceContext } from '../lib/workspace';
import { goalsService } from '../lib/goals-service';
import { GoalStatus, KeyResultType, KeyResultStatus } from '@prisma/client';

const router = Router();
router.use(authMiddleware);

// ─── GET /api/goals/metrics ──────────────────────────────────────────────────
router.get('/metrics', async (req: Request, res: Response): Promise<void> => {
  try {
    const ws = await resolveWorkspaceContext(req);
    const metrics = await goalsService.getGoalMetrics(ws.workspaceId);
    res.json({
      success: true,
      data: metrics,
    });
  } catch (error: any) {
    console.error('Get goal metrics error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message || 'Failed to fetch goal metrics' },
    });
  }
});

// ─── GET /api/goals ──────────────────────────────────────────────────────────
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const ws = await resolveWorkspaceContext(req);
    const { status, category, projectId, search } = req.query;

    const goals = await goalsService.getGoals(ws.workspaceId, {
      status: status as GoalStatus | undefined,
      category: category ? String(category) : undefined,
      projectId: projectId ? String(projectId) : undefined,
      search: search ? String(search) : undefined,
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

// ─── GET /api/goals/:id ──────────────────────────────────────────────────────
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const ws = await resolveWorkspaceContext(req);
    const goalId = req.params.id as string;

    const goal = await goalsService.getGoal(goalId, ws.workspaceId);
    if (!goal) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Goal not found' },
      });
      return;
    }

    res.json({
      success: true,
      data: { goal },
    });
  } catch (error: any) {
    console.error('Get goal detail error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message || 'Failed to fetch goal' },
    });
  }
});

// ─── POST /api/goals ─────────────────────────────────────────────────────────
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const ws = await resolveWorkspaceContext(req);
    const {
      title,
      description,
      category,
      targetValue,
      currentValue,
      unit,
      targetDate,
      timePeriod,
      ownerId,
      projectId,
      status,
      keyResults,
    } = req.body;

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
      timePeriod,
      ownerId: ownerId || undefined,
      projectId: projectId || undefined,
      status: status || undefined,
      keyResults: Array.isArray(keyResults) ? keyResults : undefined,
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

// ─── PATCH /api/goals/:id ────────────────────────────────────────────────────
router.patch('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const ws = await resolveWorkspaceContext(req);
    const goalId = req.params.id as string;
    const {
      title,
      description,
      category,
      status,
      targetValue,
      currentValue,
      unit,
      targetDate,
      timePeriod,
      ownerId,
      projectId,
    } = req.body;

    const goal = await goalsService.updateGoal(goalId, ws.workspaceId, {
      title,
      description,
      category,
      status,
      targetValue: targetValue !== undefined ? parseFloat(targetValue) : undefined,
      currentValue: currentValue !== undefined ? parseFloat(currentValue) : undefined,
      unit,
      targetDate: targetDate ? new Date(targetDate) : undefined,
      timePeriod,
      ownerId,
      projectId,
    });

    res.json({
      success: true,
      data: { goal },
    });
  } catch (error: any) {
    console.error('Update goal error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message || 'Failed to update goal' },
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

// ─── POST /api/goals/:id/key-results ─────────────────────────────────────────
router.post('/:id/key-results', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const ws = await resolveWorkspaceContext(req);
    const goalId = req.params.id as string;
    const { title, description, type, startValue, targetValue, currentValue, unit, weight, ownerId, dueDate } = req.body;

    if (!title || typeof title !== 'string') {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Key result title is required' },
      });
      return;
    }

    const keyResult = await goalsService.addKeyResult(goalId, ws.workspaceId, userId, {
      title,
      description,
      type: type as KeyResultType | undefined,
      startValue: startValue !== undefined ? parseFloat(startValue) : 0,
      targetValue: targetValue !== undefined ? parseFloat(targetValue) : 100,
      currentValue: currentValue !== undefined ? parseFloat(currentValue) : 0,
      unit,
      weight: weight !== undefined ? parseFloat(weight) : 1.0,
      ownerId: ownerId || undefined,
      dueDate: dueDate ? new Date(dueDate) : undefined,
    });

    res.status(201).json({
      success: true,
      data: { keyResult },
    });
  } catch (error: any) {
    console.error('Add key result error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message || 'Failed to add key result' },
    });
  }
});

// ─── PATCH /api/goals/key-results/:krId ──────────────────────────────────────
router.patch('/key-results/:krId', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const ws = await resolveWorkspaceContext(req);
    const keyResultId = req.params.krId as string;
    const { newValue, note, title, status, dueDate } = req.body;

    const result = await goalsService.updateKeyResult(keyResultId, ws.workspaceId, userId, {
      newValue: newValue !== undefined ? parseFloat(newValue) : undefined,
      note,
      title,
      status: status as KeyResultStatus | undefined,
      dueDate: dueDate ? new Date(dueDate) : undefined,
    });

    res.json({
      success: true,
      data: { keyResult: result },
    });
  } catch (error: any) {
    console.error('Update key result error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message || 'Failed to update key result' },
    });
  }
});

// ─── DELETE /api/goals/key-results/:krId ─────────────────────────────────────
router.delete('/key-results/:krId', async (req: Request, res: Response): Promise<void> => {
  try {
    const ws = await resolveWorkspaceContext(req);
    const keyResultId = req.params.krId as string;

    const result = await goalsService.deleteKeyResult(keyResultId, ws.workspaceId);

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('Delete key result error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message || 'Failed to delete key result' },
    });
  }
});

// ─── DELETE /api/goals/:id ───────────────────────────────────────────────────
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const ws = await resolveWorkspaceContext(req);
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
