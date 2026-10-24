import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { resolveWorkspaceContext } from '../lib/workspace';
import { focusService } from '../lib/focus-service';

const router = Router();
router.use(authMiddleware);

// ─── GET /api/focus/active ───────────────────────────────────────────────────
router.get('/active', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const ws = await resolveWorkspaceContext(req);

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
    const ws = await resolveWorkspaceContext(req);
    const { taskId, title, targetMinutes, notes } = req.body;

    if (!title || typeof title !== 'string') {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Session title is required' },
      });
      return;
    }

    const session = await focusService.startFocusSession(ws.workspaceId, userId, {
      taskId: taskId || undefined,
      title,
      targetMinutes: targetMinutes ? parseInt(String(targetMinutes), 10) : 25,
      notes: notes || undefined,
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
    const { notes, distractions } = req.body;

    const session = await focusService.completeFocusSession(sessionId, userId, {
      notes,
      distractions: typeof distractions === 'number' ? distractions : undefined,
    });

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

// ─── POST /api/focus/:id/cancel ──────────────────────────────────────────────
router.post('/:id/cancel', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const sessionId = req.params.id as string;

    const session = await focusService.cancelFocusSession(sessionId, userId);

    res.json({
      success: true,
      data: { session },
    });
  } catch (error: any) {
    console.error('Cancel focus session error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message || 'Failed to cancel session' },
    });
  }
});

// ─── POST /api/focus/:id/distraction ─────────────────────────────────────────
router.post('/:id/distraction', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const sessionId = req.params.id as string;
    const { note } = req.body;

    const session = await focusService.recordDistraction(sessionId, userId, { note });

    res.json({
      success: true,
      data: { session },
    });
  } catch (error: any) {
    console.error('Record distraction error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message || 'Failed to record distraction' },
    });
  }
});

// ─── GET /api/focus/totals ───────────────────────────────────────────────────
router.get('/totals', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const ws = await resolveWorkspaceContext(req);

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

// ─── GET /api/focus/history ──────────────────────────────────────────────────
router.get('/history', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const ws = await resolveWorkspaceContext(req);
    const { limit, taskId } = req.query;

    const sessions = await focusService.getSessionHistory(ws.workspaceId, userId, {
      limit: limit ? parseInt(String(limit), 10) : 20,
      taskId: taskId ? String(taskId) : undefined,
    });

    res.json({
      success: true,
      data: { sessions },
    });
  } catch (error: any) {
    console.error('Get history error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message || 'Failed to fetch session history' },
    });
  }
});

// ─── GET /api/focus/sessions ─────────────────────────────────────────────────
router.get('/sessions', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const ws = await resolveWorkspaceContext(req);
    const { limit, taskId } = req.query;

    const sessions = await focusService.getSessionHistory(ws.workspaceId, userId, {
      limit: limit ? parseInt(String(limit), 10) : 20,
      taskId: taskId ? String(taskId) : undefined,
    });

    res.json({
      success: true,
      data: { sessions },
    });
  } catch (error: any) {
    console.error('Get sessions error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message || 'Failed to fetch sessions' },
    });
  }
});

// ─── GET /api/focus/entries ──────────────────────────────────────────────────
router.get('/entries', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const ws = await resolveWorkspaceContext(req);
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
