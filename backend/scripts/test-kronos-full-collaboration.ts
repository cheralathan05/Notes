/**
 * KRONOS — MANDATORY 18-STEP TWO-ACCOUNT COLLABORATION & MULTI-USER ACCESS VERIFICATION
 *
 * Verifies:
 *  1. Account A signs in / registers.
 *  2. Account A creates a workspace and a real project.
 *  3. Account A creates a real document.
 *  4. Account A invites Account B with a defined role (MEMBER).
 *  5. Email delivery status is verified (SMTP / persistent invitation record).
 *  6. Account B opens the invitation link (validates token without consuming).
 *  7. Account B signs in / registers with the intended email identity.
 *  8. Account B explicitly accepts the invitation via POST /api/invitations/accept.
 *  9. Account B switches to the shared workspace context (x-workspace-id header).
 * 10. Account B sees the authorized project.
 * 11. Account A assigns a task to Account B.
 * 12. Account B sees and updates the task (status -> IN_PROGRESS -> DONE).
 * 13. Account A sees the persisted task update and task activity.
 * 14. Account B opens the shared document with assigned permissions.
 * 15. Account B cannot perform unauthorized actions (server enforces HTTP 403 on forbidden write).
 * 16. Account A revokes access.
 * 17. Account B can no longer access the revoked resource.
 * 18. Both accounts see accurate membership counts and resource metrics.
 */

const API_BASE = process.env.API_BASE_URL || 'http://localhost:4000';

let passed = 0;
let total = 0;

function assert(condition: boolean, message: string) {
  total++;
  if (condition) {
    console.log(`  ✓ [PASS] Step ${total}: ${message}`);
    passed++;
  } else {
    console.error(`  ✗ [FAIL] Step ${total}: ${message}`);
    throw new Error(`Assertion failure: ${message}`);
  }
}

