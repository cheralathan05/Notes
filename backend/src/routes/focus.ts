import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { getOrCreateUserWorkspace } from '../lib/workspace';
import { focusService } from '../lib/focus-service';

const router = Router();
router.use(authMiddleware);

// ─── GET /api/focus/active ───────────────────────────────────────────────────
router.get('/active', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const ws = await getOrCreateUserWorkspace(userId);

    const session = await focusService.getActiveSession(ws.workspaceId, userId);

    res.json({
      success: true,
      data: { session },
    });
  } catch (error: any) {
    console.error('Get active session error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message || 'Failed to fetch active session' },
    });
  }
});

// ─── POST /api/focus/start ───────────────────────────────────────────────────
router.post('/start', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const ws = await getOrCreateUserWorkspace(userId);
    const { taskId, title, targetMinutes } = req.body;

    if (!title || typeof title !== 'string') {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Session title is required' },
      });
      return;
    }

    const session = await focusService.startFocusSession(ws.workspaceId, userId, {
      taskId,
      title,
      targetMinutes: targetMinutes ? parseInt(targetMinutes, 10) : 25,
    });

    res.status(201).json({
      success: true,
      data: { session },
    });
  } catch (error: any) {
    console.error('Start focus session error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message || 'Failed to start focus session' },
    });
  }
});

// ─── POST /api/focus/:id/pause ───────────────────────────────────────────────
router.post('/:id/pause', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const sessionId = req.params.id as string;

    const session = await focusService.pauseFocusSession(sessionId, userId);

    res.json({
      success: true,
      data: { session },
    });
  } catch (error: any) {
    console.error('Pause focus session error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message || 'Failed to pause session' },
    });
  }
});

// ─── POST /api/focus/:id/resume ──────────────────────────────────────────────
router.post('/:id/resume', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const sessionId = req.params.id as string;

    const session = await focusService.resumeFocusSession(sessionId, userId);

    res.json({
      success: true,
      data: { session },
    });
  } catch (error: any) {
    console.error('Resume focus session error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message || 'Failed to resume session' },
    });
  }
});

// ─── POST /api/focus/:id/complete ────────────────────────────────────────────
router.post('/:id/complete', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const sessionId = req.params.id as string;
    const { notes } = req.body;

    const session = await focusService.completeFocusSession(sessionId, userId, { notes });

    res.json({
      success: true,
      data: { session },
    });
  } catch (error: any) {
    console.error('Complete focus session error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message || 'Failed to complete session' },
    });
  }
});

// ─── GET /api/focus/totals ───────────────────────────────────────────────────
router.get('/totals', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const ws = await getOrCreateUserWorkspace(userId);

    const totals = await focusService.getDailyWeeklyTotals(ws.workspaceId, userId);

    res.json({
      success: true,
      data: totals,
    });
  } catch (error: any) {
    console.error('Get totals error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message || 'Failed to fetch focus totals' },
    });
  }
});

// ─── GET /api/focus/entries ──────────────────────────────────────────────────
router.get('/entries', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const ws = await getOrCreateUserWorkspace(userId);
    const { taskId, projectId } = req.query;

    const entries = await focusService.getTimeEntries(ws.workspaceId, userId, {
      taskId: taskId ? String(taskId) : undefined,
      projectId: projectId ? String(projectId) : undefined,
    });

    res.json({
      success: true,
      data: { entries },
    });
  } catch (error: any) {
    console.error('Get time entries error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message || 'Failed to fetch time entries' },
    });
  }
});

export default router;
