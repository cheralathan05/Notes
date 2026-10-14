import { prisma } from './prisma';
import { TaskStatus, TaskPriority } from '@prisma/client';
import { realtimeHub } from './realtime';
import { projectsService } from './projects-service';

export interface TaskFilterOptions {
  projectId?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  assigneeId?: string;
  creatorId?: string;
  documentId?: string;
  dueFilter?: 'today' | 'overdue' | 'upcoming';
  search?: string;
  parentOnly?: boolean;
  isArchived?: boolean;
  sortBy?: 'dueDate' | 'priority' | 'createdAt' | 'updatedAt' | 'title';
  sortOrder?: 'asc' | 'desc';
}

export class TasksService {
  /**
   * Helper to compute dynamic blocker state on tasks
   */
  private enrichTaskWithBlockers(task: any) {
    const blockers = (task.blockedBy || [])
      .map((dep: any) => dep.blockingTask)
      .filter((bt: any) => bt && bt.status !== 'DONE');

    const isBlocked = blockers.length > 0;
    const subtaskTotal = task.subtasks?.length || 0;
    const subtaskDone = (task.subtasks || []).filter((st: any) => st.status === 'DONE').length;
    const checklistTotal = task.checklists?.length || 0;
    const checklistDone = (task.checklists || []).filter((cl: any) => cl.isCompleted).length;

    return {
      ...task,
      isBlocked,
      blockers: blockers.map((b: any) => ({
        id: b.id,
        title: b.title,
        status: b.status,
        assignee: b.assignee ? { displayName: b.assignee.displayName } : null,
      })),
      subtaskProgress: {
        total: subtaskTotal,
        done: subtaskDone,
        percentage: subtaskTotal > 0 ? Math.round((subtaskDone / subtaskTotal) * 100) : 0,
      },
      checklistProgress: {
        total: checklistTotal,
        done: checklistDone,
        percentage: checklistTotal > 0 ? Math.round((checklistDone / checklistTotal) * 100) : 0,
      },
    };
  }

  /**
   * List tasks with extensive filters & blocker intelligence
   */
  async listTasks(workspaceId: string, options: TaskFilterOptions = {}) {
    const where: any = {
      workspaceId,
      isArchived: options.isArchived !== undefined ? options.isArchived : false,
    };

    if (options.projectId) where.projectId = options.projectId;
    if (options.status) where.status = options.status;
    if (options.priority) where.priority = options.priority;
    if (options.assigneeId) where.assigneeId = options.assigneeId;
    if (options.creatorId) where.creatorId = options.creatorId;
    if (options.documentId) where.documentId = options.documentId;
    if (options.parentOnly) where.parentId = null;

    if (options.search) {
      where.OR = [
        { title: { contains: options.search, mode: 'insensitive' } },
        { description: { contains: options.search, mode: 'insensitive' } },
      ];
    }

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    if (options.dueFilter === 'today') {
      where.dueDate = {
        gte: startOfToday,
        lte: endOfToday,
      };
    } else if (options.dueFilter === 'overdue') {
      where.dueDate = { lt: startOfToday };
      where.status = { not: 'DONE' };
    } else if (options.dueFilter === 'upcoming') {
      where.dueDate = { gt: endOfToday };
    }

    const orderBy: any = {};
    const sortField = options.sortBy || 'createdAt';
    const sortDir = options.sortOrder || 'desc';
    orderBy[sortField] = sortDir;

    const tasks = await prisma.task.findMany({
      where,
      include: {
        creator: { select: { id: true, displayName: true, email: true, avatarUrl: true } },
        assignee: { select: { id: true, displayName: true, email: true, avatarUrl: true } },
        project: { select: { id: true, name: true, color: true, icon: true } },
        milestone: { select: { id: true, title: true } },
        document: { select: { id: true, title: true, icon: true } },
        subtasks: {
          select: { id: true, title: true, status: true, priority: true, dueDate: true },
        },
        checklists: {
          orderBy: { orderIndex: 'asc' },
        },
        labels: {
          include: { label: true },
        },
        blockedBy: {
          include: {
            blockingTask: {
              select: {
                id: true,
                title: true,
                status: true,
                assignee: { select: { displayName: true } },
              },
            },
          },
        },
        blocking: {
          select: { blockedTaskId: true },
        },
      },
      orderBy,
    });

    return tasks.map((t) => this.enrichTaskWithBlockers(t));
  }

