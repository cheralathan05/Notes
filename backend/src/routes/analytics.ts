import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { resolveWorkspaceContext } from '../lib/workspace';
import { analyticsService } from '../lib/analytics-service';

const router = Router();
router.use(authMiddleware);

// ─── GET /api/analytics/command-center ───────────────────────────────────────
router.get('/command-center', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const ws = await resolveWorkspaceContext(req);

    const data = await analyticsService.getDailyCommandCenter(ws.workspaceId, userId);

    res.json({
      success: true,
      data,
    });
  } catch (error: any) {
    console.error('Command center analytics error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message || 'Failed to aggregate command center data' },
    });
  }
});

// ─── GET /api/analytics/workspace ────────────────────────────────────────────
router.get('/workspace', async (req: Request, res: Response): Promise<void> => {
  try {
    const ws = await resolveWorkspaceContext(req);
    const { projectId, dateRange } = req.query;

    const data = await analyticsService.getWorkspaceAnalytics(ws.workspaceId, {
      projectId: typeof projectId === 'string' && projectId !== 'ALL' ? projectId : undefined,
      dateRange: typeof dateRange === 'string' ? dateRange : undefined,
    });

    res.json({
      success: true,
      data,
    });
  } catch (error: any) {
    console.error('Workspace analytics error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message || 'Failed to calculate analytics' },
    });
  }
});

export default router;
