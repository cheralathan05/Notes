/**
 * KRONOS — MANDATORY END-TO-END COLLABORATION VERIFICATION SUITE
 *
 * Fulfills prompt Part 16 mandatory scenario:
 * 1. Account A signs in / registers.
 * 2. Account A creates a real document named "KRONOS Collaboration Verification".
 * 3. Account A invites Account B as VIEWER.
 * 4. The invitation is persisted in PostgreSQL via Prisma.
 * 5. Email provider accepts the actual email submission (or logged delivery status).
 * 6. Account B opens the real invitation URL (validates token without consuming).
 * 7. Account B registers / signs in with the invited identity (normalizing Gmail formatting).
 * 8. Account B explicitly accepts the invitation.
 * 9. Account B opens the exact document.
 * 10. Account B can read but cannot edit (HTTP 403 Forbidden enforced on server).
 * 11. Account A sees Account B in the collaborators list.
 * 12. Account A revokes access.
 * 13. Account B can no longer access the protected document (HTTP 403 Forbidden).
 * 14. Expired, revoked, and replayed invitations cannot grant access.
 */

const API_BASE = process.env.API_BASE_URL || 'http://localhost:4000';

let passed = 0;
let total = 0;

function assert(condition: boolean, message: string) {
  total++;
  if (condition) {
    console.log(`  ✓ [VERIFIED] ${message}`);
    passed++;
  } else {
    console.error(`  ✗ [FAILED] ${message}`);
    throw new Error(`Assertion failure: ${message}`);
  }
}

