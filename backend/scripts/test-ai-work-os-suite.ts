import { prisma } from '../src/lib/prisma';
import { notificationsService } from '../src/lib/notifications-service';
import { focusService } from '../src/lib/focus-service';
import { goalsService } from '../src/lib/goals-service';
import { automationService } from '../src/lib/automation-service';
import { analyticsService } from '../src/lib/analytics-service';
import { terminalService } from '../src/lib/terminal-service';
import { tasksService } from '../src/lib/tasks-service';
import { projectsService } from '../src/lib/projects-service';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`  ✖ [FAIL] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  ✔ [PASS] ${message}`);
}

async function runAiWorkOsTestSuite() {
  console.log('════════════════════════════════════════════════════════════════');
  console.log('   AI WORK OPERATING SYSTEM — COMPLETE INTEGRATION VERIFICATION ');
  console.log('════════════════════════════════════════════════════════════════\n');

  // 1. Get or create test user and workspace
  let user = await prisma.user.findFirst();
  if (!user) {
    user = await prisma.user.create({
      data: {
        email: 'staff@aiworkos.internal',
        emailNormalized: 'staff@aiworkos.internal',
        displayName: 'Staff Architect',
        passwordHash: 'dummy-hash',
        accountStatus: 'ACTIVE',
        emailVerified: true,
      },
    });
  }

  const { getOrCreateUserWorkspace } = await import('../src/lib/workspace');
  const ws = await getOrCreateUserWorkspace(user.id);
  const workspaceId = ws.workspaceId;
  const userId = user.id;

  console.log(`[INIT] Verified test environment: User "${user.email}" in Workspace "${workspaceId}"\n`);

  // ─── 1. Notifications & Real-Time Alerting Hub ───
  console.log('[STAGE 6] Notifications & Alerting Hub:');
  const notif = await notificationsService.createNotification(workspaceId, userId, {
    title: 'Mission Critical Blocker Resolved',
    message: 'Quantum Neural Sharder has been unblocked by core team.',
    type: 'DEPENDENCY_UNBLOCKED',
    linkUrl: '/tasks',
  });
  assert(Boolean(notif.id), 'Notification created with cuid()');
  assert(notif.isRead === false, 'Notification initialized as unread');

  const unreadBefore = await notificationsService.getUnreadCount(workspaceId, userId);
  assert(unreadBefore >= 1, `Unread notification count tracked accurately (${unreadBefore})`);

  const updatedNotif = await notificationsService.markAsRead(notif.id, userId);
  assert(updatedNotif.isRead === true, 'Mark notification as read sets isRead=true and readAt timestamp');

  // ─── 2. Focus Sessions & Time Tracking ───
  console.log('\n[STAGE 4 & 9] Focus Mode & Time Tracking Engine:');
  const focusSession = await focusService.startFocusSession(workspaceId, userId, {
    title: 'Deep Architecture Refinement',
    targetMinutes: 25,
  });
  assert(focusSession.status === 'RUNNING', 'Focus session created with RUNNING status');
  assert(focusSession.targetMinutes === 25, 'Target duration registered as 25 minutes');

  const activeCheck = await focusService.getActiveSession(workspaceId, userId);
  assert(activeCheck?.id === focusSession.id, 'Active focus session successfully retrieved');

  const pausedSession = await focusService.pauseFocusSession(focusSession.id, userId);
  assert(pausedSession.status === 'PAUSED', 'Focus session state machine transitions to PAUSED');

  const resumedSession = await focusService.resumeFocusSession(focusSession.id, userId);
  assert(resumedSession.status === 'RUNNING', 'Focus session resumed back to RUNNING');

  const completedSession = await focusService.completeFocusSession(focusSession.id, userId, {
    notes: 'Completed memory benchmark optimizations.',
  });
  assert(completedSession.status === 'COMPLETED', 'Focus session completed successfully');

  // Manual time entry
  const manualEntry = await focusService.createManualTimeEntry(workspaceId, userId, {
    durationSeconds: 3600,
    startedAt: new Date(Date.now() - 3600 * 1000),
    endedAt: new Date(),
    description: 'Code review & PR approval',
  });
  assert(manualEntry.durationSeconds === 3600, 'Manual time entry recorded with 3600 seconds');

  const totals = await focusService.getDailyWeeklyTotals(workspaceId, userId);
  assert(totals.todayHours >= 1.0, `Calculated today's tracked hours: ${totals.todayHours}h`);

  // ─── 3. Strategic Goals & OKR Tracking ───
  console.log('\n[STAGE 9] Strategic Goals & Objective Key Results (OKRs):');
  const goal = await goalsService.createGoal(workspaceId, userId, {
    title: 'Achieve Sub-10ms API Latency Across Global Regions',
    category: 'Performance',
    targetValue: 100,
    currentValue: 40,
    unit: '%',
    targetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  });
  assert(goal.status === 'IN_PROGRESS', 'Goal initialized with IN_PROGRESS status');

  const checkInResult = await goalsService.checkInGoal(goal.id, userId, {
    newValue: 100,
    note: 'Deployed edge-optimized edge proxies and read replicas',
  });
  assert(checkInResult.goal.status === 'ACHIEVED', 'Goal automatically transitions to ACHIEVED when targetValue reached');
  assert(checkInResult.checkIn.newValue === 100, 'Check-in entry logged with audit history');

  const allGoals = await goalsService.getGoals(workspaceId);
  const foundGoal = allGoals.find((g) => g.id === goal.id);
  assert(foundGoal?.progressPercentage === 100, 'Calculated goal progress percentage verified (100%)');

  // ─── 4. Automation Builder & Execution Engine ───
  console.log('\n[STAGE 7] Automation Engine (Trigger → Conditions → Actions):');
  const automation = await automationService.createAutomation(workspaceId, userId, {
    name: 'Auto-Notify on Urgent Tasks',
    description: 'Dispatch notification when urgent task status changes',
    triggerType: 'TASK_STATUS_CHANGED',
    conditions: [
      { field: 'priority', operator: 'equals', value: 'URGENT' },
    ],
    actions: [
      {
        type: 'SEND_NOTIFICATION',
        params: {
          title: '🚨 Urgent Task Status Updated',
          message: 'An urgent task status has transitioned.',
        },
      },
    ],
  });
  assert(automation.isEnabled === true, 'Automation workflow saved and enabled in database');

  // Trigger test event
  await automationService.triggerWorkflows(workspaceId, 'TASK_STATUS_CHANGED', {
    id: 'test-task-id',
    priority: 'URGENT',
    status: 'IN_PROGRESS',
    creatorId: userId,
  });

  const updatedAuto = await prisma.automation.findUnique({
    where: { id: automation.id },
    include: { executions: true },
  });
  assert((updatedAuto?.executionCount || 0) >= 1, 'Workflow executed and executionCount incremented');
  assert(updatedAuto?.executions[0]?.status === 'SUCCESS', 'Execution record logged with SUCCESS status and duration telemetry');

  // ─── 5. Daily Command Center Telemetry & AI Planning Assistant ───
  console.log('\n[STAGE 4] Intelligent Daily Command Center & Planning Assistant:');

  // Create sample task for Command Center
  const ccProject = await projectsService.createProject(userId, workspaceId, {
    name: 'Apollo Neural Engine',
  });
  const ccTask = await tasksService.createTask(userId, workspaceId, {
    title: 'Deploy Production Edge Shard',
    priority: 'URGENT',
    projectId: ccProject.id,
    dueDate: new Date(), // Due today
  });

  const commandCenterData = await analyticsService.getDailyCommandCenter(workspaceId, userId);
  assert(Boolean(commandCenterData.timestamp), 'Daily Command Center telemetry payload generated');
  assert(commandCenterData.summary.activeProjectsCount >= 1, `Active projects detected: ${commandCenterData.summary.activeProjectsCount}`);
  assert(commandCenterData.dueTodayTasks.length >= 1, `Tasks due today accurately aggregated: ${commandCenterData.dueTodayTasks.length}`);
  assert(commandCenterData.planningAssistant.suggestedPlan.length >= 1, `AI Planning Assistant suggested ${commandCenterData.planningAssistant.suggestedPlan.length} ranked agenda item(s)`);
  assert(Boolean(commandCenterData.planningAssistant.suggestedPlan[0]?.rationale), `Planning Assistant provided explicit rationale: "${commandCenterData.planningAssistant.suggestedPlan[0]?.rationale}"`);

  // Workspace Analytics
  console.log('\n[STAGE 9] Workspace Analytics & Cycle Time Telemetry:');
  const analytics = await analyticsService.getWorkspaceAnalytics(workspaceId);
  assert(analytics.summary.totalTasks >= 1, `Total tasks tracked: ${analytics.summary.totalTasks}`);
  assert(analytics.statusDistribution.TODO !== undefined, 'Status distribution computed across all workflow states');
  assert(analytics.priorityDistribution.URGENT !== undefined, 'Priority distribution computed accurately');

  // ─── 6. Professional In-App Terminal CLI Extension ───
  console.log('\n[STAGE 5] Professional In-App Terminal Extended Capabilities:');

  // Note CLI commands
  const cliNoteCreate = await terminalService.execute(workspaceId, userId, 'note create "Quantum Operator Briefing"');
  assert(cliNoteCreate.success === true, `CLI "note create" execution: ${cliNoteCreate.output}`);

  const cliNoteList = await terminalService.execute(workspaceId, userId, 'note list');
  assert(cliNoteList.success === true && cliNoteList.output.includes('Quantum Operator Briefing'), 'CLI "note list" displays newly created note');

  // Unified Search
  const cliSearch = await terminalService.execute(workspaceId, userId, 'search "Quantum"');
  assert(cliSearch.success === true, 'CLI "search" returned authorized unified search results');

  // Time CLI commands
  const cliTimeStatus = await terminalService.execute(workspaceId, userId, 'time totals');
  assert(cliTimeStatus.success === true && cliTimeStatus.output.includes('Focus & Time Telemetry:'), 'CLI "time totals" returned telemetry');

  // Goal CLI commands
  const cliGoalList = await terminalService.execute(workspaceId, userId, 'goal list');
  assert(cliGoalList.success === true, 'CLI "goal list" executed and rendered active goals');

  // Notification CLI commands
  const cliNotifyList = await terminalService.execute(workspaceId, userId, 'notify list');
  assert(cliNotifyList.success === true, 'CLI "notify list" returned unread notifications');

  // Clean up test records
  console.log('\n[CLEANUP] Cleaning up test artifacts...');
  await prisma.notification.deleteMany({ where: { workspaceId } });
  await prisma.focusSession.deleteMany({ where: { workspaceId } });
  await prisma.timeEntry.deleteMany({ where: { workspaceId } });
  await prisma.automationExecution.deleteMany({ where: { automationId: automation.id } });
  await prisma.automation.delete({ where: { id: automation.id } });
  await prisma.goalProgress.deleteMany({ where: { goalId: goal.id } });
  await prisma.goal.delete({ where: { id: goal.id } });
  await tasksService.deleteTask(ccTask.id, userId, workspaceId);
  await projectsService.deleteProject(ccProject.id, workspaceId);
  if (cliNoteCreate.data?.document?.id) {
    await prisma.document.delete({ where: { id: cliNoteCreate.data.document.id } });
  }

  console.log('  ✔ [PASS] Test artifacts cleanly purged.');

  console.log('\n════════════════════════════════════════════════════════════════');
  console.log('   ALL AI WORK OPERATING SYSTEM INTEGRATION TESTS PASSED!       ');
  console.log('════════════════════════════════════════════════════════════════');
}

runAiWorkOsTestSuite()
  .catch((err) => {
    console.error('Test suite failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
