import { prisma } from './prisma';

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

    if (!session) return null;

    let currentElapsedSeconds = session.actualSeconds;
    if (session.status === 'RUNNING') {
      const runElapsed = Math.max(0, Math.floor((Date.now() - new Date(session.startedAt).getTime()) / 1000));
      currentElapsedSeconds += runElapsed;
    }

    const targetSeconds = session.targetMinutes * 60;
    const remainingSeconds = Math.max(0, targetSeconds - currentElapsedSeconds);
    const isExpired = remainingSeconds <= 0;

    return {
      ...session,
      currentElapsedSeconds,
      remainingSeconds,
      isExpired,
    };
  }

  async startFocusSession(
    workspaceId: string,
    userId: string,
    data: {
      taskId?: string;
      title: string;
      targetMinutes?: number;
      notes?: string;
    }
  ) {
    if (data.taskId) {
      const task = await prisma.task.findFirst({
        where: { id: data.taskId, workspaceId },
      });
      if (!task) {
        throw new Error('Task not found or does not belong to the active workspace');
      }
    }

    // End any existing running or paused session safely
    const existing = await prisma.focusSession.findFirst({
      where: {
        workspaceId,
        userId,
        status: { in: ['RUNNING', 'PAUSED'] },
      },
    });

    if (existing) {
      await this.completeFocusSession(existing.id, userId, {
        notes: existing.notes ? `${existing.notes} (Auto-closed)` : 'Auto-closed to start new session',
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
        actualSeconds: 0,
        distractions: 0,
        notes: data.notes || null,
      },
      include: {
        task: {
          select: { id: true, title: true, priority: true, status: true },
        },
      },
    });

    return {
      ...session,
      currentElapsedSeconds: 0,
      remainingSeconds: (session.targetMinutes || 25) * 60,
      isExpired: false,
    };
  }

  async pauseFocusSession(sessionId: string, userId: string) {
    const session = await prisma.focusSession.findFirst({
      where: { id: sessionId, userId },
      include: {
        task: {
          select: { id: true, title: true, priority: true, status: true },
        },
      },
    });

    if (!session) throw new Error('Focus session not found');

    if (session.status === 'PAUSED') {
      const remainingSeconds = Math.max(0, session.targetMinutes * 60 - session.actualSeconds);
      return {
        ...session,
        currentElapsedSeconds: session.actualSeconds,
        remainingSeconds,
        isExpired: remainingSeconds <= 0,
      };
    }

    if (session.status !== 'RUNNING') {
      throw new Error(`Cannot pause session with status ${session.status}`);
    }

    const now = Date.now();
    const elapsed = Math.floor((now - new Date(session.startedAt).getTime()) / 1000);
    const totalSeconds = session.actualSeconds + Math.max(0, elapsed);

    const updated = await prisma.focusSession.update({
      where: { id: sessionId },
      data: {
        status: 'PAUSED',
        actualSeconds: totalSeconds,
      },
      include: {
        task: {
          select: { id: true, title: true, priority: true, status: true },
        },
      },
    });

    const remainingSeconds = Math.max(0, updated.targetMinutes * 60 - totalSeconds);
    return {
      ...updated,
      currentElapsedSeconds: totalSeconds,
      remainingSeconds,
      isExpired: remainingSeconds <= 0,
    };
  }

  async resumeFocusSession(sessionId: string, userId: string) {
    const session = await prisma.focusSession.findFirst({
      where: { id: sessionId, userId },
      include: {
        task: {
          select: { id: true, title: true, priority: true, status: true },
        },
      },
    });

    if (!session) throw new Error('Focus session not found');

    if (session.status === 'RUNNING') {
      const runElapsed = Math.max(0, Math.floor((Date.now() - new Date(session.startedAt).getTime()) / 1000));
      const totalElapsed = session.actualSeconds + runElapsed;
      const remainingSeconds = Math.max(0, session.targetMinutes * 60 - totalElapsed);
      return {
        ...session,
        currentElapsedSeconds: totalElapsed,
        remainingSeconds,
        isExpired: remainingSeconds <= 0,
      };
    }

    if (session.status !== 'PAUSED') {
      throw new Error(`Cannot resume session with status ${session.status}`);
    }

    const updated = await prisma.focusSession.update({
      where: { id: sessionId },
      data: {
        status: 'RUNNING',
        startedAt: new Date(),
      },
      include: {
        task: {
          select: { id: true, title: true, priority: true, status: true },
        },
      },
    });

    const remainingSeconds = Math.max(0, updated.targetMinutes * 60 - updated.actualSeconds);
    return {
      ...updated,
      currentElapsedSeconds: updated.actualSeconds,
      remainingSeconds,
      isExpired: remainingSeconds <= 0,
    };
  }

  async completeFocusSession(
    sessionId: string,
    userId: string,
    data: { notes?: string; distractions?: number } = {}
  ) {
    const session = await prisma.focusSession.findFirst({
      where: { id: sessionId, userId },
      include: {
        task: {
          select: { id: true, title: true, priority: true, status: true, actualHours: true },
        },
      },
    });

    if (!session) throw new Error('Focus session not found');

    // Idempotency: If already completed, return existing session immediately to prevent duplicate TimeEntries
    if (session.status === 'COMPLETED') {
      return session;
    }

    let totalSeconds = session.actualSeconds;
    if (session.status === 'RUNNING') {
      const now = Date.now();
      const elapsed = Math.floor((now - new Date(session.startedAt).getTime()) / 1000);
      totalSeconds += Math.max(0, elapsed);
    }

    const completedAt = new Date();
    const finalSeconds = Math.max(1, totalSeconds);

    const [updatedSession] = await prisma.$transaction([
      prisma.focusSession.update({
        where: { id: sessionId },
        data: {
          status: 'COMPLETED',
          actualSeconds: finalSeconds,
          endedAt: completedAt,
          notes: data.notes !== undefined ? data.notes : session.notes,
          distractions: data.distractions !== undefined ? data.distractions : session.distractions,
        },
        include: {
          task: {
            select: { id: true, title: true, priority: true, status: true },
          },
        },
      }),
      prisma.timeEntry.create({
        data: {
          workspaceId: session.workspaceId,
          userId,
          taskId: session.taskId,
          durationSeconds: finalSeconds,
          startedAt: session.startedAt,
          endedAt: completedAt,
          description: `Focus Session: ${session.title}`,
          isManual: false,
        },
      }),
    ]);

    // If session was linked to task, update actualHours on Task
    if (session.taskId) {
      const task = await prisma.task.findUnique({ where: { id: session.taskId } });
      if (task) {
        const addedHours = Math.max(0.01, Number((finalSeconds / 3600).toFixed(4)));
        await prisma.task.update({
          where: { id: session.taskId },
          data: {
            actualHours: Number(((task.actualHours || 0) + addedHours).toFixed(2)),
          },
        });
      }
    }

    return updatedSession;
  }

  async cancelFocusSession(sessionId: string, userId: string) {
    const session = await prisma.focusSession.findFirst({
      where: { id: sessionId, userId },
      include: {
        task: {
          select: { id: true, title: true, priority: true, status: true },
        },
      },
    });

    if (!session) throw new Error('Focus session not found');
    if (session.status === 'CANCELLED') return session;
    if (session.status === 'COMPLETED') {
      throw new Error('Cannot cancel a completed session');
    }

    let totalSeconds = session.actualSeconds;
    if (session.status === 'RUNNING') {
      const now = Date.now();
      const elapsed = Math.floor((now - new Date(session.startedAt).getTime()) / 1000);
      totalSeconds += Math.max(0, elapsed);
    }

    return prisma.focusSession.update({
      where: { id: sessionId },
      data: {
        status: 'CANCELLED',
        actualSeconds: totalSeconds,
        endedAt: new Date(),
      },
      include: {
        task: {
          select: { id: true, title: true, priority: true, status: true },
        },
      },
    });
  }

  async recordDistraction(sessionId: string, userId: string, data: { note?: string } = {}) {
    const session = await prisma.focusSession.findFirst({
      where: { id: sessionId, userId },
    });

    if (!session) throw new Error('Focus session not found');

    const updatedNote = data.note
      ? (session.distractionNotes ? `${session.distractionNotes}\n• ${data.note}` : `• ${data.note}`)
      : session.distractionNotes;

    return prisma.focusSession.update({
      where: { id: sessionId },
      data: {
        distractions: session.distractions + 1,
        distractionNotes: updatedNote,
      },
      include: {
        task: {
          select: { id: true, title: true, priority: true, status: true },
        },
      },
    });
  }

  async getSessionHistory(
    workspaceId: string,
    userId: string,
    options: { limit?: number; taskId?: string } = {}
  ) {
    const where: any = {
      workspaceId,
      userId,
    };
    if (options.taskId) where.taskId = options.taskId;

    const sessions = await prisma.focusSession.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        task: {
          select: { id: true, title: true, priority: true, status: true },
        },
      },
      take: options.limit || 20,
    });

    return sessions;
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

    const [todaySessions, weekSessions, todayManualEntries, weekManualEntries] = await Promise.all([
      prisma.focusSession.findMany({
        where: {
          workspaceId,
          userId,
          status: 'COMPLETED',
          startedAt: { gte: startOfToday },
        },
        select: { actualSeconds: true },
      }),
      prisma.focusSession.findMany({
        where: {
          workspaceId,
          userId,
          status: 'COMPLETED',
          startedAt: { gte: startOfWeek },
        },
        select: { actualSeconds: true },
      }),
      prisma.timeEntry.findMany({
        where: {
          workspaceId,
          userId,
          isManual: true,
          startedAt: { gte: startOfToday },
        },
        select: { durationSeconds: true },
      }),
      prisma.timeEntry.findMany({
        where: {
          workspaceId,
          userId,
          isManual: true,
          startedAt: { gte: startOfWeek },
        },
        select: { durationSeconds: true },
      }),
    ]);

    const todaySessionSecs = todaySessions.reduce((sum, s) => sum + s.actualSeconds, 0);
    const todayManualSecs = todayManualEntries.reduce((sum, e) => sum + e.durationSeconds, 0);
    const todayTotalSecs = todaySessionSecs + todayManualSecs;

    const weekSessionSecs = weekSessions.reduce((sum, s) => sum + s.actualSeconds, 0);
    const weekManualSecs = weekManualEntries.reduce((sum, e) => sum + e.durationSeconds, 0);
    const weekTotalSecs = weekSessionSecs + weekManualSecs;

    return {
      todayMinutes: Math.round(todayTotalSecs / 60),
      todayHours: Number((todayTotalSecs / 3600).toFixed(1)),
      weekMinutes: Math.round(weekTotalSecs / 60),
      weekHours: Number((weekTotalSecs / 3600).toFixed(1)),
      completedCountToday: todaySessions.length,
      completedCountWeek: weekSessions.length,
    };
  }
}

export const focusService = new FocusService();
