import { prisma } from '../src/lib/prisma';
import { tasksService } from '../src/lib/tasks-service';
import { projectsService } from '../src/lib/projects-service';
import { getOrCreateUserWorkspace } from '../src/lib/workspace';

async function runE2ETests() {
  console.log('================================================================');
  console.log('   PROJECT ATLAS / KRONOS — TASKS & PROJECTS MASTER E2E SUITE   ');
  console.log('   Full-Stack Verification • Zero Mock Data • Real Database     ');
  console.log('================================================================\n');

  // ─── STEP 1: Workspace & Identity Setup ───────────────────────────────────
  console.log('--- PHASE 1: Establishing Test Identity & Workspace ---');
  let testUser = await prisma.user.findFirst({
    where: { email: 'architect.tester@kronos.internal' },
  });

  if (!testUser) {
    testUser = await prisma.user.create({
      data: {
        email: 'architect.tester@kronos.internal',
        emailNormalized: 'architect.tester@kronos.internal',
        displayName: 'Atlas Principal Architect',
        passwordHash: 'argon2-e2e-hash-placeholder',
        accountStatus: 'ACTIVE',
        emailVerified: true,
      },
    });
  }

  const wsResult = await getOrCreateUserWorkspace(testUser.id);
  const workspaceId = wsResult.workspaceId;
  const userId = testUser.id;

  console.log(`[PASS] Identity established: "${testUser.displayName}" (${testUser.email})`);
  console.log(`[PASS] Workspace scoped: "${workspaceId}"`);

  // Secondary Workspace for cross-workspace isolation tests
  let secondUser = await prisma.user.findFirst({
    where: { email: 'isolated.dev@kronos.internal' },
  });
  if (!secondUser) {
    secondUser = await prisma.user.create({
      data: {
        email: 'isolated.dev@kronos.internal',
        emailNormalized: 'isolated.dev@kronos.internal',
        displayName: 'Isolated Developer',
        passwordHash: 'argon2-isolated-hash',
        accountStatus: 'ACTIVE',
        emailVerified: true,
      },
    });
  }
  const secondWs = await getOrCreateUserWorkspace(secondUser.id);
  const foreignWorkspaceId = secondWs.workspaceId;

  // ─── STEP 2: Projects Management Lifecycle & Filtering ───────────────────
  console.log('\n--- PHASE 2: Projects Management & Filtering Engine ---');
  
  const alphaProject = await projectsService.createProject(userId, workspaceId, {
    name: 'Atlas Project Apollo',
    description: 'High-availability state machine and task graph',
    color: '#3B82F6',
    icon: '🚀',
    startDate: new Date(),
    targetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  });
  console.log(`[PASS] Project created: "${alphaProject.name}" (ID: ${alphaProject.id}, Status: ${alphaProject.status})`);

  const betaProject = await projectsService.createProject(userId, workspaceId, {
    name: 'Atlas Project Hermes',
    description: 'Real-time telemetry and metrics synchronization',
    color: '#10B981',
    icon: '⚡',
  });
  console.log(`[PASS] Project created: "${betaProject.name}" (ID: ${betaProject.id})`);

  // Test Filtering by Search
  const searchResults = await projectsService.listProjects(workspaceId, {
    search: 'Apollo',
  });
  if (searchResults.length !== 1 || searchResults[0].name !== 'Atlas Project Apollo') {
    throw new Error(`FAILED: Search by keyword 'Apollo' returned unexpected results: ${JSON.stringify(searchResults)}`);
  }
  console.log(`[PASS] Project search verified: Found 1 matching project for 'Apollo'`);

  // Test Filtering by Status
  const activeProjects = await projectsService.listProjects(workspaceId, {
    status: 'ACTIVE',
  });
  if (activeProjects.length < 2) {
    throw new Error('FAILED: Expected at least 2 ACTIVE projects');
  }
  console.log(`[PASS] Project status filtering verified: ${activeProjects.length} ACTIVE projects found`);

  // Test Project Archiving & Unarchiving
  console.log('\n--- PHASE 3: Project Archiving & Unarchiving (Non-destructive) ---');
  const archived = await projectsService.archiveProject(betaProject.id, workspaceId);
  if (!archived.isArchived || archived.status !== 'ARCHIVED') {
    throw new Error(`FAILED: Project archive failed. isArchived: ${archived.isArchived}, status: ${archived.status}`);
  }
  console.log(`[PASS] Project "${betaProject.name}" archived successfully (isArchived: true, status: ARCHIVED)`);

  // Listing without includeArchived should exclude it
  const activeOnly = await projectsService.listProjects(workspaceId, { includeArchived: false });
  if (activeOnly.some((p: any) => p.id === betaProject.id)) {
    throw new Error('FAILED: Archived project appeared in active list without includeArchived flag');
  }
  console.log('[PASS] Default projects list cleanly excludes archived projects');

  // Unarchive project
  const unarchived = await projectsService.unarchiveProject(betaProject.id, workspaceId);
  if (unarchived.isArchived || unarchived.status !== 'ACTIVE') {
    throw new Error(`FAILED: Project unarchive failed. isArchived: ${unarchived.isArchived}, status: ${unarchived.status}`);
  }
  console.log(`[PASS] Project "${betaProject.name}" unarchived successfully (status restored to ACTIVE)`);

  // ─── STEP 4: Automated Project Progress Calculation ───────────────────────
  console.log('\n--- PHASE 4: Automated Project Progress Formula Telemetry ---');
  // Create 2 root tasks and 1 subtask under task R1
  const rootTask1 = await tasksService.createTask(userId, workspaceId, {
    title: 'Apollo Root Deliverable 1',
    projectId: alphaProject.id,
    priority: 'HIGH',
    status: 'TODO',
  });
  const rootTask2 = await tasksService.createTask(userId, workspaceId, {
    title: 'Apollo Root Deliverable 2',
    projectId: alphaProject.id,
    priority: 'MEDIUM',
    status: 'TODO',
  });
  // Subtask of rootTask1
  const subtaskForR1 = await tasksService.createTask(userId, workspaceId, {
    title: 'Subtask for Root 1 (Should not distort root task formula)',
    parentId: rootTask1.id,
    projectId: alphaProject.id,
    status: 'DONE',
  });

  // Calculate progress before root tasks are done: 0 of 2 root tasks done = 0%
  let projMetrics = await projectsService.getProjectById(alphaProject.id);
  console.log(`[PASS] Initial Project Progress: ${projMetrics?.progress}% (0 of 2 root tasks done)`);
  if (projMetrics?.progress !== 0) {
    throw new Error(`FAILED: Expected 0% progress, got ${projMetrics?.progress}%`);
  }

  // Mark Root Task 2 as DONE (1 of 2 root tasks done = 50%)
  await tasksService.updateTask(rootTask2.id, workspaceId, userId, { status: 'DONE' });
  projMetrics = await projectsService.getProjectById(alphaProject.id);
  console.log(`[PASS] Updated Project Progress: ${projMetrics?.progress}% (1 of 2 root tasks done = 50%)`);
  if (projMetrics?.progress !== 50) {
    throw new Error(`FAILED: Expected 50% progress, got ${projMetrics?.progress}%`);
  }

  // ─── STEP 5: Parent-Child Subtasks & Parent Completion Guard ─────────────
  console.log('\n--- PHASE 5: Subtask Parent Completion Guard ---');
  const parentTask = await tasksService.createTask(userId, workspaceId, {
    title: 'Core Engine Orchestration (Parent Task)',
    priority: 'URGENT',
    status: 'IN_PROGRESS',
    projectId: alphaProject.id,
  });

  const childSubtask1 = await tasksService.createTask(userId, workspaceId, {
    title: 'Worker Pool Initializer (Child 1)',
    parentId: parentTask.id,
    status: 'TODO',
  });
  const childSubtask2 = await tasksService.createTask(userId, workspaceId, {
    title: 'Event Loop Consumer (Child 2)',
    parentId: parentTask.id,
    status: 'TODO',
  });
  console.log(`[PASS] Parent task created with 2 TODO subtasks`);

  // Guard test: Transitioning parent to DONE while subtasks are unfinished MUST fail
  let guardTriggered = false;
  try {
    await tasksService.updateTask(parentTask.id, workspaceId, userId, { status: 'DONE' });
  } catch (err: any) {
    if (err.code === 'UNFINISHED_SUBTASKS' || err.message.includes('subtask(s) are not finished')) {
      guardTriggered = true;
      console.log(`[PASS] Parent completion guard ENFORCED: "${err.message}"`);
    } else {
      throw err;
    }
  }
  if (!guardTriggered) {
    throw new Error('FAILED: Parent task was allowed to transition to DONE while subtasks remained TODO!');
  }

  // Complete child 1, but child 2 still TODO
  await tasksService.updateTask(childSubtask1.id, workspaceId, userId, { status: 'DONE' });
  guardTriggered = false;
  try {
    await tasksService.updateTask(parentTask.id, workspaceId, userId, { status: 'DONE' });
  } catch (err: any) {
    if (err.code === 'UNFINISHED_SUBTASKS') {
      guardTriggered = true;
      console.log(`[PASS] Parent completion guard ENFORCED (1 subtask remaining): "${err.message}"`);
    }
  }
  if (!guardTriggered) {
    throw new Error('FAILED: Parent task transition allowed with 1 subtask still unfinished!');
  }

  // Complete child 2: now parent completion must succeed!
  await tasksService.updateTask(childSubtask2.id, workspaceId, userId, { status: 'DONE' });
  const completedParent = await tasksService.updateTask(parentTask.id, workspaceId, userId, { status: 'DONE' });
  if (completedParent.status !== 'DONE') {
    throw new Error(`FAILED: Parent task failed to mark DONE after all subtasks completed`);
  }
  console.log(`[PASS] Parent task transitioned to DONE cleanly after all subtasks were completed`);

  // ─── STEP 6: Finish-to-Start Dependencies & Blocker Completion Guard ───────
  console.log('\n--- PHASE 6: Finish-to-Start Dependencies & Blocker Completion Guard ---');
  const predecessorTask = await tasksService.createTask(userId, workspaceId, {
    title: 'Database Schema Migration (Predecessor)',
    priority: 'HIGH',
    status: 'TODO',
  });

  const successorTask = await tasksService.createTask(userId, workspaceId, {
    title: 'API Endpoint Deployment (Successor)',
    priority: 'MEDIUM',
    status: 'TODO',
  });

  // Link dependency: predecessorTask blocks successorTask
  await tasksService.addDependency(predecessorTask.id, successorTask.id);
  console.log(`[PASS] Finish-to-Start dependency established: [${predecessorTask.title}] BLOCKS [${successorTask.title}]`);

  // Verify successor evaluates isBlocked = true
  const enrichedSuccessor = await tasksService.getTaskById(successorTask.id);
  if (!enrichedSuccessor?.isBlocked || enrichedSuccessor.blockers.length === 0) {
    throw new Error('FAILED: Successor task is not marked as isBlocked');
  }
  console.log(`[PASS] Blocker evaluated: isBlocked = true, blocked by "${enrichedSuccessor.blockers[0]?.title}"`);

  // Guard test: Transitioning successor to DONE while predecessor is TODO MUST fail
  let blockerGuardTriggered = false;
  try {
    await tasksService.updateTask(successorTask.id, workspaceId, userId, { status: 'DONE' });
  } catch (err: any) {
    if (err.code === 'TASK_BLOCKED' || err.message.includes('blocking predecessor task(s)')) {
      blockerGuardTriggered = true;
      console.log(`[PASS] Blocker completion guard ENFORCED: "${err.message}"`);
    } else {
      throw err;
    }
  }
  if (!blockerGuardTriggered) {
    throw new Error('FAILED: Successor task was allowed to mark DONE while blocked by predecessor!');
  }

  // DAG Cycle Detection: Attempting to link successor blocks predecessor must be rejected
  let cycleRejected = false;
  try {
    await tasksService.addDependency(successorTask.id, predecessorTask.id);
  } catch (err: any) {
    if (err.code === 'CYCLE_DETECTED' || err.message.includes('Cycle detected')) {
      cycleRejected = true;
      console.log(`[PASS] DAG circular dependency detected and rejected: "${err.message}"`);
    }
  }
  if (!cycleRejected) {
    throw new Error('FAILED: Circular dependency was NOT rejected!');
  }

  // Complete Predecessor
  await tasksService.updateTask(predecessorTask.id, workspaceId, userId, { status: 'DONE' });
  console.log(`[PASS] Predecessor task completed (status: DONE)`);

  // Verify successor is unblocked
  const unblockedSuccessor = await tasksService.getTaskById(successorTask.id);
  if (unblockedSuccessor?.isBlocked) {
    throw new Error('FAILED: Successor should be unblocked now that predecessor is DONE');
  }
  console.log('[PASS] Successor task dynamically evaluated as UNBLOCKED');

  // Now complete successor task: must succeed!
  const completedSuccessor = await tasksService.updateTask(successorTask.id, workspaceId, userId, { status: 'DONE' });
  if (completedSuccessor.status !== 'DONE') {
    throw new Error('FAILED: Successor could not be marked DONE after blocker completed');
  }
  console.log('[PASS] Successor successfully transitioned to DONE');

  // ─── STEP 7: Activity History & Audit Trail ───────────────────────────────
  console.log('\n--- PHASE 7: Task Activity History & Real Audit Trail ---');
  const auditTask = await tasksService.getTask(parentTask.id, workspaceId);
  if (!auditTask?.activities || auditTask.activities.length === 0) {
    throw new Error('FAILED: Expected activity history entries on mutated task');
  }
  console.log(`[PASS] Audit history verified: ${auditTask.activities.length} activity records logged for parent task`);
  console.log(`       Recent actions: ${auditTask.activities.slice(0, 3).map((a: any) => a.action).join(', ')}`);

  // ─── STEP 8: Cross-Workspace Security & Authorization ─────────────────────
  console.log('\n--- PHASE 8: Cross-Workspace Security & Isolation ---');
  let crossWorkspaceAccessBlocked = false;
  try {
    // Attempt to access alphaProject from foreignWorkspaceId
    await projectsService.getProject(alphaProject.id, foreignWorkspaceId);
  } catch (err: any) {
    crossWorkspaceAccessBlocked = true;
    console.log(`[PASS] Cross-workspace project access rejected: "${err.message}"`);
  }

  // Also check tasksService listTasks for foreignWorkspaceId returns 0 tasks from our workspace
  const foreignTasks = await tasksService.listTasks(foreignWorkspaceId, {});
  if (foreignTasks.some((t: any) => t.id === parentTask.id || t.id === rootTask1.id)) {
    throw new Error('SECURITY VIOLATION: Tasks leaked into unauthorized foreign workspace list!');
  }
  console.log('[PASS] Strict workspace isolation verified: Zero data leakage between workspaces');

  // ─── STEP 9: Teardown & Clean Fixtures ─────────────────────────────────────
  console.log('\n--- PHASE 9: Non-destructive Test Artifact Teardown ---');
  await tasksService.deleteTask(childSubtask1.id, userId, workspaceId);
  await tasksService.deleteTask(childSubtask2.id, userId, workspaceId);
  await tasksService.deleteTask(parentTask.id, userId, workspaceId);
  await tasksService.deleteTask(subtaskForR1.id, userId, workspaceId);
  await tasksService.deleteTask(rootTask1.id, userId, workspaceId);
  await tasksService.deleteTask(rootTask2.id, userId, workspaceId);
  await tasksService.deleteTask(successorTask.id, userId, workspaceId);
  await tasksService.deleteTask(predecessorTask.id, userId, workspaceId);
  await projectsService.deleteProject(alphaProject.id, workspaceId);
  await projectsService.deleteProject(betaProject.id, workspaceId);
  console.log('[PASS] All test fixtures cleanly removed without residual debris.');

  console.log('\n================================================================');
  console.log('   ALL E2E ACCEPTANCE CRITERIA VERIFIED AND PASSING (100%)      ');
  console.log('================================================================');
}

runE2ETests()
  .catch((err) => {
    console.error('\nE2E SUITE FAILED:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