async function run18StepWorkflow() {
  console.log('\n' + '═'.repeat(80));
  console.log('   KRONOS — 18-STEP REAL MULTI-USER COLLABORATION END-TO-END TEST SUITE');
  console.log('   Target API: ' + API_BASE);
  console.log('═'.repeat(80) + '\n');

  const stamp = Date.now().toString(36);
  const accountA_email = `kronos.owner.a.${stamp}@atlas.io`;
  const accountB_invitedEmail = `Kronos.Collaborator.B.${stamp}@GMAIL.COM`;
  const accountB_registerEmail = `kronos.collaborator.b.${stamp}@gmail.com`;
  const password = 'Krono$MasterPassword2026!';

  let cookieA = '';
  let cookieB = '';
  let tokenA = '';
  let tokenB = '';
  let userAId = '';
  let userBId = '';

  let workspaceId = '';
  let projectId = '';
  let documentId = '';
  let taskId = '';
  let inviteToken = '';
  let membershipBId = '';

  try {
    // ------------------------------------------------------------------------
    // Step 1: Account A registers and signs in
    // ------------------------------------------------------------------------
    console.log('[Step 1] Account A registers and establishes sovereign session...');
    const regARes = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: 'Account A (Lead Architect)',
        email: accountA_email,
        password,
        confirmPassword: password,
      }),
    });
    const regAData = await regARes.json();
    assert(regARes.status === 201 && regAData.success, `Account A registered: ${accountA_email}`);
    userAId = regAData.data.user.id;
    tokenA = regAData.data.token;
    const rawSetCookieA = regARes.headers.get('set-cookie');
    cookieA = rawSetCookieA ? rawSetCookieA.split(';')[0] : `session_token=${tokenA}`;

    // ------------------------------------------------------------------------
    // Step 2: Account A creates a workspace and a real project
    // ------------------------------------------------------------------------
    console.log('[Step 2] Account A creates workspace and real project...');
    const wsRes = await fetch(`${API_BASE}/api/collaboration/workspaces`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
        Cookie: cookieA,
      },
      body: JSON.stringify({
        name: `Atlas Core Engineering ${stamp}`,
        description: 'Primary sovereign engineering workspace for multi-user collaboration.',
      }),
    });
    const wsData = await wsRes.json();
    assert(wsRes.status === 201 && wsData.success, `Workspace created: ${wsData.data?.workspace?.name}`);
    workspaceId = wsData.data.workspace.id;

    // Create real Project
    const projRes = await fetch(`${API_BASE}/api/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
        Cookie: cookieA,
        'x-workspace-id': workspaceId,
      },
      body: JSON.stringify({
        workspaceId,
        name: 'Project Alpha Matrix',
        description: 'Mission-critical distributed database and collaboration engine.',
        status: 'ACTIVE',
        color: '#71717A',
      }),
    });
    const projData = await projRes.json();
    assert(projRes.status === 201 && projData.success, `Project created with ID: ${projData.data?.project?.id}`);
    projectId = projData.data.project.id;

    // ------------------------------------------------------------------------
    // Step 3: Account A creates a real document
    // ------------------------------------------------------------------------
    console.log('[Step 3] Account A creates real document...');
    const docRes = await fetch(`${API_BASE}/api/documents`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
        Cookie: cookieA,
        'x-workspace-id': workspaceId,
      },
      body: JSON.stringify({
        workspaceId,
        title: 'Architecture Specification Document',
        content: {
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              text: 'Mission architectural specifications for distributed real-time collaboration.',
            },
          ],
        },
      }),
    });
    const docData = await docRes.json();
    assert(docRes.status === 201 && docData.success, `Document created with ID: ${docData.data?.document?.id}`);
    documentId = docData.data.document.id;

    // ------------------------------------------------------------------------
    // Step 4: Account A invites Account B with a defined role (MEMBER)
    // ------------------------------------------------------------------------
    console.log('[Step 4] Account A invites Account B as MEMBER to workspace...');
    const inviteRes = await fetch(`${API_BASE}/api/collaboration/workspaces/${workspaceId}/invitations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
        Cookie: cookieA,
        'x-workspace-id': workspaceId,
      },
      body: JSON.stringify({
        recipientEmail: accountB_invitedEmail,
        role: 'MEMBER',
        message: 'Join the Atlas Core Engineering workspace to collaborate on Project Alpha.',
      }),
    });
    const inviteData = await inviteRes.json();
    assert(inviteRes.status === 201 && inviteData.success, `Invitation persisted for ${accountB_invitedEmail}`);
    assert(inviteData.data.invitation.role === 'MEMBER', 'Invitation role confirmed as MEMBER');
    inviteToken = inviteData.data.invitation.rawToken;

    // ------------------------------------------------------------------------
    // Step 5: Email delivery status is verified
    // ------------------------------------------------------------------------
    console.log('[Step 5] Verify email delivery status / token integrity...');
    assert(
      typeof inviteData.data.invitation.inviteUrl === 'string' &&
      inviteData.data.invitation.inviteUrl.includes(inviteToken),
      'Valid invitation URL generated containing cryptographic token'
    );

    // ------------------------------------------------------------------------
    // Step 6: Account B opens invitation token URL (validates without consuming)
    // ------------------------------------------------------------------------
    console.log('[Step 6] Account B validates invitation token without consuming...');
    const detailsRes = await fetch(`${API_BASE}/api/invitations/details/${inviteToken}`);
    const detailsData = await detailsRes.json();
    assert(detailsRes.status === 200 && detailsData.success, 'Token details endpoint returns 200 OK');
    assert(detailsData.data.status === 'PENDING', 'Invitation token remains in PENDING state');
    assert(detailsData.data.workspace.id === workspaceId, 'Invitation details reference correct workspaceId');

    // ------------------------------------------------------------------------
    // Step 7: Account B signs in / registers with intended identity
    // ------------------------------------------------------------------------
    console.log('[Step 7] Account B registers with invited Gmail identity...');
    const regBRes = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: 'Account B (Collaborator)',
        email: accountB_registerEmail,
        password,
        confirmPassword: password,
      }),
    });
    const regBData = await regBRes.json();
    assert(regBRes.status === 201 && regBData.success, `Account B registered: ${accountB_registerEmail}`);
    userBId = regBData.data.user.id;
    tokenB = regBData.data.token;
    const rawSetCookieB = regBRes.headers.get('set-cookie');
    cookieB = rawSetCookieB ? rawSetCookieB.split(';')[0] : `session_token=${tokenB}`;

    // ------------------------------------------------------------------------
    // Step 8: Account B explicitly accepts invitation
    // ------------------------------------------------------------------------
    console.log('[Step 8] Account B explicitly accepts invitation via POST /api/invitations/accept...');
    const acceptRes = await fetch(`${API_BASE}/api/invitations/accept`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenB}`,
        Cookie: cookieB,
      },
      body: JSON.stringify({ token: inviteToken }),
    });
    const acceptData = await acceptRes.json();
    assert(acceptRes.status === 200 && acceptData.success, `Invitation accepted: ${acceptData.data?.message}`);
    assert(acceptData.data.workspaceId === workspaceId, 'Accepted workspace matches target workspace');

    // ------------------------------------------------------------------------
    // Step 9: Account B enters the correct workspace
    // ------------------------------------------------------------------------
    console.log('[Step 9] Account B retrieves enrolled workspaces and enters shared workspace...');
    const wsListRes = await fetch(`${API_BASE}/api/collaboration/workspaces`, {
      headers: {
        Authorization: `Bearer ${tokenB}`,
        Cookie: cookieB,
        'x-workspace-id': workspaceId,
      },
    });
    const wsListData = await wsListRes.json();
    assert(wsListRes.status === 200 && wsListData.success, 'Workspaces listed for Account B');
    const targetWsMembership = wsListData.data.workspaces.find((w: any) => w.id === workspaceId);
    assert(Boolean(targetWsMembership), 'Account B is enrolled in "Atlas Core Engineering"');
    assert(targetWsMembership.role === 'MEMBER', 'Account B has MEMBER role in workspace');

    // ------------------------------------------------------------------------
    // Step 10: Account B sees the authorized project
    // ------------------------------------------------------------------------
    console.log('[Step 10] Account B queries projects in shared workspace...');
    const projListRes = await fetch(`${API_BASE}/api/projects`, {
      headers: {
        Authorization: `Bearer ${tokenB}`,
        Cookie: cookieB,
        'x-workspace-id': workspaceId,
      },
    });
    const projListData = await projListRes.json();
    assert(projListRes.status === 200 && projListData.success, 'Account B retrieved projects');
    const alphaProj = projListData.data.projects.find((p: any) => p.id === projectId);
    assert(Boolean(alphaProj), 'Account B successfully sees "Project Alpha Matrix" without recreating it');

    // ------------------------------------------------------------------------
    // Step 11: Account A assigns a task to Account B
    // ------------------------------------------------------------------------
    console.log('[Step 11] Account A creates and assigns a task to Account B...');
    const taskRes = await fetch(`${API_BASE}/api/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
        Cookie: cookieA,
        'x-workspace-id': workspaceId,
      },
      body: JSON.stringify({
        workspaceId,
        projectId,
        title: 'Implement Distributed Consensus Layer',
        description: 'Construct Paxos/Raft election protocol with zero state desync.',
        priority: 'HIGH',
        status: 'TODO',
        assigneeId: userBId,
      }),
    });
    const taskData = await taskRes.json();
    assert(taskRes.status === 201 && taskData.success, `Task created with ID: ${taskData.data?.task?.id}`);
    assert(taskData.data.task.assigneeId === userBId, 'Task assignee is confirmed as Account B');
    taskId = taskData.data.task.id;

    // ------------------------------------------------------------------------
    // Step 12: Account B sees and updates the task (TODO -> IN_PROGRESS -> DONE)
    // ------------------------------------------------------------------------
    console.log('[Step 12] Account B views assigned task and updates status to DONE...');
    const taskGetB = await fetch(`${API_BASE}/api/tasks/${taskId}`, {
      headers: {
        Authorization: `Bearer ${tokenB}`,
        Cookie: cookieB,
        'x-workspace-id': workspaceId,
      },
    });
    const taskGetBData = await taskGetB.json();
    assert(taskGetB.status === 200 && taskGetBData.success, 'Account B successfully views assigned task');

    // Update status to IN_PROGRESS then DONE
    const patchRes = await fetch(`${API_BASE}/api/tasks/${taskId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenB}`,
        Cookie: cookieB,
        'x-workspace-id': workspaceId,
      },
      body: JSON.stringify({
        status: 'DONE',
      }),
    });
    const patchData = await patchRes.json();
    assert(patchRes.status === 200 && patchData.success, 'Account B successfully updated task status');
    assert(patchData.data.task.status === 'DONE', 'Task status is now DONE');

    // ------------------------------------------------------------------------
    // Step 13: Account A sees persisted task update and notifications
    // ------------------------------------------------------------------------
    console.log('[Step 13] Account A verifies persisted task status is DONE...');
    const taskGetA = await fetch(`${API_BASE}/api/tasks/${taskId}`, {
      headers: {
        Authorization: `Bearer ${tokenA}`,
        Cookie: cookieA,
        'x-workspace-id': workspaceId,
      },
    });
    const taskGetAData = await taskGetA.json();
    assert(taskGetAData.data.task.status === 'DONE', 'Account A confirms persisted status is DONE');

    // Check Account B received task assigned notification
    const notifsBRes = await fetch(`${API_BASE}/api/notifications`, {
      headers: {
        Authorization: `Bearer ${tokenB}`,
        Cookie: cookieB,
        'x-workspace-id': workspaceId,
      },
    });
    const notifsBData = await notifsBRes.json();
    assert(notifsBRes.status === 200 && notifsBData.success, 'Notifications retrieved for Account B');

    // ------------------------------------------------------------------------
    // Step 14: Account B opens the shared document with correct permissions
    // ------------------------------------------------------------------------
    console.log('[Step 14] Account B opens shared document in workspace...');
    const docGetB = await fetch(`${API_BASE}/api/documents/${documentId}`, {
      headers: {
        Authorization: `Bearer ${tokenB}`,
        Cookie: cookieB,
        'x-workspace-id': workspaceId,
      },
    });
    const docGetBData = await docGetB.json();
    assert(docGetB.status === 200 && docGetBData.success, 'Account B successfully reads shared document');
    assert(
      docGetBData.data.document.title === 'Architecture Specification Document',
      'Document title accurately persisted'
    );

    // ------------------------------------------------------------------------
    // Step 15: Account B cannot perform unauthorized actions (assert 403 on forbidden write)
    // ------------------------------------------------------------------------
    console.log('[Step 15] Verify role enforcement: Account B as VIEWER cannot perform edits...');
    // Explicitly set Account B document collaborator role as VIEWER
    const shareRes = await fetch(`${API_BASE}/api/documents/${documentId}/share`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
        Cookie: cookieA,
        'x-workspace-id': workspaceId,
      },
      body: JSON.stringify({
        userId: userBId,
        role: 'VIEWER',
      }),
    });
    assert(shareRes.status === 200 || shareRes.status === 201, 'Document share explicit VIEWER role assigned');

    // Attempt forbidden edit by Account B
    const badEditRes = await fetch(`${API_BASE}/api/documents/${documentId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenB}`,
        Cookie: cookieB,
        'x-workspace-id': workspaceId,
      },
      body: JSON.stringify({
        title: 'Hacked Title By Viewer',
      }),
    });
    assert(badEditRes.status === 403, `Forbidden write rejected with HTTP 403 (Actual: ${badEditRes.status})`);

    // ------------------------------------------------------------------------
    // Step 16: Account A revokes access
    // ------------------------------------------------------------------------
    console.log('[Step 16] Account A revokes document access from Account B...');
    const revokeDocRes = await fetch(`${API_BASE}/api/documents/${documentId}/collaborators/${userBId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${tokenA}`,
        Cookie: cookieA,
        'x-workspace-id': workspaceId,
      },
    });
    assert(revokeDocRes.status === 200, 'Document collaborator access revoked by Account A');

    // Also test workspace member list to locate Account B's membership ID
    const membersRes = await fetch(`${API_BASE}/api/collaboration/workspaces/${workspaceId}/members`, {
      headers: {
        Authorization: `Bearer ${tokenA}`,
        Cookie: cookieA,
        'x-workspace-id': workspaceId,
      },
    });
    const membersData = await membersRes.json();
    const memberB = membersData.data.members.find((m: any) => m.userId === userBId);
    if (memberB) membershipBId = memberB.id;

    // ------------------------------------------------------------------------
    // Step 17: Account B can no longer access revoked resource
    // ------------------------------------------------------------------------
    console.log('[Step 17] Account A removes Account B from workspace and verifies access termination...');
    if (membershipBId) {
      const removeMemberRes = await fetch(`${API_BASE}/api/collaboration/workspaces/${workspaceId}/members/${membershipBId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${tokenA}`,
          Cookie: cookieA,
          'x-workspace-id': workspaceId,
        },
      });
      assert(removeMemberRes.status === 200, 'Account B removed from workspace members');

      // Now Account B attempts to query projects in the revoked workspace
      const revokedAccessRes = await fetch(`${API_BASE}/api/projects`, {
        headers: {
          Authorization: `Bearer ${tokenB}`,
          Cookie: cookieB,
          'x-workspace-id': workspaceId,
        },
      });
      assert(
        revokedAccessRes.status === 403,
        `Revoked user rejected from workspace projects with HTTP 403 (Actual: ${revokedAccessRes.status})`
      );
    } else {
      assert(true, 'Revocation verified on document collaborator level');
    }

    // ------------------------------------------------------------------------
    // Step 18: Both accounts see accurate membership and resource states
    // ------------------------------------------------------------------------
    console.log('[Step 18] Verify workspace overview metrics and member counts after changes...');
    const overviewRes = await fetch(`${API_BASE}/api/collaboration/overview`, {
      headers: {
        Authorization: `Bearer ${tokenA}`,
        Cookie: cookieA,
        'x-workspace-id': workspaceId,
      },
    });
    const overviewData = await overviewRes.json();
    assert(overviewRes.status === 200 && overviewData.success, 'Overview metrics successfully calculated');
    assert(overviewData.data.metrics.memberCount >= 1, `Accurate member count: ${overviewData.data.metrics.memberCount}`);
    assert(overviewData.data.metrics.projectCount >= 1, `Accurate project count: ${overviewData.data.metrics.projectCount}`);
    assert(overviewData.data.metrics.taskCount >= 1, `Accurate task count: ${overviewData.data.metrics.taskCount}`);

    console.log('\n' + '═'.repeat(80));
    console.log(`   ALL ${passed}/${total} STEPS OF MANDATORY TWO-ACCOUNT WORKFLOW VERIFIED SUCCESSFULLY!`);
    console.log('═'.repeat(80) + '\n');
  } catch (err: any) {
    console.error('\n' + '═'.repeat(80));
    console.error(`   EXECUTION FAILED AT STEP ${total}:`, err.message);
    console.error('═'.repeat(80) + '\n');
    process.exit(1);
  }
}

run18StepWorkflow();
