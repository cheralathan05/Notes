import { prisma } from './prisma';
import { ProjectStatus, ProjectHealth, ProjectRole } from '@prisma/client';
import { realtimeHub } from './realtime';

export interface ProjectFilterOptions {
  status?: ProjectStatus;
  search?: string;
  includeArchived?: boolean;
  sortBy?: 'name' | 'progress' | 'targetDate' | 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
}

export class ProjectsService {
  /**
   * Recalculates a project's completion percentage and health indicators.
   */
  async recalculateProjectProgress(projectId: string) {
    const tasks = await prisma.task.findMany({
      where: {
        projectId,
        isArchived: false,
        parentId: null, // Only root tasks drive progress to avoid double-counting subtasks
      },
      select: {
        id: true,
        status: true,
        priority: true,
        dueDate: true,
        blockedBy: {
          select: {
            blockingTask: {
              select: { status: true },
            },
          },
        },
      },
    });

    const activeTasks = tasks.filter((t) => t.status !== 'CANCELLED');
    const totalCount = activeTasks.length;
    const doneCount = activeTasks.filter((t) => t.status === 'DONE').length;
    const progress = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

    // Health calculation
    const now = new Date();
    const overdueCount = activeTasks.filter(
      (t) => t.dueDate && t.dueDate < now && t.status !== 'DONE'
    ).length;

    const blockedCount = activeTasks.filter((t) =>
      t.status !== 'DONE' &&
      t.blockedBy.some((dep) => dep.blockingTask.status !== 'DONE')
    ).length;

    let health: ProjectHealth = 'ON_TRACK';
    if (overdueCount >= 3 || (blockedCount >= 2 && progress < 80)) {
      health = 'OFF_TRACK';
    } else if (overdueCount >= 1 || blockedCount >= 1) {
      health = 'AT_RISK';
    }

    const updated = await prisma.project.update({
      where: { id: projectId },
      data: {
        progress,
        health,
      },
      include: {
        creator: { select: { id: true, displayName: true, email: true } },
      },
    });

    realtimeHub.broadcast(updated.workspaceId, 'PROJECT_PROGRESS_UPDATED', {
      projectId,
      progress,
      health,
      totalCount,
      doneCount,
      overdueCount,
      blockedCount,
    });

    return { progress, health, totalCount, doneCount, overdueCount, blockedCount };
  }

