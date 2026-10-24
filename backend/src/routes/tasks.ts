import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';
import { resolveWorkspaceContext, verifyWorkspaceMembership } from '../lib/workspace';
import { tasksService, TaskFilterOptions } from '../lib/tasks-service';
import { terminalService } from '../lib/terminal-service';
import { realtimeHub } from '../lib/realtime';
import { TaskStatus, TaskPriority } from '@prisma/client';

const router = Router();
router.use(authMiddleware);

// ─── GET /api/tasks/events (Real-Time SSE Stream) ─────────────────────────────
router.get('/events', async (req: Request, res: Response): Promise<void> => {
  try {
    const ws = await resolveWorkspaceContext(req);
    const userId = req.userId!;

    realtimeHub.registerClient(ws.workspaceId, userId, res);
  } catch (error) {
    console.error('SSE register error:', error);
    if (!res.headersSent) {
      res.status(500).end();
    } else {
      res.end();
    }
  }
});

// ─── POST /api/tasks/terminal/execute (Terminal Command Center) ───────────────
router.post('/terminal/execute', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const ws = await resolveWorkspaceContext(req);
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
    const ws = await resolveWorkspaceContext(req);
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
    const ws = await resolveWorkspaceContext(req);

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
    const ws = await resolveWorkspaceContext(req);
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
    const ws = await resolveWorkspaceContext(req);
    const {
      title,
      description,
      status,
      priority = 'MEDIUM',
      dueDate,
      startDate,
      documentId,
      projectId,
      assigneeId,
      parentId,
      estimatedHours,
      acceptanceCriteria,
      branchName,
      repositoryId,
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
      status: status ? (status as TaskStatus) : undefined,
      priority: priority as TaskPriority,
      dueDate: dueDate ? new Date(dueDate) : undefined,
      startDate: startDate ? new Date(startDate) : undefined,
      documentId: documentId || undefined,
      projectId: projectId || undefined,
      assigneeId: assigneeId || undefined,
      parentId: parentId || undefined,
      estimatedHours: typeof estimatedHours === 'number' ? estimatedHours : undefined,
      acceptanceCriteria: acceptanceCriteria || undefined,
      branchName: branchName || undefined,
      repositoryId: repositoryId || undefined,
    });

    res.status(201).json({
      success: true,
      data: { task },
    });
  } catch (error: any) {
    console.error('Create task error:', error);
    if (error.code === 'UNAUTHORIZED_ASSIGNEE') {
      res.status(400).json({
        success: false,
        error: { code: 'UNAUTHORIZED_ASSIGNEE', message: error.message },
      });
      return;
    }
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
    const ws = await resolveWorkspaceContext(req);
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
    const ws = await resolveWorkspaceContext(req);
    const userId = req.userId!;
    const { taskIds, action, data } = req.body;

    if (!Array.isArray(taskIds) || taskIds.length === 0 || !action) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'taskIds array and action are required' },
      });
      return;
    }

    const result = await tasksService.bulkUpdate(ws.workspaceId, taskIds, action, data, userId);

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
    const userId = req.userId!;
    const task = await tasksService.getTaskById(id);

    if (!task) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Task not found' },
      });
      return;
    }

    const membership = await verifyWorkspaceMembership(userId, task.workspaceId);
    if (!membership.allowed) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied to task' } });
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

    const existing = await prisma.task.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Task not found' } });
      return;
    }

    const membership = await verifyWorkspaceMembership(userId, existing.workspaceId);
    if (!membership.allowed) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied to task workspace' } });
      return;
    }

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
      branchName,
      repositoryId,
      acceptanceCriteria,
      isVerified,
    } = req.body;

    const updated = await tasksService.updateTask(id, existing.workspaceId, userId, {
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
      branchName: branchName !== undefined ? branchName : undefined,
      repositoryId: repositoryId !== undefined ? repositoryId : undefined,
      acceptanceCriteria: acceptanceCriteria !== undefined ? acceptanceCriteria : undefined,
      isVerified: typeof isVerified === 'boolean' ? isVerified : undefined,
    });

    res.json({
      success: true,
      data: { task: updated },
    });
  } catch (error: any) {
    console.error('Update task error:', error);
    if (error.code === 'UNAUTHORIZED_ASSIGNEE') {
      res.status(400).json({
        success: false,
        error: { code: 'UNAUTHORIZED_ASSIGNEE', message: error.message },
      });
      return;
    }
    if (error.code === 'TASK_BLOCKED' || error.code === 'UNFINISHED_SUBTASKS') {
      res.status(409).json({
        success: false,
        error: { code: error.code, message: error.message },
      });
      return;
    }
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

    const existing = await prisma.task.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Task not found' } });
      return;
    }

    const membership = await verifyWorkspaceMembership(userId, existing.workspaceId);
    if (!membership.allowed) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied to task workspace' } });
      return;
    }

    await tasksService.deleteTask(id, userId, existing.workspaceId);

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

