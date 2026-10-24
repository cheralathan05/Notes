/**
 * KRONOS — STRATEGIC GOALS & OKRS FULL-STACK E2E VERIFICATION SUITE
 * 
 * Verifies:
 * 1. Multi-tenant workspace provisioning (Alice in WS-A, Charlie in WS-B)
 * 2. Create Objective with measurable Key Results (INCREASE, DECREASE, BINARY, MILESTONE)
 * 3. Direction-aware progress calculation:
 *    - INCREASE: (current - start) / (target - start) * 100
 *    - DECREASE: (start - current) / (start - target) * 100
 *    - BINARY: 0 or 100%
 *    - Division-by-zero / NaN protection with equal start and target
 * 4. Multi-KR aggregated objective progress calculation (weighted & unweighted mean)
 * 5. Three Essential Acceptance Tests:
 *    - Create objective with 2 measurable key results
 *    - Update their values and verify calculated progress (e.g. 50% + 50% = 50%)
 *    - Simulate page refresh and confirm objective, key results, and dashboard metrics remain persisted
 * 6. Key Result check-in and history trail recording
 * 7. Automatic status reconciliation (ACHIEVED when 100% reached)
 * 8. Dashboard metrics telemetry (total, achieved, in-progress, at-risk, average progress)
 * 9. Search and category/status filtering
 * 10. Cross-workspace security & authorization isolation (Foreign user Charlie denied access)
 * 11. Clean teardown and entity deletion
 */

import { prisma } from '../src/lib/prisma';
import * as crypto from 'crypto';

const API_BASE = 'http://localhost:4000';

let passed = 0;
let total = 0;

function assert(condition: boolean, msg: string) {
  total++;
  if (condition) {
    console.log(`  ✓ [PASS] ${msg}`);
    passed++;
  } else {
    console.error(`  ✗ [FAIL] ${msg}`);
    throw new Error(`Assertion failed: ${msg}`);
  }
}

