import { prisma } from './prisma';
import { focusService } from './focus-service';

export class AnalyticsService {
  /**
   * Aggregate complete telemetry for the Intelligent Daily Command Center
   */
  async getDailyCommandCenter(workspaceId: string, userId: string) {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));

    // Parallel fetch real workspace data
    const [
      activeTasks,
      completedTodayTasks,
      activeProjects,
      recentDocuments,
      activeFocusSession,
      timeTotals,
      dependencies,
    ] = await Promise.all([
      // 1. All open tasks for the workspace
      prisma.task.findMany({
        where: {
          workspaceId,
          isArchived: false,
          status: { notIn: ['DONE', 'CANCELLED'] },
        },
        orderBy: [{ priority: 'asc' }, { dueDate: 'asc' }],
        include: {
          project: { select: { id: true, name: true, color: true } },
          assignee: { select: { id: true, displayName: true } },
          blockedBy: {
            include: {
              blockingTask: { select: { id: true, title: true, status: true } },
            },
          },
          blocking: {
            include: {
              blockedTask: { select: { id: true, title: true, status: true } },
            },
          },
        },
      }),

      // 2. Tasks completed today
      prisma.task.findMany({
        where: {
          workspaceId,
          status: 'DONE',
          completedAt: { gte: startOfToday },
        },
        select: { id: true, title: true, completedAt: true, priority: true },
      }),

      // 3. Active projects
      prisma.project.findMany({
        where: {
          workspaceId,
          status: 'ACTIVE',
          isArchived: false,
        },
        orderBy: { updatedAt: 'desc' },
        take: 6,
        include: {
          tasks: {
            select: { id: true, status: true },
          },
        },
      }),

      // 4. Recent documents
      prisma.document.findMany({
        where: {
          workspaceId,
          isDeleted: false,
          isArchived: false,
        },
        orderBy: { updatedAt: 'desc' },
        take: 6,
        select: {
          id: true,
          title: true,
          icon: true,
          status: true,
          updatedAt: true,
          plainText: true,
        },
      }),

      // 5. Active focus session
      focusService.getActiveSession(workspaceId, userId),

      // 6. Time totals today/week
      focusService.getDailyWeeklyTotals(workspaceId, userId),

      // 7. All unfinished dependencies
      prisma.taskDependency.findMany({
        where: {
          blockingTask: { status: { not: 'DONE' } },
        },
        select: { blockedTaskId: true, blockingTaskId: true },
      }),
    ]);

    const blockedTaskIds = new Set(dependencies.map((d) => d.blockedTaskId));

    // Categorize tasks dynamically based on real data
    const overdueTasks: any[] = [];
    const dueTodayTasks: any[] = [];
    const blockedTasks: any[] = [];
    const priorityTasks: any[] = [];

    for (const t of activeTasks) {
      const isBlocked = blockedTaskIds.has(t.id);
      const isOverdue = t.dueDate && new Date(t.dueDate) < startOfToday;
      const isDueToday = t.dueDate && new Date(t.dueDate) >= startOfToday && new Date(t.dueDate) <= endOfToday;
      const isHighPriority = t.priority === 'URGENT' || t.priority === 'HIGH';

      const enriched = {
        ...t,
        isBlocked,
        activeBlockersCount: t.blockedBy.filter((b) => b.blockingTask.status !== 'DONE').length,
      };

      if (isOverdue) overdueTasks.push(enriched);
      if (isDueToday) dueTodayTasks.push(enriched);
      if (isBlocked) blockedTasks.push(enriched);
      if (isHighPriority && !isOverdue && !isDueToday) priorityTasks.push(enriched);
    }

    // AI Daily Planning Assistant: Generate ranked schedule proposal with rationale
    const proposedPlan: Array<{
      taskId: string;
      title: string;
      priority: string;
      dueDate?: string | null;
      projectName?: string | null;
      rationale: string;
      estimatedMinutes: number;
    }> = [];

    // Rule 1: Overdue unblocked tasks first
    for (const t of overdueTasks) {
      if (!t.isBlocked && proposedPlan.length < 5) {
        proposedPlan.push({
          taskId: t.id,
          title: t.title,
          priority: t.priority,
          dueDate: t.dueDate?.toISOString() || null,
          projectName: t.project?.name || null,
          rationale: 'Overdue deadline — immediate priority resolution recommended',
          estimatedMinutes: Math.round((t.estimatedHours || 1) * 60),
        });
      }
    }

    // Rule 2: Tasks due today that unblock other team tasks
    for (const t of dueTodayTasks) {
      if (!t.isBlocked && proposedPlan.length < 5) {
        const unblocksCount = t.blocking.length;
        proposedPlan.push({
          taskId: t.id,
          title: t.title,
          priority: t.priority,
          dueDate: t.dueDate?.toISOString() || null,
          projectName: t.project?.name || null,
          rationale: unblocksCount > 0
            ? `Due today & directly unblocks ${unblocksCount} downstream task(s)`
            : 'Target delivery committed for today',
          estimatedMinutes: Math.round((t.estimatedHours || 1) * 60),
        });
      }
    }

    // Rule 3: High priority unblocked objectives
    for (const t of priorityTasks) {
      if (!t.isBlocked && proposedPlan.length < 5) {
        proposedPlan.push({
          taskId: t.id,
          title: t.title,
          priority: t.priority,
          dueDate: t.dueDate?.toISOString() || null,
          projectName: t.project?.name || null,
          rationale: 'High strategic impact objective ready for execution',
          estimatedMinutes: Math.round((t.estimatedHours || 1.5) * 60),
        });
      }
    }

    // Format active projects with real calculated completion rates
    const formattedProjects = activeProjects.map((p) => {
      const totalTasks = p.tasks.length;
      const doneTasks = p.tasks.filter((t) => t.status === 'DONE').length;
      const calculatedProgress = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : p.progress;

      return {
        id: p.id,
        name: p.name,
        color: p.color,
        health: p.health,
        progress: calculatedProgress,
        totalTasks,
        doneTasks,
        remainingTasks: totalTasks - doneTasks,
        targetDate: p.targetDate,
      };
    });

    return {
      timestamp: now.toISOString(),
      summary: {
        totalOpenTasks: activeTasks.length,
        overdueCount: overdueTasks.length,
        dueTodayCount: dueTodayTasks.length,
        blockedCount: blockedTasks.length,
        completedTodayCount: completedTodayTasks.length,
        activeProjectsCount: activeProjects.length,
      },
      todayPriorities: priorityTasks.slice(0, 5),
      dueTodayTasks: dueTodayTasks.slice(0, 8),
      overdueTasks: overdueTasks.slice(0, 8),
      blockedTasks: blockedTasks.slice(0, 6),
      completedToday: completedTodayTasks,
      activeProjects: formattedProjects,
      recentNotes: recentDocuments.map((d) => ({
        ...d,
        snippet: d.plainText ? d.plainText.slice(0, 100) : '',
      })),
      focusTelemetry: {
        activeSession: activeFocusSession,
        todayMinutes: timeTotals.todayMinutes,
        todayHours: timeTotals.todayHours,
        weekMinutes: timeTotals.weekMinutes,
        weekHours: timeTotals.weekHours,
      },
      planningAssistant: {
        suggestedPlan: proposedPlan,
        totalPlannedMinutes: proposedPlan.reduce((acc, p) => acc + p.estimatedMinutes, 0),
        generatedAt: now.toISOString(),
      },
      reviewSummary: {
        completedTodayCount: completedTodayTasks.length,
        carriedForwardCount: activeTasks.length,
        focusLoggedMinutes: timeTotals.todayMinutes,
      },
    };
  }

  /**
   * Calculate workspace analytics and health metrics from database records
   */
  async getWorkspaceAnalytics(workspaceId: string, options?: { projectId?: string; dateRange?: string }) {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    let dateFilter: any = undefined;
    if (options?.dateRange === '7d') {
      dateFilter = { gte: sevenDaysAgo };
    } else if (options?.dateRange === '30d') {
      dateFilter = { gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) };
    } else if (options?.dateRange === '90d') {
      dateFilter = { gte: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000) };
    }

    const taskWhere: any = {
      workspaceId,
      isArchived: false,
    };
    if (options?.projectId) {
      taskWhere.projectId = options.projectId;
    }
    if (dateFilter) {
      taskWhere.createdAt = dateFilter;
    }

    const [
      allTasks,
      last7DaysCompleted,
      prev7DaysCompleted,
      projects,
      goals,
    ] = await Promise.all([
      prisma.task.findMany({
        where: taskWhere,
        select: {
          id: true,
          projectId: true,
          status: true,
          priority: true,
          dueDate: true,
          createdAt: true,
          completedAt: true,
        },
      }),
      prisma.task.count({
        where: {
          workspaceId,
          ...(options?.projectId ? { projectId: options.projectId } : {}),
          status: 'DONE',
          completedAt: { gte: sevenDaysAgo },
        },
      }),
      prisma.task.count({
        where: {
          workspaceId,
          ...(options?.projectId ? { projectId: options.projectId } : {}),
          status: 'DONE',
          completedAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo },
        },
      }),
      prisma.project.findMany({
        where: { workspaceId, isArchived: false },
        select: { id: true, name: true, health: true, progress: true },
      }),
      prisma.goal.findMany({
        where: { workspaceId },
        select: { id: true, title: true, status: true, currentValue: true, targetValue: true },
      }),
    ]);

    // 1. Completion Rate:
    // Eligible tasks exclude CANCELLED tasks as required by the business rules
    const totalTasks = allTasks.length;
    const eligibleTasks = allTasks.filter((t) => t.status !== 'CANCELLED');
    const completedTasks = eligibleTasks.filter((t) => t.status === 'DONE');
    const completionRate = eligibleTasks.length > 0
      ? Math.round((completedTasks.length / eligibleTasks.length) * 100)
      : 0;

    // 2. Overdue Ratio:
    // Denominator = eligible tasks with valid due dates
    const tasksWithDueDates = eligibleTasks.filter((t) => t.dueDate !== null);
    const overdueTasks = tasksWithDueDates.filter(
      (t) => t.status !== 'DONE' && new Date(t.dueDate!) < now
    );
    const overdueRate = tasksWithDueDates.length > 0
      ? Math.round((overdueTasks.length / tasksWithDueDates.length) * 100)
      : 0;

    // 3. Average Cycle Time (hours):
    let totalCycleHours = 0;
    let cycleCount = 0;
    for (const t of completedTasks) {
      if (t.completedAt && t.createdAt) {
        const hours = (new Date(t.completedAt).getTime() - new Date(t.createdAt).getTime()) / (1000 * 60 * 60);
        if (hours >= 0) {
          totalCycleHours += hours;
          cycleCount++;
        }
      }
    }
    const averageCycleHours = cycleCount > 0 ? Number((totalCycleHours / cycleCount).toFixed(1)) : 0;

    // 4. Delivery Velocity:
    const velocityTrend = last7DaysCompleted - prev7DaysCompleted;
    const velocityPercentageChange = prev7DaysCompleted > 0
      ? Math.round(((last7DaysCompleted - prev7DaysCompleted) / prev7DaysCompleted) * 100)
      : last7DaysCompleted > 0 ? 100 : 0;

    // 5. Daily Trend (last 7 days):
    const dailyTrend: Array<{ date: string; dayName: string; completed: number }> = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
      const dayEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
      const completedOnDay = allTasks.filter(
        (t) => t.status === 'DONE' && t.completedAt && new Date(t.completedAt) >= dayStart && new Date(t.completedAt) <= dayEnd
      ).length;
      dailyTrend.push({
        date: dayStart.toISOString().split('T')[0],
        dayName: dayStart.toLocaleDateString('en-US', { weekday: 'short' }),
        completed: completedOnDay,
      });
    }

    // 6. Workflow Status distribution:
    const statusCounts = {
      BACKLOG: allTasks.filter((t) => t.status === 'BACKLOG').length,
      TODO: allTasks.filter((t) => t.status === 'TODO').length,
      IN_PROGRESS: allTasks.filter((t) => t.status === 'IN_PROGRESS').length,
      IN_REVIEW: allTasks.filter((t) => t.status === 'IN_REVIEW').length,
      DONE: completedTasks.length,
      CANCELLED: allTasks.filter((t) => t.status === 'CANCELLED').length,
    };

    // 7. Priority distribution:
    const priorityCounts = {
      URGENT: allTasks.filter((t) => t.priority === 'URGENT').length,
      HIGH: allTasks.filter((t) => t.priority === 'HIGH').length,
      MEDIUM: allTasks.filter((t) => t.priority === 'MEDIUM').length,
      LOW: allTasks.filter((t) => t.priority === 'LOW').length,
      NONE: allTasks.filter((t) => t.priority === 'NONE' || !t.priority).length,
    };

    // 8. Project Execution:
    const projectsExecution = projects.map((p) => {
      const pTasks = allTasks.filter((t) => (t as any).projectId === p.id);
      const pDone = pTasks.filter((t) => t.status === 'DONE').length;
      const pOverdue = pTasks.filter((t) => t.status !== 'DONE' && t.dueDate && new Date(t.dueDate) < now).length;
      return {
        id: p.id,
        name: p.name,
        health: p.health,
        progress: p.progress,
        totalTasks: pTasks.length,
        doneTasks: pDone,
        overdueTasks: pOverdue,
      };
    });

    // 9. Goals Metric:
    let totalGoalProgress = 0;
    for (const g of goals) {
      const pct = g.targetValue > 0 ? Math.min(100, (g.currentValue / g.targetValue) * 100) : 0;
      totalGoalProgress += pct;
    }
    const averageGoalProgress = goals.length > 0 ? Math.round(totalGoalProgress / goals.length) : 0;

    return {
      summary: {
        totalTasks,
        eligibleTasksCount: eligibleTasks.length,
        completedTasks: completedTasks.length,
        completionRate,
        tasksWithDueDatesCount: tasksWithDueDates.length,
        overdueCount: overdueTasks.length,
        overdueRate,
        averageCycleHours,
        velocityLast7Days: last7DaysCompleted,
        velocityPrevious7Days: prev7DaysCompleted,
        velocityTrend,
        velocityPercentageChange,
      },
      dailyTrend,
      statusDistribution: statusCounts,
      priorityDistribution: priorityCounts,
      projectsHealth: {
        onTrack: projects.filter((p) => p.health === 'ON_TRACK').length,
        atRisk: projects.filter((p) => p.health === 'AT_RISK').length,
        offTrack: projects.filter((p) => p.health === 'OFF_TRACK').length,
        total: projects.length,
      },
      projectsExecution,
      goalsMetric: {
        total: goals.length,
        achieved: goals.filter((g) => g.status === 'ACHIEVED').length,
        averageProgress: averageGoalProgress,
      },
    };
  }
}

export const analyticsService = new AnalyticsService();
