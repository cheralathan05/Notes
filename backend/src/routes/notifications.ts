import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { extractRequestedWorkspaceId, getOrCreateUserWorkspace } from '../lib/workspace';
import { notificationsService } from '../lib/notifications-service';

const router = Router();
router.use(authMiddleware);

// ─── GET /api/notifications ──────────────────────────────────────────────────
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const requestedWsId = extractRequestedWorkspaceId(req);
    const ws = await getOrCreateUserWorkspace(userId, requestedWsId);
    const { unreadOnly, limit, offset, allWorkspaces } = req.query;

    // By default, if allWorkspaces is requested or no workspace param is passed, we can fetch all or current
    const targetWsId = allWorkspaces === 'true' ? undefined : ws.workspaceId;

    const data = await notificationsService.getUserNotifications(targetWsId, userId, {
      unreadOnly: unreadOnly === 'true',
      limit: limit ? parseInt(String(limit), 10) : 20,
      offset: offset ? parseInt(String(offset), 10) : 0,
    });

    res.json({
      success: true,
      data,
    });
  } catch (error: any) {
    console.error('Get notifications error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message || 'Failed to fetch notifications' },
    });
  }
});

// ─── PATCH /api/notifications/:id/read ───────────────────────────────────────
router.patch('/:id/read', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const notificationId = req.params.id as string;

    const notification = await notificationsService.markAsRead(notificationId, userId);

    res.json({
      success: true,
      data: { notification },
    });
  } catch (error: any) {
    console.error('Mark read error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message || 'Failed to mark notification as read' },
    });
  }
});

// ─── POST /api/notifications/mark-all-read ───────────────────────────────────
router.post('/mark-all-read', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const requestedWsId = extractRequestedWorkspaceId(req);
    const ws = await getOrCreateUserWorkspace(userId, requestedWsId);

    const result = await notificationsService.markAllAsRead(ws.workspaceId, userId);

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('Mark all read error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message || 'Failed to mark all as read' },
    });
  }
});

export default router;
