import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';
import { getOrCreateUserWorkspace } from '../lib/workspace';
import { tasksService, TaskFilterOptions } from '../lib/tasks-service';
import { terminalService } from '../lib/terminal-service';
import { realtimeHub } from '../lib/realtime';
import { TaskStatus, TaskPriority } from '@prisma/client';

const router = Router();
router.use(authMiddleware);

// ─── GET /api/tasks/events (Real-Time SSE Stream) ─────────────────────────────
router.get('/events', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const ws = await getOrCreateUserWorkspace(userId);

    // Set SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable buffering for Nginx/proxies
    });

    realtimeHub.registerClient(ws.workspaceId, userId, res);
  } catch (error) {
    console.error('SSE register error:', error);
    res.status(500).end();
  }
});

// ─── POST /api/tasks/terminal/execute (Terminal Command Center) ───────────────
router.post('/terminal/execute', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const ws = await getOrCreateUserWorkspace(userId);
    const { command } = req.body;

    if (typeof command !== 'string') {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Command must be a string' },
      });
      return;
    }

    const result = await terminalService.execute(ws.workspaceId, userId, command);

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('Terminal execute error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message || 'Terminal command execution failed' },
    });
  }
});

// ─── GET /api/tasks/terminal/suggestions (Terminal Autocomplete) ──────────────
router.get('/terminal/suggestions', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const ws = await getOrCreateUserWorkspace(userId);
    const { q = '' } = req.query;

    const suggestions = await terminalService.getSuggestions(ws.workspaceId, String(q));

    res.json({
      success: true,
      data: { suggestions },
    });
  } catch (error: any) {
    console.error('Terminal suggestions error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message || 'Failed to fetch suggestions' },
    });
  }
});

// ─── GET /api/tasks/my-day (Smart Daily Work) ─────────────────────────────────
router.get('/my-day', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const ws = await getOrCreateUserWorkspace(userId);

    const myDay = await tasksService.getMyDayTasks(ws.workspaceId, userId);

    res.json({
      success: true,
      data: myDay,
    });
  } catch (error: any) {
    console.error('My Day tasks error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message || 'Failed to load My Day' },
    });
  }
});

// ─── GET /api/tasks (List workspace tasks with filters) ───────────────────────
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const ws = await getOrCreateUserWorkspace(userId);
    const {
      projectId,
      status,
      priority,
      assigneeId,
      creatorId,
      documentId,
      dueFilter,
      search,
      parentOnly,
      isArchived,
      sortBy,
      sortOrder,
    } = req.query;

    const options: TaskFilterOptions = {
      projectId: projectId ? String(projectId) : undefined,
      status: status ? (String(status) as TaskStatus) : undefined,
      priority: priority ? (String(priority) as TaskPriority) : undefined,
      assigneeId: assigneeId ? String(assigneeId) : undefined,
      creatorId: creatorId ? String(creatorId) : undefined,
      documentId: documentId ? String(documentId) : undefined,
      dueFilter: dueFilter ? (String(dueFilter) as any) : undefined,
      search: search ? String(search) : undefined,
      parentOnly: parentOnly !== undefined ? parentOnly === 'true' : undefined,
      isArchived: isArchived !== undefined ? isArchived === 'true' : false,
      sortBy: sortBy ? (String(sortBy) as any) : undefined,
      sortOrder: sortOrder ? (String(sortOrder) as any) : undefined,
    };

    const tasks = await tasksService.listTasks(ws.workspaceId, options);

    res.json({
      success: true,
      data: { tasks, count: tasks.length },
    });
  } catch (error: any) {
    console.error('List tasks error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message || 'Failed to list tasks' },
    });
  }
});