// ─── POST /api/tasks/:id/collaborators (Add Task Collaborator) ────────────────
router.post('/:id/collaborators', async (req: Request, res: Response): Promise<void> => {
  try {
    const taskId = req.params.id as string;
    const userId = req.userId!;
    const { collaboratorUserId } = req.body;

    if (!collaboratorUserId) {
      res.status(400).json({ success: false, error: { code: 'INVALID_INPUT', message: 'collaboratorUserId is required' } });
      return;
    }

    const task = await prisma.task.findUnique({
      where: { id: taskId },
    });
    if (!task) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Task not found' } });
      return;
    }

    const membership = await verifyWorkspaceMembership(userId, task.workspaceId);
    if (!membership.allowed) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied to task' } });
      return;
    }

    const collaborator = await prisma.taskCollaborator.upsert({
      where: {
        taskId_userId: { taskId, userId: collaboratorUserId },
      },
      update: {},
      create: { taskId, userId: collaboratorUserId },
      include: {
        user: { select: { id: true, displayName: true, email: true, avatarUrl: true } },
      },
    });

    await prisma.notification.create({
      data: {
        workspaceId: task.workspaceId,
        recipientId: collaboratorUserId,
        actorId: userId,
        type: 'TASK_ASSIGNED',
        title: 'Added as Task Collaborator',
        message: `You were added as a collaborator on "${task.title}"`,
        linkUrl: `/tasks?id=${task.id}`,
      },
    }).catch(() => {});

    res.status(201).json({ success: true, data: { collaborator } });
  } catch (error: any) {
    console.error('Add collaborator error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: error.message || 'Failed to add collaborator' } });
  }
});

// ─── DELETE /api/tasks/:id/collaborators/:userId (Remove Collaborator) ────────
router.delete('/:id/collaborators/:collaboratorUserId', async (req: Request, res: Response): Promise<void> => {
  try {
    const taskId = req.params.id as string;
    const collaboratorUserId = req.params.collaboratorUserId as string;
    const userId = req.userId!;

    const task = await prisma.task.findUnique({
      where: { id: taskId },
    });
    if (!task) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Task not found' } });
      return;
    }

    const membership = await verifyWorkspaceMembership(userId, task.workspaceId);
    if (!membership.allowed) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied to task' } });
      return;
    }

    await prisma.taskCollaborator.deleteMany({
      where: { taskId, userId: collaboratorUserId },
    });

    res.json({ success: true, data: { removed: true } });
  } catch (error: any) {
    console.error('Remove collaborator error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: error.message || 'Failed to remove collaborator' } });
  }
});

// ─── POST /api/tasks/:id/comments (Add Comment with Mentions) ─────────────────
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

    // Check for @mentions in comment text (e.g., @john or @chera)
    const mentionMatches = content.match(/@([a-zA-Z0-9_\.\-]+)/g);
    if (mentionMatches && mentionMatches.length > 0) {
      const task = await prisma.task.findUnique({
        where: { id: taskId },
        select: { title: true, workspaceId: true },
      });

      if (task) {
        const workspaceMembers = await prisma.workspaceMember.findMany({
          where: { workspaceId: task.workspaceId },
          include: { user: { select: { id: true, displayName: true, email: true } } },
        });

        for (const mentionRaw of mentionMatches) {
          const query = mentionRaw.slice(1).toLowerCase();
          const matched = workspaceMembers.find(
            (m) =>
              m.user.displayName.toLowerCase().includes(query) ||
              m.user.email.toLowerCase().includes(query)
          );

          if (matched && matched.userId !== userId) {
            await prisma.notification.create({
              data: {
                workspaceId: task.workspaceId,
                recipientId: matched.userId,
                actorId: userId,
                type: 'MENTION',
                title: 'You were mentioned in a task comment',
                message: `Mentioned you on "${task.title}": "${content.slice(0, 100)}"`,
                linkUrl: `/tasks?id=${taskId}`,
              },
            }).catch(() => {});
          }
        }
      }
    }

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

