import { prisma } from './prisma';
import { GoalStatus, KeyResultType, KeyResultStatus } from '@prisma/client';

export interface KeyResultInput {
  title: string;
  description?: string;
  type?: KeyResultType;
  startValue?: number;
  targetValue?: number;
  currentValue?: number;
  unit?: string;
  weight?: number;
  ownerId?: string;
  dueDate?: Date;
}

export class GoalsService {
  /**
   * Calculates progress percentage for a key result with direction-awareness.
   * - INCREASE: (current - start) / (target - start) * 100
   * - DECREASE: (start - current) / (start - target) * 100
   * - BINARY: current >= 1 ? 100 : 0
   * - MILESTONE: (current / target) * 100
   */
  calculateKeyResultProgress(kr: {
    type: KeyResultType;
    startValue: number;
    targetValue: number;
    currentValue: number;
  }): { progressPercentage: number; rawProgress: number } {
    const s = kr.startValue;
    const t = kr.targetValue;
    const c = kr.currentValue;

    let raw = 0;

    if (kr.type === 'INCREASE') {
      if (t === s) {
        raw = c >= t ? 100 : 0;
      } else {
        raw = ((c - s) / (t - s)) * 100;
      }
    } else if (kr.type === 'DECREASE') {
      if (s === t) {
        raw = c <= t ? 100 : 0;
      } else {
        raw = ((s - c) / (s - t)) * 100;
      }
    } else if (kr.type === 'BINARY') {
      raw = c >= 1 ? 100 : 0;
    } else if (kr.type === 'MILESTONE') {
      raw = t > 0 ? (c / t) * 100 : 0;
    }

    // Guard against NaN or Infinity
    if (isNaN(raw) || !isFinite(raw)) {
      raw = 0;
    }

    const clamped = Math.max(0, Math.min(100, Math.round(raw)));
    return { progressPercentage: clamped, rawProgress: Number(raw.toFixed(2)) };
  }

  /**
   * Calculates overall goal progress based on its key results or direct metrics.
   */
  calculateGoalProgress(goal: {
    targetValue: number;
    currentValue: number;
    keyResults?: Array<{
      type: KeyResultType;
      startValue: number;
      targetValue: number;
      currentValue: number;
      weight: number;
    }>;
  }): number {
    if (goal.keyResults && goal.keyResults.length > 0) {
      const totalWeight = goal.keyResults.reduce((sum, kr) => sum + (kr.weight || 1), 0);
      if (totalWeight <= 0) return 0;

      const weightedProgressSum = goal.keyResults.reduce((sum, kr) => {
        const { progressPercentage } = this.calculateKeyResultProgress(kr);
        return sum + progressPercentage * (kr.weight || 1);
      }, 0);

      return Math.round(weightedProgressSum / totalWeight);
    }

    // Direct goal fallback
    if (goal.targetValue > 0) {
      const pct = (goal.currentValue / goal.targetValue) * 100;
      return Math.max(0, Math.min(100, Math.round(pct)));
    }

    return 0;
  }