  /**
   * Get task by ID with full relations
   */
  async getTask(taskId: string, workspaceId: string) {
    const task = await prisma.task.findFirst({
      where: { id: taskId, workspaceId },
      include: {
        creator: { select: { id: true, displayName: true, email: true, avatarUrl: true } },
        assignee: { select: { id: true, displayName: true, email: true, avatarUrl: true } },
        project: { select: { id: true, name: true, color: true, icon: true, progress: true } },
        milestone: { select: { id: true, title: true, isCompleted: true } },
        document: { select: { id: true, title: true, icon: true, updatedAt: true } },
        parent: { select: { id: true, title: true, status: true } },
        subtasks: {
          include: {
            assignee: { select: { id: true, displayName: true, avatarUrl: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
        checklists: {
          orderBy: { orderIndex: 'asc' },
        },
        comments: {
          include: {
            user: { select: { id: true, displayName: true, email: true, avatarUrl: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
        activities: {
          include: {
            user: { select: { id: true, displayName: true, avatarUrl: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 25,
        },
        labels: {
          include: { label: true },
        },
        blockedBy: {
          include: {
            blockingTask: {
              select: {
                id: true,
                title: true,
                status: true,
                priority: true,
                assignee: { select: { displayName: true } },
              },
            },
          },
        },
        blocking: {
          include: {
            blockedTask: {
              select: { id: true, title: true, status: true },
            },
          },
        },
        recurrence: true,
      },
    });

    if (!task) return null;

    return this.enrichTaskWithBlockers(task);
  }

  /**
   * Create task
   */
  async createTask(
    userId: string,
    workspaceId: string,
    data: {
      title: string;
      description?: string;
      status?: TaskStatus;
      priority?: TaskPriority;
      projectId?: string | null;
      milestoneId?: string | null;
      assigneeId?: string | null;
      documentId?: string | null;
      parentId?: string | null;
      startDate?: string | Date | null;
      dueDate?: string | Date | null;
      estimatedHours?: number | null;
      branchName?: string | null;
      acceptanceCriteria?: any;
      repositoryId?: string | null;
    }
  ) {
    const task = await prisma.task.create({
      data: {
        workspaceId,
        creatorId: userId,
        assigneeId: data.assigneeId || null,
        projectId: data.projectId || null,
        milestoneId: data.milestoneId || null,
        documentId: data.documentId || null,
        parentId: data.parentId || null,
        title: data.title.trim(),
        description: data.description?.trim() || null,
        status: data.status || 'TODO',
        priority: data.priority || 'MEDIUM',
        startDate: data.startDate ? new Date(data.startDate) : null,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        estimatedHours: data.estimatedHours || null,
        branchName: data.branchName || null,
        acceptanceCriteria: data.acceptanceCriteria || null,
        repositoryId: data.repositoryId || null,
      },
      include: {
        creator: { select: { id: true, displayName: true, email: true } },
        assignee: { select: { id: true, displayName: true, email: true } },
        project: { select: { id: true, name: true, color: true } },
      },
    });

    // Activity record
    await prisma.taskActivity.create({
      data: {
        taskId: task.id,
        userId,
        action: 'TASK_CREATED',
        metadata: { title: task.title, status: task.status, priority: task.priority },
      },
    });

    // Recalculate project progress if linked
    if (task.projectId) {
      await projectsService.recalculateProjectProgress(task.projectId);
    }

    realtimeHub.broadcast(workspaceId, 'TASK_CREATED', { task });
    return this.enrichTaskWithBlockers(task);
  }

  /**
   * Update task with transition rules
   */
  async updateTask(
    taskId: string,
    workspaceId: string,
    userId: string,
    data: {
      title?: string;
      description?: string;
      status?: TaskStatus;
      priority?: TaskPriority;
      assigneeId?: string | null;
      projectId?: string | null;
      milestoneId?: string | null;
      startDate?: string | Date | null;
      dueDate?: string | Date | null;
      estimatedHours?: number | null;
      actualHours?: number | null;
      isArchived?: boolean;
    }
  ) {
    const existing = await prisma.task.findFirst({
      where: { id: taskId, workspaceId },
      include: { project: true },
    });

    if (!existing) {
      throw new Error('Task not found');
    }

    const updates: any = {};
    const activitiesToCreate: any[] = [];

    if (data.title && data.title.trim() !== existing.title) {
      updates.title = data.title.trim();
    }
    if (data.description !== undefined) {
      updates.description = data.description ? data.description.trim() : null;
    }
    if (data.priority && data.priority !== existing.priority) {
      updates.priority = data.priority;
      activitiesToCreate.push({
        action: 'PRIORITY_CHANGED',
        metadata: { from: existing.priority, to: data.priority },
      });
    }

    // Status transition logic
    if (data.status && data.status !== existing.status) {
      updates.status = data.status;
      if (data.status === 'DONE') {
        updates.completedAt = new Date();
        activitiesToCreate.push({ action: 'TASK_COMPLETED' });
      } else if (existing.status === 'DONE') {
        updates.completedAt = null;
        activitiesToCreate.push({ action: 'TASK_REOPENED' });
      } else {
        activitiesToCreate.push({
          action: 'STATUS_CHANGED',
          metadata: { from: existing.status, to: data.status },
        });
      }
    }

    if (data.assigneeId !== undefined && data.assigneeId !== existing.assigneeId) {
      updates.assigneeId = data.assigneeId;
      activitiesToCreate.push({
        action: 'ASSIGNED',
        metadata: { assigneeId: data.assigneeId },
      });
    }

    if (data.dueDate !== undefined) {
      updates.dueDate = data.dueDate ? new Date(data.dueDate) : null;
      activitiesToCreate.push({
        action: 'DEADLINE_CHANGED',
        metadata: { dueDate: updates.dueDate },
      });
    }

    if (data.startDate !== undefined) updates.startDate = data.startDate ? new Date(data.startDate) : null;
    if (data.projectId !== undefined) updates.projectId = data.projectId;
    if (data.milestoneId !== undefined) updates.milestoneId = data.milestoneId;
    if (data.estimatedHours !== undefined) updates.estimatedHours = data.estimatedHours;
    if (data.actualHours !== undefined) updates.actualHours = data.actualHours;
    if (data.isArchived !== undefined) updates.isArchived = data.isArchived;

    const updatedTask = await prisma.task.update({
      where: { id: taskId },
      data: updates,
      include: {
        creator: { select: { id: true, displayName: true, email: true } },
        assignee: { select: { id: true, displayName: true, email: true } },
        project: { select: { id: true, name: true, color: true } },
      },
    });

    // Persist activity entries
    for (const act of activitiesToCreate) {
      await prisma.taskActivity.create({
        data: {
          taskId,
          userId,
          action: act.action,
          metadata: act.metadata || null,
        },
      });
    }

    // Recalculate project progress
    const activeProjectId = updatedTask.projectId || existing.projectId;
    if (activeProjectId) {
      await projectsService.recalculateProjectProgress(activeProjectId);
    }

    realtimeHub.broadcast(workspaceId, 'TASK_UPDATED', { task: updatedTask });
    return this.enrichTaskWithBlockers(updatedTask);
  }

  /**
   * Delete task
   */
  async deleteTask(taskId: string, userId: string, workspaceId: string) {
    const task = await prisma.task.findFirst({
      where: { id: taskId, workspaceId },
    });

    if (!task) throw new Error('Task not found');

    await prisma.task.delete({
      where: { id: taskId },
    });

    if (task.projectId) {
      await projectsService.recalculateProjectProgress(task.projectId);
    }

    realtimeHub.broadcast(workspaceId, 'TASK_DELETED', { taskId });
    return { success: true };
  }

  /**
   * Duplicate task
   */
  async duplicateTask(taskId: string, userId: string, workspaceId: string) {
    const original = await prisma.task.findFirst({
      where: { id: taskId, workspaceId },
      include: { checklists: true, labels: true },
    });

    if (!original) throw new Error('Task not found');

    const duplicate = await prisma.task.create({
      data: {
        workspaceId,
        creatorId: userId,
        assigneeId: original.assigneeId,
        projectId: original.projectId,
        milestoneId: original.milestoneId,
        documentId: original.documentId,
        title: `${original.title} (Copy)`,
        description: original.description,
        status: 'TODO',
        priority: original.priority,
        dueDate: original.dueDate,
        estimatedHours: original.estimatedHours,
        checklists: {
          create: original.checklists.map((cl) => ({
            title: cl.title,
            orderIndex: cl.orderIndex,
            isCompleted: false,
          })),
        },
        labels: {
          create: original.labels.map((l) => ({
            labelId: l.labelId,
          })),
        },
      },
      include: {
        creator: { select: { id: true, displayName: true } },
        project: { select: { id: true, name: true } },
      },
    });

    realtimeHub.broadcast(workspaceId, 'TASK_CREATED', { task: duplicate });
    return duplicate;
  }

  /**
   * Bulk operations
   */
  async bulkTaskOperation(
    userId: string,
    workspaceId: string,
    action: 'complete' | 'reopen' | 'delete' | 'archive' | 'assign' | 'status' | 'priority',
    taskIds: string[],
    data: any = {}
  ) {
    if (!taskIds.length) return { affected: 0 };

    if (action === 'complete') {
      await prisma.task.updateMany({
        where: { id: { in: taskIds }, workspaceId },
        data: { status: 'DONE', completedAt: new Date() },
      });
    } else if (action === 'reopen') {
      await prisma.task.updateMany({
        where: { id: { in: taskIds }, workspaceId },
        data: { status: 'TODO', completedAt: null },
      });
    } else if (action === 'delete') {
      await prisma.task.deleteMany({
        where: { id: { in: taskIds }, workspaceId },
      });
    } else if (action === 'archive') {
      await prisma.task.updateMany({
        where: { id: { in: taskIds }, workspaceId },
        data: { isArchived: true },
      });
    } else if (action === 'assign' && data.assigneeId !== undefined) {
      await prisma.task.updateMany({
        where: { id: { in: taskIds }, workspaceId },
        data: { assigneeId: data.assigneeId },
      });
    } else if (action === 'status' && data.status) {
      await prisma.task.updateMany({
        where: { id: { in: taskIds }, workspaceId },
        data: { status: data.status },
      });
    } else if (action === 'priority' && data.priority) {
      await prisma.task.updateMany({
        where: { id: { in: taskIds }, workspaceId },
        data: { priority: data.priority },
      });
    }

    realtimeHub.broadcast(workspaceId, 'TASKS_BULK_UPDATED', { taskIds, action });
    return { affected: taskIds.length };
  }

  /**
   * Dependencies: Add Finish-to-Start dependency with DAG cycle check
   */
  async addDependency(blockingTaskId: string, blockedTaskId: string) {
    if (blockingTaskId === blockedTaskId) {
      throw new Error('A task cannot depend on itself');
    }

    // Check if adding this creates a cycle
    const isCycle = await this.detectCycle(blockedTaskId, blockingTaskId);
    if (isCycle) {
      const err: any = new Error('Cycle detected: Dependency would create a circular deadlock');
      err.code = 'CYCLE_DETECTED';
      throw err;
    }

    const dependency = await prisma.taskDependency.create({
      data: {
        blockingTaskId,
        blockedTaskId,
      },
      include: {
        blockingTask: { select: { id: true, title: true, status: true } },
        blockedTask: { select: { id: true, title: true, status: true } },
      },
    });

    return dependency;
  }

  /**
   * Cycle detection using graph traversal
   */
  private async detectCycle(startTaskId: string, targetTaskId: string): Promise<boolean> {
    const visited = new Set<string>();
    const queue = [startTaskId];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current === targetTaskId) return true;

      if (!visited.has(current)) {
        visited.add(current);
        const downstreamDeps = await prisma.taskDependency.findMany({
          where: { blockingTaskId: current },
          select: { blockedTaskId: true },
        });

        for (const dep of downstreamDeps) {
          queue.push(dep.blockedTaskId);
        }
      }
    }

    return false;
  }

  /**
   * Remove dependency
   */
  async removeDependency(blockingTaskId: string, blockedTaskId: string) {
    await prisma.taskDependency.delete({
      where: {
        blockingTaskId_blockedTaskId: {
          blockingTaskId,
          blockedTaskId,
        },
      },
    });

    return { success: true };
  }

  /**
   * Add Checklist item
   */
  async addChecklistItem(taskId: string, title: string) {
    const count = await prisma.taskChecklistItem.count({ where: { taskId } });
    const item = await prisma.taskChecklistItem.create({
      data: {
        taskId,
        title: title.trim(),
        orderIndex: count,
        isCompleted: false,
      },
    });
    return item;
  }

  /**
   * Toggle checklist item
   */
  async toggleChecklistItem(itemId: string, isCompleted: boolean) {
    const item = await prisma.taskChecklistItem.update({
      where: { id: itemId },
      data: { isCompleted },
    });
    return item;
  }

  /**
   * Add Comment
   */
  async addComment(taskId: string, userId: string, content: string) {
    const comment = await prisma.taskComment.create({
      data: {
        taskId,
        userId,
        content: content.trim(),
      },
      include: {
        user: { select: { id: true, displayName: true, email: true, avatarUrl: true } },
      },
    });

    await prisma.taskActivity.create({
      data: {
        taskId,
        userId,
        action: 'COMMENT_ADDED',
        metadata: { preview: content.slice(0, 50) },
      },
    });

    return comment;
  }

  async getTaskById(taskId: string) {
    const cleanId = taskId.replace(/^task-/i, '');
    const includeConfig = {
      creator: { select: { id: true, displayName: true, email: true, avatarUrl: true } },
      assignee: { select: { id: true, displayName: true, email: true, avatarUrl: true } },
      claimedBy: { select: { id: true, displayName: true, email: true } },
      project: { select: { id: true, name: true, color: true, icon: true, progress: true } },
      milestone: { select: { id: true, title: true, isCompleted: true } },
      document: { select: { id: true, title: true, icon: true, updatedAt: true } },
      parent: { select: { id: true, title: true, status: true } },
      subtasks: {
        include: {
          assignee: { select: { id: true, displayName: true, avatarUrl: true } },
        },
        orderBy: { createdAt: 'asc' as const },
      },
      checklists: {
        orderBy: { orderIndex: 'asc' as const },
      },
      comments: {
        include: {
          user: { select: { id: true, displayName: true, email: true, avatarUrl: true } },
        },
        orderBy: { createdAt: 'asc' as const },
      },
      activities: {
        include: {
          user: { select: { id: true, displayName: true, avatarUrl: true } },
        },
        orderBy: { createdAt: 'desc' as const },
        take: 25,
      },
      labels: {
        include: { label: true },
      },
      blockedBy: {
        include: {
          blockingTask: {
            select: {
              id: true,
              title: true,
              status: true,
              priority: true,
              assignee: { select: { displayName: true } },
            },
          },
        },
      },
      blocking: {
        include: {
          blockedTask: {
            select: { id: true, title: true, status: true },
          },
        },
      },
      recurrence: true,
    };

    let task = await prisma.task.findUnique({
      where: { id: cleanId },
      include: includeConfig,
    });

    if (!task) {
      task = await prisma.task.findUnique({
        where: { id: taskId },
        include: includeConfig,
      });
    }

    if (!task && cleanId.length >= 6) {
      task = await prisma.task.findFirst({
        where: { id: { startsWith: cleanId } },
        include: includeConfig,
      });
    }

    if (!task) return null;
    return this.enrichTaskWithBlockers(task);
  }

  async getMyDayTasks(workspaceId: string, _userId: string) {
    const all = await this.listTasks(workspaceId, { isArchived: false });
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const today = all.filter(
      (t: any) =>
        t.dueDate &&
        new Date(t.dueDate) >= startOfToday &&
        new Date(t.dueDate) <= endOfToday &&
        t.status !== 'DONE'
    );
    const overdue = all.filter(
      (t: any) =>
        t.dueDate &&
        new Date(t.dueDate) < startOfToday &&
        t.status !== 'DONE' &&
        t.status !== 'CANCELLED'
    );
    const upcoming = all.filter(
      (t: any) => t.dueDate && new Date(t.dueDate) > endOfToday && t.status !== 'DONE'
    );
    const completed = all.filter((t: any) => t.status === 'DONE');
    const waitingOnOthers = all.filter((t: any) => t.isBlocked && t.status !== 'DONE');

    return {
      today,
      overdue,
      upcoming,
      completed,
      waitingOnOthers,
      stats: {
        todayCount: today.length,
        overdueCount: overdue.length,
        upcomingCount: upcoming.length,
        completedCount: completed.length,
        blockedCount: waitingOnOthers.length,
      },
    };
  }

  async bulkUpdate(workspaceId: string, taskIds: string[], action: any, data?: any) {
    return this.bulkTaskOperation('system', workspaceId, action, taskIds, data);
  }
}

export const tasksService = new TasksService();