// ─── POST /api/tasks (Create a task) ──────────────────────────────────────────
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const ws = await getOrCreateUserWorkspace(userId);
    const {
      title,
      description,
      priority = 'MEDIUM',
      dueDate,
      startDate,
      documentId,
      projectId,
      assigneeId,
      parentId,
      estimatedHours,
    } = req.body;

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Task title is required' },
      });
      return;
    }

    const task = await tasksService.createTask(userId, ws.workspaceId, {
      title: title.trim(),
      description: description?.trim(),
      priority: priority as TaskPriority,
      dueDate: dueDate ? new Date(dueDate) : undefined,
      startDate: startDate ? new Date(startDate) : undefined,
      documentId: documentId || undefined,
      projectId: projectId || undefined,
      assigneeId: assigneeId || undefined,
      parentId: parentId || undefined,
      estimatedHours: typeof estimatedHours === 'number' ? estimatedHours : undefined,
    });

    res.status(201).json({
      success: true,
      data: { task },
    });
  } catch (error: any) {
    console.error('Create task error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message || 'Failed to create task' },
    });
  }
});

// ─── POST /api/tasks/batch (Notes-to-Tasks Batch Creation) ────────────────────
router.post('/batch', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const ws = await getOrCreateUserWorkspace(userId);
    const { tasks: items, documentId, projectId } = req.body;

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

      const created = await tasksService.createTask(userId, ws.workspaceId, {
        title: item.title.trim(),
        description: item.description?.trim(),
        priority: (item.priority as TaskPriority) || 'MEDIUM',
        dueDate: item.dueDate ? new Date(item.dueDate) : undefined,
        documentId: documentId || undefined,
        projectId: projectId || undefined,
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
      }).catch(() => {});
    }

    res.status(201).json({
      success: true,
      data: {
        count: createdTasks.length,
        createdCount: createdTasks.length,
        tasks: createdTasks,
      },
    });
  } catch (error: any) {
    console.error('Batch create tasks error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message || 'Failed to create batch tasks' },
    });
  }
});

// ─── POST /api/tasks/bulk (Bulk Actions: Complete, Archive, Status, Priority) ─
router.post('/bulk', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const ws = await getOrCreateUserWorkspace(userId);
    const { taskIds, action, data } = req.body;

    if (!Array.isArray(taskIds) || taskIds.length === 0 || !action) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'taskIds array and action are required' },
      });
      return;
    }

    const result = await tasksService.bulkUpdate(ws.workspaceId, taskIds, action, data);

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('Bulk tasks error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message || 'Bulk operation failed' },
    });
  }
});

// ─── GET /api/tasks/:id (Task Details) ────────────────────────────────────────
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const task = await tasksService.getTaskById(id);

    if (!task) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Task not found' },
      });
      return;
    }

    res.json({
      success: true,
      data: { task },
    });
  } catch (error: any) {
    console.error('Get task error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message || 'Failed to fetch task' },
    });
  }
});

// ─── PATCH /api/tasks/:id (Update Task) ───────────────────────────────────────
router.patch('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const userId = req.userId!;
    const ws = await getOrCreateUserWorkspace(userId);
    const {
      title,
      description,
      status,
      priority,
      dueDate,
      startDate,
      assigneeId,
      projectId,
      isArchived,
      isPinned,
      estimatedHours,
      actualHours,
    } = req.body;

    const updated = await tasksService.updateTask(id, ws.workspaceId, userId, {
      title: title?.trim(),
      description: description?.trim(),
      status: status ? (status as TaskStatus) : undefined,
      priority: priority ? (priority as TaskPriority) : undefined,
      dueDate: dueDate !== undefined ? (dueDate ? new Date(dueDate) : null) : undefined,
      startDate: startDate !== undefined ? (startDate ? new Date(startDate) : null) : undefined,
      assigneeId: assigneeId !== undefined ? assigneeId : undefined,
      projectId: projectId !== undefined ? projectId : undefined,
      isArchived: typeof isArchived === 'boolean' ? isArchived : undefined,
      estimatedHours: typeof estimatedHours === 'number' ? estimatedHours : undefined,
      actualHours: typeof actualHours === 'number' ? actualHours : undefined,
    });

    res.json({
      success: true,
      data: { task: updated },
    });
  } catch (error: any) {
    console.error('Update task error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message || 'Failed to update task' },
    });
  }
});

