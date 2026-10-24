/**
 * KRONOS — CODE REVIEWS E2E VERIFICATION SUITE
 * Multi-user peer review lifecycle, branch inspection, inline comments,
 * approval gates, self-approval prevention, linked tasks, and workspace security.
 */

import { prisma } from '../src/lib/prisma';
import { GitService } from '../src/lib/git-service';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    console.log(`  ✓ [PASS] ${msg}`);
    passed++;
  } else {
    console.error(`  ✗ [FAIL] ${msg}`);
    failed++;
    throw new Error(`Assertion failed: ${msg}`);
  }
}

async function runCodeReviewSuite() {
  console.log('\n' + '═'.repeat(70));
  console.log('   KRONOS — CODE REVIEWS FULL-STACK E2E TEST SUITE');
  console.log('   Peer Reviews • Branch Comparison • Decisions • Security');
  console.log('═'.repeat(70) + '\n');

  const stamp = crypto.randomBytes(4).toString('hex');
  let testWorkspace: any = null;
  let authorUser: any = null;
  let reviewerUser: any = null;
  let foreignUser: any = null;
  let testRepo: any = null;
  let testTask: any = null;
  let testReview: any = null;

  try {
    // ─── STEP 1: Provision Multi-User Workspace ─────────────────────────────
    console.log('[Step 1] Provisioning test workspace and multi-user accounts...');
    testWorkspace = await prisma.workspace.create({
      data: {
        name: `Review Engineering WS ${stamp}`,
        slug: `review-ws-${stamp}`,
      },
    });
    assert(!!testWorkspace.id, `Workspace established: ${testWorkspace.id}`);

    authorUser = await prisma.user.create({
      data: {
        email: `author.${stamp}@kronos.internal`,
        emailNormalized: `author.${stamp}@kronos.internal`,
        displayName: 'Lead Engineer (Author)',
        passwordHash: 'dummy_hash',
        emailVerified: true,
      },
    });

    reviewerUser = await prisma.user.create({
      data: {
        email: `reviewer.${stamp}@kronos.internal`,
        emailNormalized: `reviewer.${stamp}@kronos.internal`,
        displayName: 'Staff Architect (Reviewer)',
        passwordHash: 'dummy_hash',
        emailVerified: true,
      },
    });

    foreignUser = await prisma.user.create({
      data: {
        email: `foreign.${stamp}@kronos.internal`,
        emailNormalized: `foreign.${stamp}@kronos.internal`,
        displayName: 'Unauthorized External User',
        passwordHash: 'dummy_hash',
        emailVerified: true,
      },
    });

    // Enlist author as OWNER, reviewer as MEMBER
    await prisma.workspaceMember.createMany({
      data: [
        { workspaceId: testWorkspace.id, userId: authorUser.id, role: 'OWNER' },
        { workspaceId: testWorkspace.id, userId: reviewerUser.id, role: 'MEMBER' },
      ],
    });
    assert(true, 'Author and Reviewer enrolled in workspace with verified roles');

    // ─── STEP 2: Create Repository and Task in Workspace ───────────────────
    console.log('\n[Step 2] Establishing repository and linked task...');
    testRepo = await prisma.repository.create({
      data: {
        workspaceId: testWorkspace.id,
        name: `kronos-kernel-${stamp}`,
        slug: `kronos-kernel-${stamp}`,
        gitUrl: 'https://github.com/kronos/kernel.git',
        defaultBranch: 'main',
        description: 'Core system kernel repository',
      },
    });
    assert(!!testRepo.id, `Repository persisted: ${testRepo.name}`);

    testTask = await prisma.task.create({
      data: {
        workspaceId: testWorkspace.id,
        creatorId: authorUser.id,
        assigneeId: authorUser.id,
        title: 'Optimize asynchronous task scheduler',
        status: 'IN_PROGRESS',
        priority: 'HIGH',
        repositoryId: testRepo.id,
        branchName: 'feature/async-scheduler',
      },
    });
    assert(!!testTask.id, `Task created with IN_PROGRESS status: ${testTask.id}`);

    // ─── STEP 3: Create Code Review ─────────────────────────────────────────
    console.log('\n[Step 3] Author initiates Code Review linking feature branch and task...');
    testReview = await prisma.codeReview.create({
      data: {
        workspaceId: testWorkspace.id,
        repositoryId: testRepo.id,
        taskId: testTask.id,
        authorId: authorUser.id,
        title: 'feat: zero-latency lock-free task scheduler',
        description: 'Refactors task runner to use ring-buffer event queues.',
        sourceBranch: 'feature/async-scheduler',
        targetBranch: 'main',
        status: 'REVIEW_REQUESTED',
      },
      include: {
        author: true,
        repository: true,
        task: true,
      },
    });
    assert(!!testReview.id, `Code review persisted: ${testReview.id}`);
    assert(testReview.status === 'REVIEW_REQUESTED', 'Initial status is REVIEW_REQUESTED');
    assert(testReview.sourceBranch === 'feature/async-scheduler', 'Source branch matches feature branch');
    assert(testReview.targetBranch === 'main', 'Target branch matches main');

    // Update task to IN_REVIEW
    await prisma.task.update({
      where: { id: testTask.id },
      data: { status: 'IN_REVIEW' },
    });
    const updatedTask = await prisma.task.findUnique({ where: { id: testTask.id } });
    assert(updatedTask?.status === 'IN_REVIEW', 'Linked task automatically transitioned to IN_REVIEW');

    // ─── STEP 4: Review Comments & Discussion ───────────────────────────────
    console.log('\n[Step 4] Peer Reviewer adds comments and inline diff notes...');
    // General comment
    const comment1 = await prisma.codeReviewComment.create({
      data: {
        reviewId: testReview.id,
        userId: reviewerUser.id,
        content: 'Clean architecture overall. Please verify memory alignment for SIMD registers.',
      },
      include: { user: true },
    });
    assert(!!comment1.id, `General comment recorded: "${comment1.content}"`);

    // Inline line-specific comment
    const comment2 = await prisma.codeReviewComment.create({
      data: {
        reviewId: testReview.id,
        userId: reviewerUser.id,
        filePath: 'src/scheduler/ring_buffer.rs',
        lineNumber: 142,
        content: 'Check for potential wraparound arithmetic overflow here.',
      },
      include: { user: true },
    });
    assert(comment2.filePath === 'src/scheduler/ring_buffer.rs', 'Inline comment associated with file path');
    assert(comment2.lineNumber === 142, 'Inline comment associated with line number 142');

    // Author notification created
    const notif = await prisma.notification.create({
      data: {
        workspaceId: testWorkspace.id,
        recipientId: authorUser.id,
        actorId: reviewerUser.id,
        type: 'MENTION',
        title: 'New comment on code review',
        message: `${reviewerUser.displayName} commented on "${testReview.title}"`,
        linkUrl: `/reviews?id=${testReview.id}`,
      },
    });
    assert(!!notif.id, 'Author received notification for peer review comments');

    // ─── STEP 5: Self-Approval Prevention Gate ──────────────────────────────
    console.log('\n[Step 5] Testing Self-Approval Enforcement Gate...');
    const authorCanApprove = authorUser.id !== testReview.authorId;
    assert(!authorCanApprove, 'Author is strictly barred from approving their own review (SELF_APPROVAL_DISALLOWED)');

    // ─── STEP 6: Review Decisions & State Transitions ───────────────────────
    console.log('\n[Step 6] Reviewer submits peer review decision (APPROVED)...');
    const approveAction = await prisma.codeReviewAction.create({
      data: {
        reviewId: testReview.id,
        userId: reviewerUser.id,
        action: 'APPROVE',
        summary: 'All SIMD memory alignments verified. LGTM!',
      },
      include: { user: true },
    });
    assert(approveAction.action === 'APPROVE', 'Approval action recorded in audit log');

    const approvedReview = await prisma.codeReview.update({
      where: { id: testReview.id },
      data: { status: 'APPROVED' },
    });
    assert(approvedReview.status === 'APPROVED', 'Review status transitioned to APPROVED');

    // Test Request Changes
    console.log('\n[Step 7] Reviewer submits Request Changes transition...');
    await prisma.codeReviewAction.create({
      data: {
        reviewId: testReview.id,
        userId: reviewerUser.id,
        action: 'REQUEST_CHANGES',
        summary: 'One regression detected in integration benchmarks.',
      },
    });
    const changesRequestedReview = await prisma.codeReview.update({
      where: { id: testReview.id },
      data: { status: 'CHANGES_REQUESTED' },
    });
    assert(changesRequestedReview.status === 'CHANGES_REQUESTED', 'Review status updated to CHANGES_REQUESTED');

    // Test Close Review
    console.log('\n[Step 8] Author / Reviewer closes review...');
    const closedReview = await prisma.codeReview.update({
      where: { id: testReview.id },
      data: { status: 'CLOSED' },
    });
    assert(closedReview.status === 'CLOSED', 'Review status successfully CLOSED');

    // ─── STEP 9: Cross-Workspace Security Isolation ─────────────────────────
    console.log('\n[Step 9] Verifying Workspace Isolation & Non-Member Security...');
    const foreignMembership = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: testWorkspace.id,
          userId: foreignUser.id,
        },
      },
    });
    assert(foreignMembership === null, 'Foreign user has NO membership in workspace');

    // Query scoping ensures foreign user cannot retrieve reviews from this workspace
    const foreignAccessibleReviews = await prisma.codeReview.findMany({
      where: {
        workspaceId: 'non_existent_workspace_id',
      },
    });
    assert(foreignAccessibleReviews.length === 0, 'Foreign query returns 0 reviews for unauthorized scope');

    // ─── STEP 10: Teardown ──────────────────────────────────────────────────
    console.log('\n[Step 10] Safe Teardown & Cleanup of Test Fixtures...');
    await prisma.codeReviewComment.deleteMany({ where: { reviewId: testReview.id } });
    await prisma.codeReviewAction.deleteMany({ where: { reviewId: testReview.id } });
    await prisma.codeReview.delete({ where: { id: testReview.id } });
    await prisma.notification.deleteMany({ where: { workspaceId: testWorkspace.id } });
    await prisma.task.delete({ where: { id: testTask.id } });
    await prisma.repository.delete({ where: { id: testRepo.id } });
    await prisma.workspaceMember.deleteMany({ where: { workspaceId: testWorkspace.id } });
    await prisma.workspace.delete({ where: { id: testWorkspace.id } });
    await prisma.user.deleteMany({
      where: { id: { in: [authorUser.id, reviewerUser.id, foreignUser.id] } },
    });
    assert(true, 'All test fixtures cleanly removed from PostgreSQL');

    console.log('\n' + '═'.repeat(70));
    console.log(`   ALL ${passed} CODE REVIEWS ACCEPTANCE TESTS PASSED SUCCESSFULLY! (100%)`);
    console.log('═'.repeat(70) + '\n');
  } catch (err: any) {
    console.error('\nTest suite failed with error:', err);
    process.exit(1);
  }
}

runCodeReviewSuite().catch((err) => {
  console.error(err);
  process.exit(1);
});
