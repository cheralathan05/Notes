import { prisma } from './prisma';
import { FocusSessionStatus } from '@prisma/client';

export class FocusService {
  async getActiveSession(workspaceId: string, userId: string) {
    const session = await prisma.focusSession.findFirst({
      where: {
        workspaceId,
        userId,
        status: { in: ['RUNNING', 'PAUSED'] },
      },
      include: {
        task: {
          select: { id: true, title: true, priority: true, status: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return session;
  }

  async startFocusSession(
    workspaceId: string,
    userId: string,
    data: {
      taskId?: string;
      title: string;
      targetMinutes?: number;
    }
  ) {
    // End any existing running session
    const existing = await this.getActiveSession(workspaceId, userId);
    if (existing) {
      await this.completeFocusSession(existing.id, userId, {
        notes: 'Auto-closed to start new session',
      });
    }

    const session = await prisma.focusSession.create({
      data: {
        workspaceId,
        userId,
        taskId: data.taskId || null,
        title: data.title.trim(),
        targetMinutes: data.targetMinutes || 25,
        status: 'RUNNING',
        startedAt: new Date(),
      },
      include: {
        task: {
          select: { id: true, title: true, priority: true, status: true },
        },
      },
    });

    return session;
  }

  async pauseFocusSession(sessionId: string, userId: string) {
    const session = await prisma.focusSession.findFirst({
      where: { id: sessionId, userId },
    });

    if (!session) throw new Error('Focus session not found');
    if (session.status !== 'RUNNING') return session;

    // Calculate elapsed seconds so far
    const now = Date.now();
    const elapsed = Math.floor((now - new Date(session.startedAt).getTime()) / 1000);
    const totalSeconds = session.actualSeconds + Math.max(0, elapsed);

    return prisma.focusSession.update({
      where: { id: sessionId },
      data: {
        status: 'PAUSED',
        actualSeconds: totalSeconds,
      },
    });
  }

  async resumeFocusSession(sessionId: string, userId: string) {
    const session = await prisma.focusSession.findFirst({
      where: { id: sessionId, userId },
    });

    if (!session) throw new Error('Focus session not found');
    if (session.status !== 'PAUSED') return session;

    return prisma.focusSession.update({
      where: { id: sessionId },
      data: {
        status: 'RUNNING',
        startedAt: new Date(),
      },
    });
  }

  async completeFocusSession(
    sessionId: string,
    userId: string,
    data: { notes?: string } = {}
  ) {
    const session = await prisma.focusSession.findFirst({
      where: { id: sessionId, userId },
    });

    if (!session) throw new Error('Focus session not found');

    let totalSeconds = session.actualSeconds;
    if (session.status === 'RUNNING') {
      const now = Date.now();
      const elapsed = Math.floor((now - new Date(session.startedAt).getTime()) / 1000);
      totalSeconds += Math.max(0, elapsed);
    }

    const completedAt = new Date();

    const [updatedSession] = await prisma.$transaction([
      prisma.focusSession.update({
        where: { id: sessionId },
        data: {
          status: 'COMPLETED',
          actualSeconds: totalSeconds,
          endedAt: completedAt,
          notes: data.notes || session.notes,
        },
      }),
      // Create a persistent TimeEntry record if duration is >= 60 seconds
      ...(totalSeconds >= 60
        ? [
            prisma.timeEntry.create({
              data: {
                workspaceId: session.workspaceId,
                userId,
                taskId: session.taskId,
                durationSeconds: totalSeconds,
                startedAt: session.startedAt,
                endedAt: completedAt,
                description: `Focus Session: ${session.title}`,
                isManual: false,
              },
            }),
          ]
        : []),
    ]);

    // If session was linked to task, update actualHours on Task
    if (session.taskId && totalSeconds >= 60) {
      const task = await prisma.task.findUnique({ where: { id: session.taskId } });
      if (task) {
        const addedHours = totalSeconds / 3600;
        await prisma.task.update({
          where: { id: session.taskId },
          data: {
            actualHours: (task.actualHours || 0) + addedHours,
          },
        });
      }
    }

    return updatedSession;
  }

  async createManualTimeEntry(
    workspaceId: string,
    userId: string,
    data: {
      taskId?: string;
      projectId?: string;
      durationSeconds: number;
      startedAt: Date;
      endedAt: Date;
      description?: string;
    }
  ) {
    if (data.durationSeconds <= 0) {
      throw new Error('Duration must be greater than zero');
    }

    return prisma.timeEntry.create({
      data: {
        workspaceId,
        userId,
        taskId: data.taskId || null,
        projectId: data.projectId || null,
        durationSeconds: data.durationSeconds,
        startedAt: data.startedAt,
        endedAt: data.endedAt,
        description: data.description || 'Manual time record',
        isManual: true,
      },
    });
  }

  async getTimeEntries(
    workspaceId: string,
    userId: string,
    options: {
      taskId?: string;
      projectId?: string;
      startDate?: Date;
      endDate?: Date;
    } = {}
  ) {
    const where: any = {
      workspaceId,
      userId,
    };

    if (options.taskId) where.taskId = options.taskId;
    if (options.projectId) where.projectId = options.projectId;
    if (options.startDate || options.endDate) {
      where.startedAt = {};
      if (options.startDate) where.startedAt.gte = options.startDate;
      if (options.endDate) where.startedAt.lte = options.endDate;
    }

    const entries = await prisma.timeEntry.findMany({
      where,
      orderBy: { startedAt: 'desc' },
      include: {
        task: { select: { id: true, title: true } },
        project: { select: { id: true, name: true } },
      },
      take: 50,
    });

    return entries;
  }

  async getDailyWeeklyTotals(workspaceId: string, userId: string) {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dayOfWeek = now.getDay(); // 0 is Sunday
    const distanceToMonday = (dayOfWeek + 6) % 7;
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - distanceToMonday);

    const [todayEntries, weekEntries] = await Promise.all([
      prisma.timeEntry.findMany({
        where: {
          workspaceId,
          userId,
          startedAt: { gte: startOfToday },
        },
        select: { durationSeconds: true },
      }),
      prisma.timeEntry.findMany({
        where: {
          workspaceId,
          userId,
          startedAt: { gte: startOfWeek },
        },
        select: { durationSeconds: true },
      }),
    ]);

    const todaySeconds = todayEntries.reduce((sum, e) => sum + e.durationSeconds, 0);
    const weekSeconds = weekEntries.reduce((sum, e) => sum + e.durationSeconds, 0);

    return {
      todayMinutes: Math.round(todaySeconds / 60),
      todayHours: Number((todaySeconds / 3600).toFixed(1)),
      weekMinutes: Math.round(weekSeconds / 60),
      weekHours: Number((weekSeconds / 3600).toFixed(1)),
    };
  }
}

export const focusService = new FocusService();