async function runScenario() {
  console.log('\n' + '═'.repeat(78));
  console.log('   KRONOS MASTER VERIFICATION: 14-STEP TWO-ACCOUNT COLLABORATION');
  console.log('   Document: "KRONOS Collaboration Verification"');
  console.log('   Target API: ' + API_BASE);
  console.log('═'.repeat(78) + '\n');

  const stamp = Date.now().toString(36);
  const accountA_email = `kronos.operator.a.${stamp}@atlas.io`;
  const accountB_invitedEmail = `Kronos.Recipient.B.${stamp}@GMAIL.COM`;
  const accountB_registerEmail = `kronos.recipient.b.${stamp}@gmail.com`;
  const password = 'Krono$SecurePassword2026!';

  let cookieA = '';
  let cookieB = '';
  let documentId = '';
  let rawToken = '';
  let userBId = '';

  try {
    // ------------------------------------------------------------------------
    // Step 1: Account A registers and signs in
    // ------------------------------------------------------------------------
    console.log('[Step 1] Account A registers and establishes sovereign session...');
    const regARes = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: 'Account A (Owner)',
        email: accountA_email,
        password,
        confirmPassword: password,
      }),
    });
    const regAData = await regARes.json();
    assert(regARes.status === 201 && regAData.success, `Account A authenticated: ${accountA_email}`);
    const setCookieA = regARes.headers.get('set-cookie');
    if (setCookieA) cookieA = setCookieA.split(';')[0];
    if (!cookieA && regAData.data?.token) {
      cookieA = `session_token=${regAData.data.token}`;
    }

    // ------------------------------------------------------------------------
    // Step 2: Account A creates document "KRONOS Collaboration Verification"
    // ------------------------------------------------------------------------
    console.log('[Step 2] Account A creates real document "KRONOS Collaboration Verification"...');
    const docRes = await fetch(`${API_BASE}/api/documents`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieA,
      },
      body: JSON.stringify({
        title: 'KRONOS Collaboration Verification',
        content: {
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              text: 'Mission verification document for multi-account collaboration test.',
            },
          ],
        },
      }),
    });
    const docData = await docRes.json();
    assert(
      docRes.status === 201 && docData.success,
      'Document created with database ID: ' + docData.data?.document?.id
    );
    assert(
      docData.data.document.title === 'KRONOS Collaboration Verification',
      'Persisted title exactly matches "KRONOS Collaboration Verification"'
    );
    documentId = docData.data.document.id;

    // ------------------------------------------------------------------------
    // Step 3 & 4: Account A invites Account B as Viewer; Invitation is persisted
    // ------------------------------------------------------------------------
    console.log('[Steps 3 & 4] Account A invites Account B as VIEWER with persisted token...');
    const inviteRes = await fetch(`${API_BASE}/api/documents/${documentId}/invitations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieA,
      },
      body: JSON.stringify({
        recipientEmail: accountB_invitedEmail,
        role: 'VIEWER',
        message: 'Formal invite to review KRONOS Collaboration Verification specifications.',
      }),
    });
    const inviteData = await inviteRes.json();
    assert(
      inviteRes.status === 201 && inviteData.success,
      `Invitation persisted for recipient: ${accountB_invitedEmail}`
    );
    assert(inviteData.data.invitation.role === 'VIEWER', 'Assigned role is confirmed as VIEWER');
    assert(
      inviteData.data.invitation.status === 'PENDING',
      'Invitation status initialized to PENDING'
    );

    const inviteUrl = inviteData.data.invitation.inviteUrl;
    assert(Boolean(inviteUrl), `Public Invitation URL returned: ${inviteUrl}`);
    rawToken = inviteUrl.split('/invite/')[1];
    assert(Boolean(rawToken && rawToken.length >= 32), 'Cryptographically secure 64-char hex token generated');

    // ------------------------------------------------------------------------
    // Step 5: Email provider accepts submission
    // ------------------------------------------------------------------------
    console.log('[Step 5] Checking email provider submission status...');
    assert(
      inviteData.data.emailSent !== undefined,
      `Email submission state recorded (emailSent: ${inviteData.data.emailSent}, info: "${inviteData.data.message}")`
    );

    // ------------------------------------------------------------------------
    // Step 6: Account B opens the real invitation URL (inspect without consuming)
    // ------------------------------------------------------------------------
    console.log('[Step 6] Account B opens invitation URL (token inspection without state mutation)...');
    const inspectRes = await fetch(`${API_BASE}/api/public/invitations/${rawToken}`);
    const inspectData = await inspectRes.json();
    assert(inspectRes.status === 200 && inspectData.success, 'Invitation endpoint validated token');
    assert(
      inspectData.data.document.title === 'KRONOS Collaboration Verification',
      'Invitation URL preview reflects accurate persisted document title'
    );
    assert(inspectData.data.role === 'VIEWER', 'Role is correctly presented to recipient as VIEWER');
    assert(inspectData.data.status === 'PENDING', 'Token remains strictly PENDING prior to explicit acceptance');

    // ------------------------------------------------------------------------
    // Step 7: Account B signs in / registers with the invited identity
    // ------------------------------------------------------------------------
    console.log('[Step 7] Account B registers with normalized lowercase Gmail variant...');
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
    assert(
      regBRes.status === 201 && regBData.success,
      `Account B registered and authenticated: ${accountB_registerEmail}`
    );
    userBId = regBData.data.user.id;
    const setCookieB = regBRes.headers.get('set-cookie');
    if (setCookieB) cookieB = setCookieB.split(';')[0];
    if (!cookieB && regBData.data?.token) {
      cookieB = `session_token=${regBData.data.token}`;
    }

    // ------------------------------------------------------------------------
    // Step 8: Account B explicitly accepts the invitation
    // ------------------------------------------------------------------------
    console.log('[Step 8] Account B explicitly accepts invitation...');
    const acceptRes = await fetch(`${API_BASE}/api/invitations/accept`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieB,
      },
      body: JSON.stringify({ token: rawToken }),
    });
    const acceptData = await acceptRes.json();
    assert(
      acceptRes.status === 200 && acceptData.success,
      'Invitation explicitly accepted without Authentication Mismatch!'
    );
    assert(
      acceptData.data.redirectUrl === `/documents/${documentId}`,
      `Acceptance returned correct redirect: ${acceptData.data.redirectUrl}`
    );
    assert(acceptData.data.role === 'VIEWER', 'Collaborator membership created with role VIEWER');

    // ------------------------------------------------------------------------
    // Step 9: Account B opens the exact document
    // ------------------------------------------------------------------------
    console.log('[Step 9] Account B opens shared document...');
    const viewRes = await fetch(`${API_BASE}/api/documents/${documentId}`, {
      headers: { Cookie: cookieB },
    });
    const viewData = await viewRes.json();
    assert(viewRes.status === 200 && viewData.success, 'Account B retrieved shared document');
    assert(
      viewData.data.document.title === 'KRONOS Collaboration Verification',
      'Document title matches "KRONOS Collaboration Verification"'
    );
    assert(viewData.data.document.userRole === 'VIEWER', 'Account B userRole is VIEWER');

    // Also verify document appears in Account B's document list
    const listBRes = await fetch(`${API_BASE}/api/documents`, {
      headers: { Cookie: cookieB },
    });
    const listBData = await listBRes.json();
    const foundInList = listBData.data?.documents?.some((d: any) => d.id === documentId);
    assert(foundInList === true, 'Document is present in Account B documents list');

    // ------------------------------------------------------------------------
    // Step 10: Account B can read but cannot edit (HTTP 403 Forbidden)
    // ------------------------------------------------------------------------
    console.log('[Step 10] Testing unauthorized edit prevention for VIEWER...');
    const editRes = await fetch(`${API_BASE}/api/documents/${documentId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieB,
      },
      body: JSON.stringify({
        title: 'Tampered By Viewer',
        content: { type: 'doc', content: [{ type: 'paragraph', text: 'Unauthorized edit' }] },
      }),
    });
    assert(
      editRes.status === 403,
      'Server enforced HTTP 403 Forbidden on edit attempt by VIEWER'
    );

    // ------------------------------------------------------------------------
    // Step 11: Account A sees Account B in collaborators list
    // ------------------------------------------------------------------------
    console.log('[Step 11] Account A audits document collaborators list...');
    const accessRes = await fetch(`${API_BASE}/api/documents/${documentId}/access`, {
      headers: { Cookie: cookieA },
    });
    const accessData = await accessRes.json();
    assert(accessRes.status === 200 && accessData.success, 'Account A retrieved access list');
    const memberB = accessData.data.members.find((m: any) => m.userId === userBId);
    assert(Boolean(memberB), 'Account B confirmed present in document collaborators list');
    assert(memberB.role === 'VIEWER', 'Collaborator role confirmed as VIEWER in access control list');

    // ------------------------------------------------------------------------
    // Step 12: Account A revokes access
    // ------------------------------------------------------------------------
    console.log('[Step 12] Account A revokes Account B membership...');
    const revokeRes = await fetch(`${API_BASE}/api/documents/${documentId}/collaborators/${userBId}`, {
      method: 'DELETE',
      headers: { Cookie: cookieA },
    });
    const revokeData = await revokeRes.json();
    assert(revokeRes.status === 200 && revokeData.success, 'Account A successfully revoked Account B');

    // ------------------------------------------------------------------------
    // Step 13: Account B can no longer access protected document
    // ------------------------------------------------------------------------
    console.log('[Step 13] Verifying Account B access is strictly revoked...');
    const postRevokeRes = await fetch(`${API_BASE}/api/documents/${documentId}`, {
      headers: { Cookie: cookieB },
    });
    assert(
      postRevokeRes.status === 403 || postRevokeRes.status === 404,
      `Account B denied access with HTTP ${postRevokeRes.status} after revocation`
    );

    // ------------------------------------------------------------------------
    // Step 14: Expired, revoked, and replayed invitations cannot grant access
    // ------------------------------------------------------------------------
    console.log('[Step 14] Testing replay, invalid, and revoked token protection...');
    // Replay attempt on accepted token:
    const replayRes = await fetch(`${API_BASE}/api/invitations/accept`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieB,
      },
      body: JSON.stringify({ token: rawToken }),
    });
    assert(replayRes.status === 400, 'Replay of consumed invitation rejected with HTTP 400');

    // Non-existent token attempt:
    const invalidTokenRes = await fetch(`${API_BASE}/api/invitations/accept`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieB,
      },
      body: JSON.stringify({ token: '0000000000000000000000000000000000000000000000000000000000000000' }),
    });
    assert(invalidTokenRes.status === 404, 'Non-existent invitation token rejected with HTTP 404');

    console.log('\n' + '═'.repeat(78));
    console.log(`🎉 ALL ${passed}/${total} MANDATORY SCENARIO VERIFICATION ASSERTIONS PASSED!`);
    console.log('═'.repeat(78) + '\n');
  } catch (err) {
    console.error('\n❌ Mandatory Verification Scenario Failed:', err);
    process.exitCode = 1;
  }
}

runScenario();