// ─── DELETE /api/tasks/:id (Delete Task) ──────────────────────────────────────
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const userId = req.userId!;
    const ws = await getOrCreateUserWorkspace(userId);

    await tasksService.deleteTask(id, userId, ws.workspaceId);

    res.json({
      success: true,
      data: { deleted: true },
    });
  } catch (error: any) {
    console.error('Delete task error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message || 'Failed to delete task' },
    });
  }
});

// ─── POST /api/tasks/:id/dependencies (Add Finish-to-Start Dependency) ─────────
router.post('/:id/dependencies', async (req: Request, res: Response): Promise<void> => {
  try {
    const blockedTaskId = req.params.id as string;
    const { blockingTaskId } = req.body;

    if (!blockingTaskId || typeof blockingTaskId !== 'string') {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'blockingTaskId is required' },
      });
      return;
    }

    const dependency = await tasksService.addDependency(blockingTaskId, blockedTaskId);

    res.status(201).json({
      success: true,
      data: { dependency },
    });
  } catch (error: any) {
    console.error('Add dependency error:', error);
    if (error.code === 'CYCLE_DETECTED') {
      res.status(409).json({
        success: false,
        error: { code: 'CYCLE_DETECTED', message: error.message },
      });
      return;
    }
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message || 'Failed to add dependency' },
    });
  }
});

// ─── DELETE /api/tasks/:id/dependencies/:blockingId (Remove Dependency) ───────
router.delete('/:id/dependencies/:blockingId', async (req: Request, res: Response): Promise<void> => {
  try {
    const blockedTaskId = req.params.id as string;
    const blockingTaskId = req.params.blockingId as string;

    await tasksService.removeDependency(blockingTaskId, blockedTaskId);

    res.json({
      success: true,
      data: { removed: true },
    });
  } catch (error: any) {
    console.error('Remove dependency error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message || 'Failed to remove dependency' },
    });
  }
});

// ─── POST /api/tasks/:id/checklists (Add Checklist Item) ──────────────────────
router.post('/:id/checklists', async (req: Request, res: Response): Promise<void> => {
  try {
    const taskId = req.params.id as string;
    const { title } = req.body;

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Checklist item title is required' },
      });
      return;
    }

    const item = await tasksService.addChecklistItem(taskId, title.trim());

    res.status(201).json({
      success: true,
      data: { item },
    });
  } catch (error: any) {
    console.error('Add checklist error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message || 'Failed to add checklist item' },
    });
  }
});

// ─── PATCH /api/tasks/:id/checklists/:itemId (Toggle Checklist Item) ──────────
router.patch('/:id/checklists/:itemId', async (req: Request, res: Response): Promise<void> => {
  try {
    const itemId = req.params.itemId as string;
    const { isCompleted } = req.body;

    const item = await tasksService.toggleChecklistItem(itemId, !!isCompleted);

    res.json({
      success: true,
      data: { item },
    });
  } catch (error: any) {
    console.error('Toggle checklist error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message || 'Failed to toggle checklist item' },
    });
  }
});

// ─── POST /api/tasks/:id/comments (Add Comment) ───────────────────────────────
router.post('/:id/comments', async (req: Request, res: Response): Promise<void> => {
  try {
    const taskId = req.params.id as string;
    const userId = req.userId!;
    const { content } = req.body;

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Comment content is required' },
      });
      return;
    }

    const comment = await tasksService.addComment(taskId, userId, content.trim());

    res.status(201).json({
      success: true,
      data: { comment },
    });
  } catch (error: any) {
    console.error('Add comment error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message || 'Failed to add comment' },
    });
  }
});

export default router;
