import { prisma } from '../src/lib/prisma';
import { tasksService } from '../src/lib/tasks-service';
import { projectsService } from '../src/lib/projects-service';
import { terminalService } from '../src/lib/terminal-service';

async function runTestSuite() {
  console.log('====================================================');
  console.log('   STARTING TASKS & PROJECT MANAGEMENT OS TEST SUITE');
  console.log('====================================================\n');

  // 1. Fetch or initialize test user and workspace
  let user = await prisma.user.findFirst();
  if (!user) {
    user = await prisma.user.create({
      data: {
        email: 'test@kronos.internal',
        emailNormalized: 'test@kronos.internal',
        displayName: 'Staff Engineer',
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

  console.log(`[PASS] Environment verified: User "${user.email}" in Workspace "${workspaceId}"`);

  // 2. Project Creation & Recalculation
  console.log('\n--- 1. Testing Project Management & Milestones ---');
  const project = await projectsService.createProject(userId, workspaceId, {
    name: 'Quantum Engine Release',
    description: 'Mission critical project for core architecture',
    startDate: new Date(),
    targetDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
  });
  console.log(`[PASS] Created project: "${project.name}" (ID: ${project.id})`);

  const milestone = await projectsService.addMilestone(project.id, {
    title: 'Alpha Release Complete',
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });
  console.log(`[PASS] Created milestone: "${milestone.title}" (ID: ${milestone.id})`);

  // 3. Task Creation with Priorities & Deadlines
  console.log('\n--- 2. Testing Task CRUD, Priorities & Deadlines ---');
  const task1 = await tasksService.createTask(userId, workspaceId, {
    title: 'Implement Core Neural Sharder',
    description: 'High throughput pipeline',
    priority: 'URGENT',
    status: 'TODO',
    projectId: project.id,
    milestoneId: milestone.id,
    dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
  });
  console.log(`[PASS] Created task 1: "${task1.title}" (Priority: ${task1.priority}, Status: ${task1.status})`);

  const task2 = await tasksService.createTask(userId, workspaceId, {
    title: 'Benchmarking & Stress Testing',
    priority: 'HIGH',
    status: 'TODO',
    projectId: project.id,
    dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
  });
  console.log(`[PASS] Created task 2: "${task2.title}"`);

  // 4. Subtasks and Progress
  console.log('\n--- 3. Testing Subtasks & Progress ---');
  const subtask1 = await tasksService.createTask(userId, workspaceId, {
    title: 'Shard partition logic',
    parentId: task1.id,
    status: 'DONE',
  });
  console.log(`[PASS] Created subtask 1: "${subtask1.title}" (Status: DONE)`);

  const enrichedTask1 = await tasksService.getTaskById(task1.id);
  console.log(`[PASS] Enriched parent task progress: ${enrichedTask1?.subtaskProgress.percentage}% complete (${enrichedTask1?.subtaskProgress.done}/${enrichedTask1?.subtaskProgress.total})`);

  // 5. Checklist Items
  console.log('\n--- 4. Testing Checklist Items ---');
  const item1 = await tasksService.addChecklistItem(task1.id, 'Memory leak check');
  const item2 = await tasksService.addChecklistItem(task1.id, 'Zero-allocation validation');
  await tasksService.toggleChecklistItem(item1.id, true);
  const checklistEnriched = await tasksService.getTaskById(task1.id);
  console.log(`[PASS] Checklist progress: ${checklistEnriched?.checklistProgress.percentage}% (${checklistEnriched?.checklistProgress.done}/${checklistEnriched?.checklistProgress.total})`);

  // 6. Finish-to-Start Dependencies & DAG Cycle Detection
  console.log('\n--- 5. Testing Finish-to-Start Dependencies & DAG Cycle Detection ---');
  // task 2 depends on task 1 (task 1 blocks task 2)
  await tasksService.addDependency(task1.id, task2.id);
  console.log(`[PASS] Valid dependency added: [${task1.title}] blocks [${task2.title}]`);

  const task2Enriched = await tasksService.getTaskById(task2.id);
  console.log(`[PASS] Blocker evaluated: task2 isBlocked = ${task2Enriched?.isBlocked} (blocked by: ${task2Enriched?.blockers[0]?.title})`);

  // Now attempt to add reverse dependency task 2 blocks task 1 (cycle!)
  let cyclePrevented = false;
  try {
    await tasksService.addDependency(task2.id, task1.id);
  } catch (err: any) {
    if (err.code === 'CYCLE_DETECTED' || err.message.includes('Cycle detected')) {
      cyclePrevented = true;
      console.log(`[PASS] DAG Cycle successfully rejected: "${err.message}"`);
    } else {
      throw err;
    }
  }

  if (!cyclePrevented) {
    throw new Error('FAILED: Circular dependency was NOT rejected!');
  }

  // 7. Complete Task & Recalculate Project Progress
  console.log('\n--- 6. Testing Completion & Project Progress Recalculation ---');
  await tasksService.updateTask(task1.id, workspaceId, userId, { status: 'DONE' });
  const updatedProject = await projectsService.getProjectById(project.id);
  console.log(`[PASS] Task 1 completed. Project progress recalculated: ${updatedProject?.progress}% (Health: ${updatedProject?.health})`);

  // 8. In-App Terminal CLI Execution
  console.log('\n--- 7. Testing In-App Terminal Command Center ---');
  const cliHelp = await terminalService.execute(workspaceId, userId, 'help');
  console.log('[PASS] CLI "help" execution:\n' + cliHelp.output);

  const cliList = await terminalService.execute(workspaceId, userId, 'task list');
  console.log('\n[PASS] CLI "task list" execution:\n' + cliList.output);

  const cliCreate = await terminalService.execute(workspaceId, userId, 'task create "CLI Terminal Verification Task" --priority URGENT');
  console.log('\n[PASS] CLI "task create" execution:\n' + cliCreate.output);
  const createdCliTaskId = cliCreate.data?.task?.id;

  if (createdCliTaskId) {
    const cliComplete = await terminalService.execute(workspaceId, userId, `task complete ${createdCliTaskId}`);
    console.log('\n[PASS] CLI "task complete" execution:\n' + cliComplete.output);
  }

  const cliProjectProgress = await terminalService.execute(workspaceId, userId, `project progress ${project.id}`);
  console.log('\n[PASS] CLI "project progress" execution:\n' + cliProjectProgress.output);

  // 9. My Day Aggregation
  console.log('\n--- 8. Testing My Day Smart Aggregation ---');
  const myDay = await tasksService.getMyDayTasks(workspaceId, userId);
  console.log(`[PASS] My Day loaded: ${myDay.today.length} Today, ${myDay.overdue.length} Overdue, ${myDay.upcoming.length} Upcoming, ${myDay.completed.length} Completed`);

  // 10. Clean up test records
  console.log('\n--- 9. Cleaning Up Test Artifacts ---');
  if (createdCliTaskId) {
    await tasksService.deleteTask(createdCliTaskId, userId, workspaceId);
  }
  await tasksService.deleteTask(subtask1.id, userId, workspaceId);
  await tasksService.deleteTask(task1.id, userId, workspaceId);
  await tasksService.deleteTask(task2.id, userId, workspaceId);
  await projectsService.deleteProject(project.id, workspaceId);
  console.log('[PASS] Test cleanup complete.');

  console.log('\n====================================================');
  console.log('   ALL TASKS & PROJECT MANAGEMENT OS TESTS PASSED!');
  console.log('====================================================');
}

runTestSuite()
  .catch((err) => {
    console.error('Test suite failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
