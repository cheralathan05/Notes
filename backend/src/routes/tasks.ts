import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';
import { getOrCreateUserWorkspace, verifyWorkspaceMembership } from '../lib/workspace';
import { TaskStatus, TaskPriority } from '@prisma/client';

const router = Router();
router.use(authMiddleware);

// ─── GET /api/tasks (List workspace tasks) ───────────────────────────────────
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const ws = await getOrCreateUserWorkspace(userId);
    const { documentId, status } = req.query;

    const where: any = {
      workspaceId: ws.workspaceId,
    };

    if (documentId && typeof documentId === 'string') {
      where.documentId = documentId;
    }

    if (status && typeof status === 'string') {
      where.status = status as TaskStatus;
    }

    const tasks = await prisma.task.findMany({
      where,
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      include: {
        creator: { select: { id: true, displayName: true, email: true } },
        assignee: { select: { id: true, displayName: true, email: true } },
        document: { select: { id: true, title: true, icon: true } },
      },
    });

    res.json({
      success: true,
      data: { tasks },
    });
  } catch (error) {
    console.error('List tasks error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to list tasks' },
    });
  }
});

// ─── POST /api/tasks (Create a task linked to document) ──────────────────────
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const ws = await getOrCreateUserWorkspace(userId);
    const { title, description, priority = 'MEDIUM', dueDate, documentId, assigneeId } = req.body;

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Task title is required' },
      });
      return;
    }

    const task = await prisma.task.create({
      data: {
        workspaceId: ws.workspaceId,
        creatorId: userId,
        assigneeId: assigneeId || null,
        documentId: documentId || null,
        title: title.trim(),
        description: description?.trim() || null,
        priority: (priority as TaskPriority) || 'MEDIUM',
        dueDate: dueDate ? new Date(dueDate) : null,
        status: 'TODO',
      },
      include: {
        creator: { select: { id: true, displayName: true, email: true } },
        document: { select: { id: true, title: true, icon: true } },
      },
    });

    if (documentId) {
      await prisma.documentActivity.create({
        data: {
          documentId,
          userId,
          action: 'CREATED_TASK',
          metadata: { taskId: task.id, title: task.title },
        },
      });
    }

    res.status(201).json({
      success: true,
      data: { task },
    });
  } catch (error) {
    console.error('Create task error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to create task' },
    });
  }
});

// ─── POST /api/documents/:id/tasks/batch (Notes-to-Tasks Batch Creation) ─────
router.post('/batch', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const ws = await getOrCreateUserWorkspace(userId);
    const { tasks: items, documentId } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Array of tasks is required' },
      });
      return;
    }

    const createdTasks = [];
    for (const item of items) {
      if (!item.title || typeof item.title !== 'string') continue;

      const created = await prisma.task.create({
        data: {
          workspaceId: ws.workspaceId,
          creatorId: userId,
          documentId: documentId || null,
          title: item.title.trim(),
          description: item.description?.trim() || null,
          priority: item.priority || 'MEDIUM',
          dueDate: item.dueDate ? new Date(item.dueDate) : null,
          status: 'TODO',
        },
      });
      createdTasks.push(created);
    }

    if (documentId && createdTasks.length > 0) {
      await prisma.documentActivity.create({
        data: {
          documentId,
          userId,
          action: 'EXTRACTED_TASKS_FROM_NOTES',
          metadata: { taskCount: createdTasks.length },
        },
      });
    }

    res.status(201).json({
      success: true,
      data: {
        createdCount: createdTasks.length,
        tasks: createdTasks,
      },
    });
  } catch (error) {
    console.error('Batch create tasks error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to create batch tasks' },
    });
  }
});

// ─── PATCH /api/tasks/:id (Update task status or details) ────────────────────
router.patch('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const id = req.params.id as string;
    const { status, title, description, priority, dueDate } = req.body;

    const task = await prisma.task.findUnique({
      where: { id },
    });

    if (!task) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Task not found' },
      });
      return;
    }

    const updateData: any = {};
    if (status !== undefined) updateData.status = status;
    if (title !== undefined) updateData.title = title.trim();
    if (description !== undefined) updateData.description = description?.trim() || null;
    if (priority !== undefined) updateData.priority = priority;
    if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null;

    const updated = await prisma.task.update({
      where: { id },
      data: updateData,
    });

    res.json({
      success: true,
      data: { task: updated },
    });
  } catch (error) {
    console.error('Update task error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to update task' },
    });
  }
});

export default router;