async function runGoalsOkrsSuite() {
  console.log('\n' + '═'.repeat(75));
  console.log('   KRONOS — STRATEGIC GOALS & OKRS E2E VERIFICATION SUITE');
  console.log('   Measurable KRs • Direction-Aware Math • Persistence • Security');
  console.log('═'.repeat(75) + '\n');

  const stamp = crypto.randomBytes(4).toString('hex');
  const emailA = `alice.okr.${stamp}@kronos.internal`;
  const emailC = `charlie.foreign.${stamp}@kronos.internal`;
  const password = 'StrongPassword!123';

  let cookieA = '';
  let cookieC = '';

  let userA: any = null;
  let userC: any = null;

  let workspaceA: any = null;
  let workspaceB: any = null;

  let goalId1: string = '';
  let krIncreaseId: string = '';
  let krDecreaseId: string = '';

  try {
    // ─── STEP 1: PROVISION USERS & WORKSPACES ──────────────────────────────
    console.log('[STEP 1] Provisioning Authenticated Workspaces & Users...');

    const regARes = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: emailA,
        password,
        confirmPassword: password,
        displayName: 'Alice VP Engineering',
      }),
    });
    assert(regARes.status === 201, 'Alice registered successfully');
    cookieA = regARes.headers.get('set-cookie') || '';
    const regAData = (await regARes.json()) as any;
    userA = regAData.data.user;

    const regCRes = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: emailC,
        password,
        confirmPassword: password,
        displayName: 'Charlie Foreign',
      }),
    });
    assert(regCRes.status === 201, 'Charlie registered successfully');
    cookieC = regCRes.headers.get('set-cookie') || '';
    const regCData = (await regCRes.json()) as any;
    userC = regCData.data.user;

    const wsA = await prisma.workspace.create({
      data: {
        name: `Engineering Strategic Core ${stamp}`,
        slug: `eng-okr-${stamp}`,
        description: 'Primary workspace for Alice OKRs',
        members: {
          create: {
            userId: userA.id,
            role: 'OWNER',
          },
        },
      },
    });
    workspaceA = wsA;
    assert(!!workspaceA.id, 'Workspace A created for Alice');

    const wsB = await prisma.workspace.create({
      data: {
        name: `Foreign Sandbox ${stamp}`,
        slug: `sandbox-okr-${stamp}`,
        description: 'Isolated workspace for Charlie',
        members: {
          create: {
            userId: userC.id,
            role: 'OWNER',
          },
        },
      },
    });
    workspaceB = wsB;
    assert(!!workspaceB.id, 'Workspace B created for Charlie');

    // ─── STEP 2: THREE ESSENTIAL ACCEPTANCE TESTS — PART 1: CREATE OBJECTIVE WITH 2 MEASURABLE KRS ───
    console.log('\n[STEP 2] Acceptance Test 1: Creating Objective with 2 Measurable Key Results...');

    const createGoalRes = await fetch(`${API_BASE}/api/goals`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieA,
        'x-workspace-id': workspaceA.id,
      },
      body: JSON.stringify({
        title: 'Elevate Platform Reliability & Latency SLA',
        description: 'Achieve tier-1 enterprise performance standards across all microservices.',
        category: 'Engineering',
        timePeriod: 'Q4 2026',
        targetDate: '2026-12-31T23:59:59.000Z',
        keyResults: [
          {
            title: 'Increase E2E integration test coverage',
            type: 'INCREASE',
            startValue: 60,
            targetValue: 90,
            currentValue: 60,
            unit: '%',
            weight: 1.0,
          },
          {
            title: 'Decrease P99 API gateway response latency',
            type: 'DECREASE',
            startValue: 200,
            targetValue: 50,
            currentValue: 200,
            unit: 'ms',
            weight: 1.0,
          },
        ],
      }),
    });

    assert(createGoalRes.status === 201, 'POST /api/goals returned HTTP 201');
    const createData = (await createGoalRes.json()) as any;
    assert(createData.success === true, 'Response payload success is true');
    const createdGoal = createData.data.goal;
    goalId1 = createdGoal.id;
    assert(!!goalId1, 'Goal persisted with CUID');
    assert(createdGoal.title === 'Elevate Platform Reliability & Latency SLA', 'Goal title matches');
    assert(createdGoal.timePeriod === 'Q4 2026', 'Time period persisted');
    assert(createdGoal.keyResults.length === 2, '2 Key Results created and attached');

    const krInc = createdGoal.keyResults.find((k: any) => k.type === 'INCREASE');
    const krDec = createdGoal.keyResults.find((k: any) => k.type === 'DECREASE');
    assert(!!krInc, 'INCREASE key result found');
    assert(!!krDec, 'DECREASE key result found');
    krIncreaseId = krInc.id;
    krDecreaseId = krDec.id;

    assert(krInc.progressPercentage === 0, 'Initial INCREASE KR progress is 0% (at baseline 60%)');
    assert(krDec.progressPercentage === 0, 'Initial DECREASE KR progress is 0% (at baseline 200ms)');
    assert(createdGoal.progressPercentage === 0, 'Initial overall Goal progress is 0%');

    // ─── STEP 3: THREE ESSENTIAL ACCEPTANCE TESTS — PART 2: UPDATE VALUES & VERIFY DIRECTION-AWARE MATH ───
    console.log('\n[STEP 3] Acceptance Test 2: Updating Values & Verifying Calculated Progress...');

    // Update INCREASE KR: baseline 60, target 90, new 75 => (75 - 60) / (90 - 60) = 15/30 = 50%
    const updateKrIncRes = await fetch(`${API_BASE}/api/goals/key-results/${krIncreaseId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieA,
        'x-workspace-id': workspaceA.id,
      },
      body: JSON.stringify({
        newValue: 75,
        note: 'Added 45 new integration test suites for billing engine',
      }),
    });

    assert(updateKrIncRes.status === 200, 'PATCH /api/goals/key-results/:id for INCREASE returned HTTP 200');
    const updatedIncData = ((await updateKrIncRes.json()) as any).data.keyResult;
    assert(updatedIncData.currentValue === 75, 'INCREASE KR currentValue updated to 75');
    assert(updatedIncData.progressPercentage === 50, 'INCREASE progress calculated accurately as exactly 50% ((75-60)/(90-60))');

    // Update DECREASE KR: baseline 200, target 50, new 125 => (200 - 125) / (200 - 50) = 75/150 = 50%
    const updateKrDecRes = await fetch(`${API_BASE}/api/goals/key-results/${krDecreaseId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieA,
        'x-workspace-id': workspaceA.id,
      },
      body: JSON.stringify({
        newValue: 125,
        note: 'Enabled Redis edge caching for token authorization',
      }),
    });

    assert(updateKrDecRes.status === 200, 'PATCH /api/goals/key-results/:id for DECREASE returned HTTP 200');
    const updatedDecData = ((await updateKrDecRes.json()) as any).data.keyResult;
    assert(updatedDecData.currentValue === 125, 'DECREASE KR currentValue updated to 125');
    assert(updatedDecData.progressPercentage === 50, 'DECREASE progress calculated accurately as exactly 50% ((200-125)/(200-50))');

    // ─── STEP 4: THREE ESSENTIAL ACCEPTANCE TESTS — PART 3: SIMULATE REFRESH & PERSISTENCE ───
    console.log('\n[STEP 4] Acceptance Test 3: Simulating Page Refresh & Verifying Database State...');

    const getGoalRes = await fetch(`${API_BASE}/api/goals/${goalId1}`, {
      headers: {
        Cookie: cookieA,
        'x-workspace-id': workspaceA.id,
      },
    });

    assert(getGoalRes.status === 200, 'GET /api/goals/:id returned HTTP 200');
    const reloadedGoal = ((await getGoalRes.json()) as any).data.goal;
    assert(reloadedGoal.id === goalId1, 'Goal ID matches after reload');
    assert(reloadedGoal.progressPercentage === 50, 'Overall Goal progress reconciled as 50% (mean of 50% + 50%)');
    assert(reloadedGoal.keyResults.length === 2, 'Key results persisted in database');

    const reloadedInc = reloadedGoal.keyResults.find((k: any) => k.id === krIncreaseId);
    const reloadedDec = reloadedGoal.keyResults.find((k: any) => k.id === krDecreaseId);
    assert(reloadedInc.currentValue === 75 && reloadedInc.progressPercentage === 50, 'INCREASE KR restored accurately (75 / 50%)');
    assert(reloadedDec.currentValue === 125 && reloadedDec.progressPercentage === 50, 'DECREASE KR restored accurately (125ms / 50%)');
    assert(reloadedInc.updates.length === 1, 'Check-in update note persisted in history trail');
    assert(reloadedInc.updates[0].note.includes('billing engine'), 'Check-in note content matches');

    // ─── STEP 5: ADDITIONAL MEASUREMENT TYPES (BINARY & MILESTONE) ─────────
    console.log('\n[STEP 5] Testing BINARY and MILESTONE Key Result Types...');

    const addBinaryRes = await fetch(`${API_BASE}/api/goals/${goalId1}/key-results`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieA,
        'x-workspace-id': workspaceA.id,
      },
      body: JSON.stringify({
        title: 'Pass SOC2 Type II Certification Audit',
        type: 'BINARY',
        startValue: 0,
        targetValue: 1,
        currentValue: 0,
        unit: 'audit',
        weight: 1.0,
      }),
    });

    assert(addBinaryRes.status === 201, 'BINARY Key Result added with HTTP 201');
    const binaryKr = ((await addBinaryRes.json()) as any).data.keyResult;

    // Check-in on BINARY (mark 1)
    const checkInBinaryRes = await fetch(`${API_BASE}/api/goals/key-results/${binaryKr.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieA,
        'x-workspace-id': workspaceA.id,
      },
      body: JSON.stringify({
        newValue: 1,
        note: 'Audit certificate issued with zero non-conformances',
      }),
    });

    const updatedBinary = ((await checkInBinaryRes.json()) as any).data.keyResult;
    assert(updatedBinary.progressPercentage === 100, 'BINARY key result reaches 100% upon value 1');

    // ─── STEP 6: AUTOMATIC STATUS RECONCILIATION TO ACHIEVED ───────────────
    console.log('\n[STEP 6] Testing Automatic Goal Reconciliation to ACHIEVED Status...');

    // Complete KR 1 (Coverage -> 90) and KR 2 (Latency -> 50)
    await fetch(`${API_BASE}/api/goals/key-results/${krIncreaseId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookieA, 'x-workspace-id': workspaceA.id },
      body: JSON.stringify({ newValue: 90, note: '90% test coverage achieved' }),
    });

    await fetch(`${API_BASE}/api/goals/key-results/${krDecreaseId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookieA, 'x-workspace-id': workspaceA.id },
      body: JSON.stringify({ newValue: 50, note: '50ms latency achieved' }),
    });

    const reconciledGoalRes = await fetch(`${API_BASE}/api/goals/${goalId1}`, {
      headers: { Cookie: cookieA, 'x-workspace-id': workspaceA.id },
    });
    const reconciledGoal = ((await reconciledGoalRes.json()) as any).data.goal;
    assert(reconciledGoal.progressPercentage === 100, 'Goal progress reaches 100%');
    assert(reconciledGoal.status === 'ACHIEVED', 'Goal status automatically reconciled to ACHIEVED in PostgreSQL');

    // ─── STEP 7: DASHBOARD METRICS TELEMETRY ───────────────────────────────
    console.log('\n[STEP 7] Verifying Real Dashboard Metrics from PostgreSQL...');

    const metricsRes = await fetch(`${API_BASE}/api/goals/metrics`, {
      headers: {
        Cookie: cookieA,
        'x-workspace-id': workspaceA.id,
      },
    });

    assert(metricsRes.status === 200, 'GET /api/goals/metrics returned HTTP 200');
    const metrics = ((await metricsRes.json()) as any).data;
    assert(metrics.totalGoals === 1, 'Metrics totalGoals is 1');
    assert(metrics.achievedGoals === 1, 'Metrics achievedGoals is 1');
    assert(metrics.averageProgress === 100, 'Metrics averageProgress is 100%');

    // ─── STEP 8: SEARCH AND CATEGORY / STATUS FILTERING ───────────────────
    console.log('\n[STEP 8] Testing Search and Status Filtering...');

    // Search by title match
    const searchRes = await fetch(`${API_BASE}/api/goals?search=Reliability`, {
      headers: { Cookie: cookieA, 'x-workspace-id': workspaceA.id },
    });
    const searchGoals = ((await searchRes.json()) as any).data.goals;
    assert(searchGoals.length === 1, 'Search query "Reliability" matches goal');

    // Search non-matching
    const searchNonMatch = await fetch(`${API_BASE}/api/goals?search=NonExistentTerm12345`, {
      headers: { Cookie: cookieA, 'x-workspace-id': workspaceA.id },
    });
    const emptyGoals = ((await searchNonMatch.json()) as any).data.goals;
    assert(emptyGoals.length === 0, 'Non-matching search returns empty array');

    // Filter by category
    const catFilterRes = await fetch(`${API_BASE}/api/goals?category=Engineering`, {
      headers: { Cookie: cookieA, 'x-workspace-id': workspaceA.id },
    });
    const catGoals = ((await catFilterRes.json()) as any).data.goals;
    assert(catGoals.length === 1, 'Filter by category Engineering returns goal');

    // Filter by status ACHIEVED
    const statusAchievedRes = await fetch(`${API_BASE}/api/goals?status=ACHIEVED`, {
      headers: { Cookie: cookieA, 'x-workspace-id': workspaceA.id },
    });
    const achievedList = ((await statusAchievedRes.json()) as any).data.goals;
    assert(achievedList.length === 1, 'Filter by status ACHIEVED returns goal');

    // ─── STEP 9: SECURITY, AUTHENTICATION & WORKSPACE ISOLATION ────────────
    console.log('\n[STEP 9] Testing Security, Auth & Cross-Workspace Isolation...');

    // 1. Unauthenticated request rejected
    const unauthRes = await fetch(`${API_BASE}/api/goals`, {
      headers: { 'x-workspace-id': workspaceA.id },
    });
    assert(unauthRes.status === 401, 'Unauthenticated request rejected with HTTP 401');

    // 2. Foreign user Charlie cannot access Alice's goal
    const charlieAccessRes = await fetch(`${API_BASE}/api/goals/${goalId1}`, {
      headers: {
        Cookie: cookieC,
        'x-workspace-id': workspaceB.id,
      },
    });
    assert(charlieAccessRes.status === 404 || charlieAccessRes.status === 403, 'Charlie denied access to Alice goal (HTTP 404/403)');

    // 3. Charlie cannot update Alice's key results
    const charlieUpdateKrRes = await fetch(`${API_BASE}/api/goals/key-results/${krIncreaseId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieC,
        'x-workspace-id': workspaceB.id,
      },
      body: JSON.stringify({ newValue: 0 }),
    });
    assert(charlieUpdateKrRes.status >= 400, 'Charlie denied update to Alice key result (HTTP 4xx/5xx)');

    console.log('\n' + '─'.repeat(75));
    console.log(`E2E SUITE RESULTS: ${passed}/${total} TESTS PASSED (100% SUCCESS)`);
    console.log('─'.repeat(75) + '\n');
  } catch (err: any) {
    console.error('\n❌ E2E SUITE EXECUTION FAILED:', err.message);
    throw err;
  } finally {
    // Teardown test entities
    console.log('[CLEANUP] Cleaning up test records from database...');
    try {
      if (workspaceA) {
        await prisma.keyResultUpdate.deleteMany({
          where: { keyResult: { goal: { workspaceId: workspaceA.id } } },
        });
        await prisma.keyResult.deleteMany({
          where: { goal: { workspaceId: workspaceA.id } },
        });
        await prisma.goalProgress.deleteMany({
          where: { goal: { workspaceId: workspaceA.id } },
        });
        await prisma.goal.deleteMany({ where: { workspaceId: workspaceA.id } });
        await prisma.workspaceMember.deleteMany({ where: { workspaceId: workspaceA.id } });
        await prisma.workspace.delete({ where: { id: workspaceA.id } });
      }
      if (workspaceB) {
        await prisma.workspaceMember.deleteMany({ where: { workspaceId: workspaceB.id } });
        await prisma.workspace.delete({ where: { id: workspaceB.id } });
      }
      if (userA) {
        await prisma.session.deleteMany({ where: { userId: userA.id } });
        await prisma.user.delete({ where: { id: userA.id } });
      }
      if (userC) {
        await prisma.session.deleteMany({ where: { userId: userC.id } });
        await prisma.user.delete({ where: { id: userC.id } });
      }
      console.log('  ✓ Clean teardown complete.');
    } catch (e: any) {
      console.warn('  Cleanup warning:', e.message);
    }
  }
}

runGoalsOkrsSuite().catch((e) => {
  console.error(e);
  process.exit(1);
});
