import { prisma } from './prisma';
import { GoalStatus } from '@prisma/client';

export class GoalsService {
  async getGoals(
    workspaceId: string,
    filters: {
      status?: GoalStatus;
      category?: string;
      projectId?: string;
    } = {}
  ) {
    const where: any = { workspaceId };
    if (filters.status) where.status = filters.status;
    if (filters.category) where.category = filters.category;
    if (filters.projectId) where.projectId = filters.projectId;

    const goals = await prisma.goal.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        project: {
          select: { id: true, name: true, color: true, progress: true },
        },
        creator: {
          select: { id: true, displayName: true, email: true },
        },
        checkIns: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          include: {
            user: { select: { id: true, displayName: true } },
          },
        },
      },
    });

    return goals.map((g) => {
      const percentage = g.targetValue > 0
        ? Math.min(100, Math.round((g.currentValue / g.targetValue) * 100))
        : 0;
      return {
        ...g,
        progressPercentage: percentage,
      };
    });
  }

  async createGoal(
    workspaceId: string,
    creatorId: string,
    data: {
      title: string;
      description?: string;
      category?: string;
      targetValue?: number;
      currentValue?: number;
      unit?: string;
      targetDate?: Date;
      projectId?: string;
    }
  ) {
    const goal = await prisma.goal.create({
      data: {
        workspaceId,
        creatorId,
        title: data.title.trim(),
        description: data.description || null,
        category: data.category || 'Strategic',
        targetValue: data.targetValue ?? 100,
        currentValue: data.currentValue ?? 0,
        unit: data.unit || '%',
        targetDate: data.targetDate || null,
        projectId: data.projectId || null,
        status: (data.currentValue ?? 0) >= (data.targetValue ?? 100) ? 'ACHIEVED' : 'IN_PROGRESS',
      },
      include: {
        project: { select: { id: true, name: true } },
      },
    });

    return goal;
  }

  async checkInGoal(
    goalId: string,
    userId: string,
    data: {
      newValue: number;
      note?: string;
    }
  ) {
    const goal = await prisma.goal.findUnique({ where: { id: goalId } });
    if (!goal) throw new Error('Goal not found');

    const previousValue = goal.currentValue;
    const isAchieved = data.newValue >= goal.targetValue;
    const newStatus: GoalStatus = isAchieved ? 'ACHIEVED' : 'IN_PROGRESS';

    const [updatedGoal, progressRecord] = await prisma.$transaction([
      prisma.goal.update({
        where: { id: goalId },
        data: {
          currentValue: data.newValue,
          status: newStatus,
        },
      }),
      prisma.goalProgress.create({
        data: {
          goalId,
          userId,
          previousValue,
          newValue: data.newValue,
          note: data.note || null,
        },
      }),
    ]);

    return {
      goal: updatedGoal,
      checkIn: progressRecord,
    };
  }

  async deleteGoal(goalId: string, workspaceId: string) {
    const goal = await prisma.goal.findFirst({
      where: { id: goalId, workspaceId },
    });
    if (!goal) throw new Error('Goal not found or access denied');

    await prisma.goal.delete({ where: { id: goalId } });
    return { deleted: true };
  }
}

export const goalsService = new GoalsService();
