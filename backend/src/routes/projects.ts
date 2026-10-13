import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { getOrCreateUserWorkspace } from '../lib/workspace';
import { projectsService } from '../lib/projects-service';
import { ProjectStatus } from '@prisma/client';

const router = Router();
router.use(authMiddleware);

// ─── GET /api/projects (List projects) ────────────────────────────────────────
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const ws = await getOrCreateUserWorkspace(userId);
    const { status } = req.query;

    const projects = await projectsService.listProjects(
      ws.workspaceId,
      status ? (status as ProjectStatus) : undefined
    );

    res.json({
      success: true,
      data: { projects },
    });
  } catch (error: any) {
    console.error('List projects error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message || 'Failed to list projects' },
    });
  }
});

// ─── POST /api/projects (Create project) ──────────────────────────────────────
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const ws = await getOrCreateUserWorkspace(userId);
    const { name, description, startDate, targetDate } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Project name is required' },
      });
      return;
    }

    const project = await projectsService.createProject(userId, ws.workspaceId, {
      name: name.trim(),
      description: description?.trim(),
      startDate: startDate ? new Date(startDate) : undefined,
      targetDate: targetDate ? new Date(targetDate) : undefined,
    });

    res.status(201).json({
      success: true,
      data: { project },
    });
  } catch (error: any) {
    console.error('Create project error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message || 'Failed to create project' },
    });
  }
});

// ─── GET /api/projects/:id (Get project details) ──────────────────────────────
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const project = await projectsService.getProjectById(id);

    if (!project) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Project not found' },
      });
      return;
    }

    res.json({
      success: true,
      data: { project },
    });
  } catch (error: any) {
    console.error('Get project error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message || 'Failed to get project' },
    });
  }
});

// ─── PATCH /api/projects/:id (Update project) ─────────────────────────────────
router.patch('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const userId = req.userId!;
    const ws = await getOrCreateUserWorkspace(userId);
    const { name, description, status, targetDate } = req.body;

    const updated = await projectsService.updateProject(id, ws.workspaceId, {
      name: name?.trim(),
      description: description?.trim(),
      status: status ? (status as ProjectStatus) : undefined,
      targetDate: targetDate ? new Date(targetDate) : undefined,
    });

    res.json({
      success: true,
      data: { project: updated },
    });
  } catch (error: any) {
    console.error('Update project error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message || 'Failed to update project' },
    });
  }
});

// ─── DELETE /api/projects/:id (Delete project) ────────────────────────────────
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const userId = req.userId!;
    const ws = await getOrCreateUserWorkspace(userId);

    await projectsService.deleteProject(id, ws.workspaceId);

    res.json({
      success: true,
      data: { deleted: true },
    });
  } catch (error: any) {
    console.error('Delete project error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message || 'Failed to delete project' },
    });
  }
});

// ─── POST /api/projects/:id/progress (Recalculate progress) ───────────────────
router.post('/:id/progress', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const metrics = await projectsService.recalculateProjectProgress(id);

    res.json({
      success: true,
      data: metrics,
    });
  } catch (error: any) {
    console.error('Recalculate progress error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message || 'Failed to recalculate project progress' },
    });
  }
});

// ─── POST /api/projects/:id/milestones (Add milestone) ────────────────────────
router.post('/:id/milestones', async (req: Request, res: Response): Promise<void> => {
  try {
    const projectId = req.params.id as string;
    const { title, description, targetDate } = req.body;

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Milestone title is required' },
      });
      return;
    }

    const milestone = await projectsService.addMilestone(projectId, {
      title: title.trim(),
      description: description?.trim(),
      dueDate: targetDate ? new Date(targetDate) : undefined,
    });

    res.status(201).json({
      success: true,
      data: { milestone },
    });
  } catch (error: any) {
    console.error('Add milestone error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message || 'Failed to add milestone' },
    });
  }
});

// ─── PATCH /api/projects/:id/milestones/:mId (Update milestone) ───────────────
router.patch('/:id/milestones/:mId', async (req: Request, res: Response): Promise<void> => {
  try {
    const milestoneId = req.params.mId as string;
    const { isCompleted, title, targetDate } = req.body;

    const milestone = await projectsService.updateMilestone(milestoneId, {
      isCompleted: typeof isCompleted === 'boolean' ? isCompleted : undefined,
      title: title?.trim(),
      dueDate: targetDate ? new Date(targetDate) : undefined,
    });

    res.json({
      success: true,
      data: { milestone },
    });
  } catch (error: any) {
    console.error('Update milestone error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message || 'Failed to update milestone' },
    });
  }
});

export default router;