  async getGoals(
    workspaceId: string,
    filters: {
      status?: GoalStatus;
      category?: string;
      projectId?: string;
      search?: string;
    } = {}
  ) {
    const where: any = { workspaceId };

    if (filters.status) where.status = filters.status;
    if (filters.category && filters.category !== 'ALL') where.category = filters.category;
    if (filters.projectId) where.projectId = filters.projectId;

    if (filters.search && filters.search.trim()) {
      where.OR = [
        { title: { contains: filters.search.trim(), mode: 'insensitive' } },
        { description: { contains: filters.search.trim(), mode: 'insensitive' } },
      ];
    }

    const goals = await prisma.goal.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        project: {
          select: { id: true, name: true, color: true, progress: true },
        },
        creator: {
          select: { id: true, displayName: true, email: true, avatarUrl: true },
        },
        owner: {
          select: { id: true, displayName: true, email: true, avatarUrl: true },
        },
        keyResults: {
          orderBy: { createdAt: 'asc' },
          include: {
            owner: { select: { id: true, displayName: true, email: true } },
            updates: {
              orderBy: { createdAt: 'desc' },
              take: 3,
              include: { user: { select: { id: true, displayName: true } } },
            },
          },
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
      const enrichedKRs = g.keyResults.map((kr) => {
        const { progressPercentage, rawProgress } = this.calculateKeyResultProgress(kr);
        return {
          ...kr,
          progressPercentage,
          rawProgress,
        };
      });

      const overallProgress = this.calculateGoalProgress({
        targetValue: g.targetValue,
        currentValue: g.currentValue,
        keyResults: enrichedKRs,
      });

      return {
        ...g,
        keyResults: enrichedKRs,
        progressPercentage: overallProgress,
      };
    });
  }

  async getGoal(goalId: string, workspaceId: string) {
    const goal = await prisma.goal.findFirst({
      where: { id: goalId, workspaceId },
      include: {
        project: {
          select: { id: true, name: true, color: true, progress: true },
        },
        creator: {
          select: { id: true, displayName: true, email: true, avatarUrl: true },
        },
        owner: {
          select: { id: true, displayName: true, email: true, avatarUrl: true },
        },
        keyResults: {
          orderBy: { createdAt: 'asc' },
          include: {
            owner: { select: { id: true, displayName: true, email: true } },
            updates: {
              orderBy: { createdAt: 'desc' },
              include: { user: { select: { id: true, displayName: true } } },
            },
          },
        },
        checkIns: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: { user: { select: { id: true, displayName: true } } },
        },
      },
    });

    if (!goal) return null;

    const enrichedKRs = goal.keyResults.map((kr) => {
      const { progressPercentage, rawProgress } = this.calculateKeyResultProgress(kr);
      return {
        ...kr,
        progressPercentage,
        rawProgress,
      };
    });

    const progressPercentage = this.calculateGoalProgress({
      targetValue: goal.targetValue,
      currentValue: goal.currentValue,
      keyResults: enrichedKRs,
    });

    return {
      ...goal,
      keyResults: enrichedKRs,
      progressPercentage,
    };
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
      timePeriod?: string;
      ownerId?: string;
      projectId?: string;
      status?: GoalStatus;
      keyResults?: KeyResultInput[];
    }
  ) {
    const initialCurrent = data.currentValue ?? 0;
    const initialTarget = data.targetValue ?? 100;
    const initialStatus = data.status || (initialCurrent >= initialTarget ? 'ACHIEVED' : 'IN_PROGRESS');

    const goal = await prisma.goal.create({
      data: {
        workspaceId,
        creatorId,
        ownerId: data.ownerId || creatorId,
        title: data.title.trim(),
        description: data.description || null,
        category: data.category || 'Strategic',
        targetValue: initialTarget,
        currentValue: initialCurrent,
        unit: data.unit || '%',
        targetDate: data.targetDate || null,
        timePeriod: data.timePeriod || 'Q4 2026',
        projectId: data.projectId || null,
        status: initialStatus,
        keyResults: data.keyResults && data.keyResults.length > 0
          ? {
              create: data.keyResults.map((kr) => ({
                title: kr.title.trim(),
                description: kr.description || null,
                type: kr.type || 'INCREASE',
                startValue: kr.startValue ?? 0,
                targetValue: kr.targetValue ?? 100,
                currentValue: kr.currentValue ?? 0,
                unit: kr.unit || '%',
                weight: kr.weight ?? 1.0,
                ownerId: kr.ownerId || creatorId,
                dueDate: kr.dueDate || data.targetDate || null,
                status: (kr.currentValue ?? 0) >= (kr.targetValue ?? 100) ? 'ACHIEVED' : 'IN_PROGRESS',
              })),
            }
          : undefined,
      },
      include: {
        project: { select: { id: true, name: true } },
        owner: { select: { id: true, displayName: true, email: true } },
        keyResults: true,
      },
    });

    return this.getGoal(goal.id, workspaceId);
  }

  async updateGoal(
    goalId: string,
    workspaceId: string,
    data: {
      title?: string;
      description?: string;
      category?: string;
      status?: GoalStatus;
      targetValue?: number;
      currentValue?: number;
      unit?: string;
      targetDate?: Date;
      timePeriod?: string;
      ownerId?: string;
      projectId?: string;
    }
  ) {
    const existing = await prisma.goal.findFirst({
      where: { id: goalId, workspaceId },
    });
    if (!existing) throw new Error('Goal not found or access denied');

    const updated = await prisma.goal.update({
      where: { id: goalId },
      data: {
        title: data.title !== undefined ? data.title.trim() : undefined,
        description: data.description !== undefined ? data.description : undefined,
        category: data.category !== undefined ? data.category : undefined,
        status: data.status !== undefined ? data.status : undefined,
        targetValue: data.targetValue !== undefined ? data.targetValue : undefined,
        currentValue: data.currentValue !== undefined ? data.currentValue : undefined,
        unit: data.unit !== undefined ? data.unit : undefined,
        targetDate: data.targetDate !== undefined ? data.targetDate : undefined,
        timePeriod: data.timePeriod !== undefined ? data.timePeriod : undefined,
        ownerId: data.ownerId !== undefined ? data.ownerId : undefined,
        projectId: data.projectId !== undefined ? data.projectId : undefined,
      },
    });

    return this.getGoal(updated.id, workspaceId);
  }

  async checkInGoal(
    goalId: string,
    userId: string,
    data: {
      newValue: number;
      note?: string;
    }
  ) {
    const goal = await prisma.goal.findUnique({
      where: { id: goalId },
      include: { keyResults: true },
    });
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

  async addKeyResult(
    goalId: string,
    workspaceId: string,
    userId: string,
    data: KeyResultInput
  ) {
    const goal = await prisma.goal.findFirst({
      where: { id: goalId, workspaceId },
    });
    if (!goal) throw new Error('Goal not found or access denied');

    const startVal = data.startValue ?? 0;
    const targetVal = data.targetValue ?? 100;
    const currentVal = data.currentValue ?? startVal;

    const keyResult = await prisma.keyResult.create({
      data: {
        goalId,
        title: data.title.trim(),
        description: data.description || null,
        type: data.type || 'INCREASE',
        startValue: startVal,
        targetValue: targetVal,
        currentValue: currentVal,
        unit: data.unit || '%',
        weight: data.weight ?? 1.0,
        ownerId: data.ownerId || userId,
        dueDate: data.dueDate || goal.targetDate || null,
        status: currentVal >= targetVal ? 'ACHIEVED' : 'IN_PROGRESS',
      },
      include: {
        owner: { select: { id: true, displayName: true, email: true } },
      },
    });

    // Reconcile parent goal progress and status
    await this.reconcileGoalStatus(goalId);

    return keyResult;
  }

  async updateKeyResult(
    keyResultId: string,
    workspaceId: string,
    userId: string,
    data: {
      newValue?: number;
      note?: string;
      title?: string;
      status?: KeyResultStatus;
      dueDate?: Date;
    }
  ) {
    const kr = await prisma.keyResult.findUnique({
      where: { id: keyResultId },
      include: { goal: true },
    });

    if (!kr || kr.goal.workspaceId !== workspaceId) {
      throw new Error('Key result not found or access denied');
    }

    const previousValue = kr.currentValue;
    const updatedValue = data.newValue !== undefined ? data.newValue : previousValue;

    // Check achievement based on direction
    const { progressPercentage } = this.calculateKeyResultProgress({
      type: kr.type,
      startValue: kr.startValue,
      targetValue: kr.targetValue,
      currentValue: updatedValue,
    });

    let newStatus = data.status || kr.status;
    if (progressPercentage >= 100) {
      newStatus = 'ACHIEVED';
    } else if (newStatus === 'NOT_STARTED' && progressPercentage > 0) {
      newStatus = 'IN_PROGRESS';
    }

    const [updatedKr] = await prisma.$transaction([
      prisma.keyResult.update({
        where: { id: keyResultId },
        data: {
          currentValue: updatedValue,
          status: newStatus,
          title: data.title !== undefined ? data.title.trim() : undefined,
          dueDate: data.dueDate !== undefined ? data.dueDate : undefined,
        },
        include: {
          owner: { select: { id: true, displayName: true, email: true } },
        },
      }),
      ...(data.newValue !== undefined && data.newValue !== previousValue
        ? [
            prisma.keyResultUpdate.create({
              data: {
                keyResultId,
                userId,
                previousValue,
                newValue: updatedValue,
                note: data.note || null,
              },
            }),
          ]
        : []),
    ]);

    // Reconcile parent goal progress and status
    await this.reconcileGoalStatus(kr.goalId);

    return {
      ...updatedKr,
      progressPercentage,
    };
  }

  async deleteKeyResult(keyResultId: string, workspaceId: string) {
    const kr = await prisma.keyResult.findUnique({
      where: { id: keyResultId },
      include: { goal: true },
    });

    if (!kr || kr.goal.workspaceId !== workspaceId) {
      throw new Error('Key result not found or access denied');
    }

    await prisma.keyResult.delete({ where: { id: keyResultId } });
    await this.reconcileGoalStatus(kr.goalId);

    return { deleted: true };
  }

  /**
   * Reconciles Goal status and progress after a KeyResult changes.
   */
  async reconcileGoalStatus(goalId: string) {
    const goal = await prisma.goal.findUnique({
      where: { id: goalId },
      include: { keyResults: true },
    });
    if (!goal || goal.keyResults.length === 0) return;

    const overallProgress = this.calculateGoalProgress({
      targetValue: goal.targetValue,
      currentValue: goal.currentValue,
      keyResults: goal.keyResults,
    });

    let newStatus: GoalStatus = goal.status;
    if (overallProgress >= 100) {
      newStatus = 'ACHIEVED';
    } else if (goal.targetDate && new Date(goal.targetDate) < new Date() && overallProgress < 80) {
      newStatus = 'AT_RISK';
    } else if (overallProgress > 0) {
      newStatus = 'IN_PROGRESS';
    }

    await prisma.goal.update({
      where: { id: goalId },
      data: {
        status: newStatus,
      },
    });
  }

  async deleteGoal(goalId: string, workspaceId: string) {
    const goal = await prisma.goal.findFirst({
      where: { id: goalId, workspaceId },
    });
    if (!goal) throw new Error('Goal not found or access denied');

    await prisma.goal.delete({ where: { id: goalId } });
    return { deleted: true };
  }

  async getGoalMetrics(workspaceId: string) {
    const goals = await prisma.goal.findMany({
      where: { workspaceId },
      include: { keyResults: true },
    });

    const totalGoals = goals.length;
    const achievedGoals = goals.filter((g) => {
      const p = this.calculateGoalProgress({
        targetValue: g.targetValue,
        currentValue: g.currentValue,
        keyResults: g.keyResults,
      });
      return g.status === 'ACHIEVED' || p >= 100;
    }).length;

    const inProgressGoals = goals.filter((g) => {
      const p = this.calculateGoalProgress({
        targetValue: g.targetValue,
        currentValue: g.currentValue,
        keyResults: g.keyResults,
      });
      return g.status === 'IN_PROGRESS' || (p > 0 && p < 100 && g.status !== 'AT_RISK');
    }).length;

    const atRiskGoals = goals.filter((g) => g.status === 'AT_RISK').length;

    const averageProgress = totalGoals > 0
      ? Math.round(
          goals.reduce((sum, g) => {
            return (
              sum +
              this.calculateGoalProgress({
                targetValue: g.targetValue,
                currentValue: g.currentValue,
                keyResults: g.keyResults,
              })
            );
          }, 0) / totalGoals
        )
      : 0;

    return {
      totalGoals,
      achievedGoals,
      inProgressGoals,
      atRiskGoals,
      averageProgress,
    };
  }
}

export const goalsService = new GoalsService();
