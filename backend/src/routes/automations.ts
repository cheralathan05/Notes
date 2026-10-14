import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { getOrCreateUserWorkspace } from '../lib/workspace';
import { automationService } from '../lib/automation-service';

const router = Router();
router.use(authMiddleware);

// ─── GET /api/automations ────────────────────────────────────────────────────
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const ws = await getOrCreateUserWorkspace(userId);

    const automations = await automationService.getAutomations(ws.workspaceId);

    res.json({
      success: true,
      data: { automations },
    });
  } catch (error: any) {
    console.error('Get automations error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message || 'Failed to fetch automations' },
    });
  }
});

// ─── POST /api/automations ───────────────────────────────────────────────────
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const ws = await getOrCreateUserWorkspace(userId);
    const { name, description, triggerType, triggerConfig, conditions, actions, isEnabled } = req.body;

    if (!name || !triggerType || !actions || !Array.isArray(actions)) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Name, triggerType, and actions array are required' },
      });
      return;
    }

    const automation = await automationService.createAutomation(ws.workspaceId, userId, {
      name,
      description,
      triggerType,
      triggerConfig,
      conditions,
      actions,
      isEnabled,
    });

    res.status(201).json({
      success: true,
      data: { automation },
    });
  } catch (error: any) {
    console.error('Create automation error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message || 'Failed to create automation' },
    });
  }
});

// ─── PATCH /api/automations/:id/toggle ───────────────────────────────────────
router.patch('/:id/toggle', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const ws = await getOrCreateUserWorkspace(userId);
    const automationId = req.params.id as string;
    const { isEnabled } = req.body;

    const automation = await automationService.toggleAutomation(
      automationId,
      ws.workspaceId,
      Boolean(isEnabled)
    );

    res.json({
      success: true,
      data: { automation },
    });
  } catch (error: any) {
    console.error('Toggle automation error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message || 'Failed to toggle automation' },
    });
  }
});

// ─── DELETE /api/automations/:id ─────────────────────────────────────────────
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const ws = await getOrCreateUserWorkspace(userId);
    const automationId = req.params.id as string;

    const result = await automationService.deleteAutomation(automationId, ws.workspaceId);

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('Delete automation error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message || 'Failed to delete automation' },
    });
  }
});

export default router;