  /**
   * List all projects for a workspace with stats, filters & sorting
   */
  async listProjects(
    workspaceId: string,
    optionsOrStatus?: ProjectStatus | ProjectFilterOptions
  ) {
    let options: ProjectFilterOptions = {};
    if (typeof optionsOrStatus === 'string') {
      options = { status: optionsOrStatus as ProjectStatus };
    } else if (optionsOrStatus && typeof optionsOrStatus === 'object') {
      options = optionsOrStatus;
    }

    const where: any = {
      workspaceId,
      isArchived: options.includeArchived ? undefined : false,
    };

    const validStatuses = ['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'ARCHIVED'];
    if (options.status && typeof options.status === 'string') {
      const upper = options.status.trim().toUpperCase();
      if (validStatuses.includes(upper)) {
        where.status = upper;
      }
    }

    if (options.search) {
      where.OR = [
        { name: { contains: options.search, mode: 'insensitive' } },
        { description: { contains: options.search, mode: 'insensitive' } },
      ];
    }

    let orderBy: any = { createdAt: 'desc' };
    if (options.sortBy) {
      orderBy = { [options.sortBy]: options.sortOrder || 'desc' };
    }

    const projects = await prisma.project.findMany({
      where,
      include: {
        creator: { select: { id: true, displayName: true, email: true, avatarUrl: true } },
        members: {
          include: {
            user: { select: { id: true, displayName: true, email: true, avatarUrl: true } },
          },
        },
        milestones: {
          orderBy: { dueDate: 'asc' },
        },
        tasks: {
          where: { isArchived: false, parentId: null },
          select: { id: true, title: true, status: true, priority: true, dueDate: true },
        },
        _count: {
          select: { tasks: true },
        },
      },
      orderBy,
    });

    return projects;
  }

  async archiveProject(projectId: string, workspaceId: string) {
    const updated = await prisma.project.update({
      where: { id: projectId },
      data: { isArchived: true, status: 'ARCHIVED' },
      include: {
        creator: { select: { id: true, displayName: true, email: true } },
      },
    });
    realtimeHub.broadcast(workspaceId, 'PROJECT_UPDATED', { project: updated });
    return updated;
  }

  async unarchiveProject(projectId: string, workspaceId: string) {
    const updated = await prisma.project.update({
      where: { id: projectId },
      data: { isArchived: false, status: 'ACTIVE' },
      include: {
        creator: { select: { id: true, displayName: true, email: true } },
      },
    });
    realtimeHub.broadcast(workspaceId, 'PROJECT_UPDATED', { project: updated });
    return updated;
  }

  /**
   * Get project by ID with full details
   */
  async getProject(projectId: string, workspaceId: string) {
    const project = await prisma.project.findFirst({
      where: { id: projectId, workspaceId },
      include: {
        creator: { select: { id: true, displayName: true, email: true, avatarUrl: true } },
        members: {
          include: {
            user: { select: { id: true, displayName: true, email: true, avatarUrl: true } },
          },
        },
        milestones: {
          orderBy: { dueDate: 'asc' },
        },
        documents: {
          select: { id: true, title: true, icon: true, updatedAt: true },
        },
      },
    });

    if (!project) return null;

    // Dynamic stats
    const stats = await this.recalculateProjectProgress(projectId);

    return { ...project, stats };
  }

  /**
   * Create a new project
   */
  async createProject(
    userId: string,
    workspaceId: string,
    data: {
      name: string;
      description?: string;
      color?: string;
      icon?: string;
      status?: ProjectStatus;
      startDate?: string | Date;
      targetDate?: string | Date;
    }
  ) {
    const project = await prisma.project.create({
      data: {
        workspaceId,
        creatorId: userId,
        name: data.name.trim(),
        description: data.description?.trim() || null,
        color: data.color || '#FAFAFA',
        icon: data.icon || '📁',
        status: data.status || 'ACTIVE',
        startDate: data.startDate ? new Date(data.startDate) : null,
        targetDate: data.targetDate ? new Date(data.targetDate) : null,
        members: {
          create: {
            userId,
            role: 'OWNER',
          },
        },
      },
      include: {
        creator: { select: { id: true, displayName: true, email: true } },
        members: {
          include: {
            user: { select: { id: true, displayName: true, email: true } },
          },
        },
      },
    });

    realtimeHub.broadcast(workspaceId, 'PROJECT_CREATED', { project });
    return project;
  }

  /**
   * Update project
   */
  async updateProject(
    projectId: string,
    workspaceId: string,
    data: {
      name?: string;
      description?: string;
      color?: string;
      icon?: string;
      status?: ProjectStatus;
      startDate?: string | Date;
      targetDate?: string | Date;
      isArchived?: boolean;
    }
  ) {
    const updated = await prisma.project.update({
      where: { id: projectId },
      data: {
        name: data.name ? data.name.trim() : undefined,
        description: data.description !== undefined ? data.description?.trim() : undefined,
        color: data.color || undefined,
        icon: data.icon || undefined,
        status: data.status || undefined,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        targetDate: data.targetDate ? new Date(data.targetDate) : undefined,
        isArchived: data.isArchived !== undefined ? data.isArchived : undefined,
      },
      include: {
        creator: { select: { id: true, displayName: true, email: true } },
      },
    });

    realtimeHub.broadcast(workspaceId, 'PROJECT_UPDATED', { project: updated });
    return updated;
  }

  /**
   * Delete project
   */
  async deleteProject(projectId: string, workspaceId: string) {
    await prisma.project.delete({
      where: { id: projectId },
    });

    realtimeHub.broadcast(workspaceId, 'PROJECT_DELETED', { projectId });
    return { success: true };
  }

  /**
   * Add a milestone to a project
   */
  async addMilestone(
    projectId: string,
    data: { title: string; description?: string; dueDate?: string | Date }
  ) {
    const milestone = await prisma.milestone.create({
      data: {
        projectId,
        title: data.title.trim(),
        description: data.description?.trim() || null,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
      },
    });

    return milestone;
  }

  async getProjectById(projectId: string) {
    return prisma.project.findUnique({
      where: { id: projectId },
      include: {
        creator: { select: { id: true, displayName: true, email: true, avatarUrl: true } },
        members: {
          include: {
            user: { select: { id: true, displayName: true, email: true, avatarUrl: true } },
          },
        },
        milestones: {
          orderBy: { dueDate: 'asc' },
        },
        documents: {
          select: { id: true, title: true, icon: true, updatedAt: true },
        },
      },
    });
  }

  async updateMilestone(
    milestoneId: string,
    data: { title?: string; description?: string; dueDate?: Date; isCompleted?: boolean }
  ) {
    const updateData: any = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.dueDate !== undefined) updateData.dueDate = data.dueDate;
    if (data.isCompleted !== undefined) {
      updateData.isCompleted = data.isCompleted;
      updateData.completedAt = data.isCompleted ? new Date() : null;
    }

    return prisma.milestone.update({
      where: { id: milestoneId },
      data: updateData,
    });
  }

  async deleteMilestone(milestoneId: string) {
    await prisma.milestone.delete({
      where: { id: milestoneId },
    });
    return { success: true };
  }
}

export const projectsService = new ProjectsService();
