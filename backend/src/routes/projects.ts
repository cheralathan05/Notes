import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';
import { verifyWorkspaceMembership, getOrCreateUserWorkspace } from '../lib/workspace';
import { projectsService, ProjectFilterOptions } from '../lib/projects-service';
import { ProjectStatus } from '@prisma/client';

const router = Router();
router.use(authMiddleware);

// ─── GET /api/projects (List projects with filters & search) ──────────────────
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    let workspaceId = (req.query.workspaceId as string) || (req.headers['x-workspace-id'] as string) || req.workspaceId;

    if (workspaceId) {
      const membership = await verifyWorkspaceMembership(userId, workspaceId);
      if (!membership.allowed) {
        res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied to workspace' } });
        return;
      }
    } else {
      const ws = await getOrCreateUserWorkspace(userId);
      workspaceId = ws.workspaceId;
    }

    const { status, search, includeArchived, sortBy, sortOrder } = req.query;

    const validStatuses = ['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'ARCHIVED'];
    let safeStatus: ProjectStatus | undefined = undefined;
    if (typeof status === 'string') {
      const upper = status.trim().toUpperCase();
      if (validStatuses.includes(upper)) {
        safeStatus = upper as ProjectStatus;
      }
    }

    const filterOptions: ProjectFilterOptions = {
      status: safeStatus,
      search: search && typeof search === 'string' ? search.trim() : undefined,
      includeArchived: includeArchived === 'true',
      sortBy: sortBy && typeof sortBy === 'string' ? (sortBy as any) : undefined,
      sortOrder: sortOrder && typeof sortOrder === 'string' ? (sortOrder as any) : undefined,
    };

    const projects = await projectsService.listProjects(workspaceId, filterOptions);

    res.json({
      success: true,
      data: { projects, count: projects.length },
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
    let workspaceId = req.body.workspaceId || (req.headers['x-workspace-id'] as string) || req.workspaceId;

    if (workspaceId) {
      const membership = await verifyWorkspaceMembership(userId, workspaceId);
      if (!membership.allowed) {
        res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied to workspace' } });
        return;
      }
    } else {
      const ws = await getOrCreateUserWorkspace(userId);
      workspaceId = ws.workspaceId;
    }

    const { name, description, color, icon, status, startDate, targetDate } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Project name is required' },
      });
      return;
    }

    const project = await projectsService.createProject(userId, workspaceId, {
      name: name.trim(),
      description: description?.trim(),
      color: color || '#FAFAFA',
      icon: icon || '📁',
      status: status ? (status as ProjectStatus) : 'ACTIVE',
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
    const userId = req.userId!;
    const project = await projectsService.getProjectById(id);

    if (!project) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Project not found' },
      });
      return;
    }

    const membership = await verifyWorkspaceMembership(userId, project.workspaceId);
    if (!membership.allowed) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied to project' } });
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
    
    const existing = await prisma.project.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Project not found' } });
      return;
    }

    const membership = await verifyWorkspaceMembership(userId, existing.workspaceId);
    if (!membership.allowed) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied to project' } });
      return;
    }

    const { name, description, color, icon, status, startDate, targetDate, isArchived } = req.body;

    const updated = await projectsService.updateProject(id, existing.workspaceId, {
      name: name?.trim(),
      description: description !== undefined ? description?.trim() : undefined,
      color: color || undefined,
      icon: icon || undefined,
      status: status ? (status as ProjectStatus) : undefined,
      startDate: startDate ? new Date(startDate) : undefined,
      targetDate: targetDate ? new Date(targetDate) : undefined,
      isArchived: typeof isArchived === 'boolean' ? isArchived : undefined,
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

// ─── POST /api/projects/:id/archive (Non-destructive archive) ─────────────────
router.post('/:id/archive', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const userId = req.userId!;
    
    const existing = await prisma.project.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Project not found' } });
      return;
    }

    const membership = await verifyWorkspaceMembership(userId, existing.workspaceId);
    if (!membership.allowed) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied to project' } });
      return;
    }

    const project = await projectsService.archiveProject(id, existing.workspaceId);

    res.json({
      success: true,
      data: { project, message: 'Project archived successfully' },
    });
  } catch (error: any) {
    console.error('Archive project error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message || 'Failed to archive project' },
    });
  }
});

// ─── POST /api/projects/:id/unarchive (Restore project) ───────────────────────
router.post('/:id/unarchive', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const userId = req.userId!;
    
    const existing = await prisma.project.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Project not found' } });
      return;
    }

    const membership = await verifyWorkspaceMembership(userId, existing.workspaceId);
    if (!membership.allowed) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied to project' } });
      return;
    }

    const project = await projectsService.unarchiveProject(id, existing.workspaceId);

    res.json({
      success: true,
      data: { project, message: 'Project unarchived successfully' },
    });
  } catch (error: any) {
    console.error('Unarchive project error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message || 'Failed to unarchive project' },
    });
  }
});

// ─── DELETE /api/projects/:id (Delete project) ────────────────────────────────
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const userId = req.userId!;
    
    const existing = await prisma.project.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Project not found' } });
      return;
    }

    const membership = await verifyWorkspaceMembership(userId, existing.workspaceId);
    if (!membership.allowed || (membership.role !== 'OWNER' && membership.role !== 'ADMIN')) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Only workspace administrators can delete projects' } });
      return;
    }

    await projectsService.deleteProject(id, existing.workspaceId);

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
    const userId = req.userId!;

    const existing = await prisma.project.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Project not found' } });
      return;
    }

    const membership = await verifyWorkspaceMembership(userId, existing.workspaceId);
    if (!membership.allowed) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied to project' } });
      return;
    }

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
    const userId = req.userId!;

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Project not found' } });
      return;
    }

    const membership = await verifyWorkspaceMembership(userId, project.workspaceId);
    if (!membership.allowed) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied to project workspace' } });
      return;
    }

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
    const projectId = req.params.id as string;
    const milestoneId = req.params.mId as string;
    const userId = req.userId!;

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Project not found' } });
      return;
    }

    const membership = await verifyWorkspaceMembership(userId, project.workspaceId);
    if (!membership.allowed) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied to project workspace' } });
      return;
    }

    const { isCompleted, title, targetDate, description } = req.body;

    const milestone = await projectsService.updateMilestone(milestoneId, {
      isCompleted: typeof isCompleted === 'boolean' ? isCompleted : undefined,
      title: title?.trim(),
      description: description !== undefined ? description?.trim() : undefined,
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

// ─── DELETE /api/projects/:id/milestones/:mId (Delete milestone) ─────────────
router.delete('/:id/milestones/:mId', async (req: Request, res: Response): Promise<void> => {
  try {
    const projectId = req.params.id as string;
    const milestoneId = req.params.mId as string;
    const userId = req.userId!;

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Project not found' } });
      return;
    }

    const membership = await verifyWorkspaceMembership(userId, project.workspaceId);
    if (!membership.allowed) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied to project workspace' } });
      return;
    }

    await projectsService.deleteMilestone(milestoneId);

    res.json({
      success: true,
      data: { deleted: true },
    });
  } catch (error: any) {
    console.error('Delete milestone error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message || 'Failed to delete milestone' },
    });
  }
});

export default router;