// ─── GET /api/tasks/activity (Recent Workspace Activities) ───────────────────
router.get('/activity', async (req: Request, res: Response): Promise<void> => {
  try {
    const ws = await resolveWorkspaceContext(req);
    const limit = Math.min(parseInt(req.query.limit as string) || 30, 100);

    const activities = await prisma.taskActivity.findMany({
      where: {
        task: { workspaceId: ws.workspaceId },
      },
      include: {
        user: { select: { id: true, displayName: true, email: true, avatarUrl: true } },
        task: { select: { id: true, title: true, status: true, priority: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    res.json({
      success: true,
      data: { activities },
    });
  } catch (error: any) {
    console.error('Task activity error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message || 'Failed to fetch task activities' },
    });
  }
});

// ─── GET /api/tasks/labels (List Workspace Labels) ───────────────────────────
router.get('/labels', async (req: Request, res: Response): Promise<void> => {
  try {
    const ws = await resolveWorkspaceContext(req);
    const labels = await tasksService.getLabels(ws.workspaceId);
    res.json({ success: true, data: { labels } });
  } catch (error: any) {
    console.error('List labels error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: error.message || 'Failed to fetch labels' } });
  }
});

// ─── POST /api/tasks/labels (Create Workspace Label) ──────────────────────────
router.post('/labels', async (req: Request, res: Response): Promise<void> => {
  try {
    const ws = await resolveWorkspaceContext(req);
    const { name, color } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ success: false, error: { code: 'INVALID_INPUT', message: 'Label name is required' } });
      return;
    }
    const label = await tasksService.createLabel(ws.workspaceId, name.trim(), color);
    res.status(201).json({ success: true, data: { label } });
  } catch (error: any) {
    console.error('Create label error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: error.message || 'Failed to create label' } });
  }
});

// ─── POST /api/tasks/:id/labels (Assign Label to Task) ─────────────────────────
router.post('/:id/labels', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const userId = req.userId!;
    const { labelId, name, color } = req.body;

    const existing = await prisma.task.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Task not found' } });
      return;
    }
    const membership = await verifyWorkspaceMembership(userId, existing.workspaceId);
    if (!membership.allowed) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied to task' } });
      return;
    }

    let targetLabelId = labelId;
    if (!targetLabelId && name && typeof name === 'string' && name.trim()) {
      const label = await tasksService.createLabel(existing.workspaceId, name.trim(), color);
      targetLabelId = label.id;
    }

    if (!targetLabelId) {
      res.status(400).json({ success: false, error: { code: 'INVALID_INPUT', message: 'labelId or name is required' } });
      return;
    }

    const assignment = await tasksService.addLabelToTask(id, targetLabelId);
    res.status(201).json({ success: true, data: { assignment } });
  } catch (error: any) {
    console.error('Add label to task error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: error.message || 'Failed to assign label' } });
  }
});

// ─── DELETE /api/tasks/:id/labels/:labelId (Remove Label from Task) ───────────
router.delete('/:id/labels/:labelId', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const labelId = req.params.labelId as string;
    const userId = req.userId!;

    const existing = await prisma.task.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Task not found' } });
      return;
    }
    const membership = await verifyWorkspaceMembership(userId, existing.workspaceId);
    if (!membership.allowed) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied to task' } });
      return;
    }

    await tasksService.removeLabelFromTask(id, labelId);
    res.json({ success: true, data: { removed: true } });
  } catch (error: any) {
    console.error('Remove label from task error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: error.message || 'Failed to remove label' } });
  }
});

export default router;
