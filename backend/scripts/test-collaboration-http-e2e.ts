/**
 * KRONOS — HTTP End-to-End Two-Account Collaboration Invitation Verification
 *
 * Tests the live HTTP API server on http://localhost:4000:
 * 1. Account A Registers & Signs In
 * 2. Account A creates "Team Collaboration Test"
 * 3. Account A invites "Friend.Collab@Gmail.com" as VIEWER
 * 4. Token validation via GET /api/public/invitations/:token (without consuming)
 * 5. Account B Registers as "friend.collab@gmail.com"
 * 6. Account B Accepts the invitation via POST /api/invitations/accept
 * 7. Verification that NO Authentication Mismatch occurs despite casing/dot variations
 * 8. Account B Reads document via GET /api/documents/:id (permitted, userRole = VIEWER)
 * 9. Account B Attempts content update via PATCH /api/documents/:id (rejected 403)
 * 10. Account A inspects collaborator list via GET /api/documents/:id/access
 * 11. Account A revokes Account B via DELETE /api/documents/:id/members/:userId
 * 12. Account B loses access immediately (rejected 403)
 */

const API_BASE = 'http://localhost:4000';

let passed = 0;
let total = 0;

function assert(condition: boolean, message: string) {
  total++;
  if (condition) {
    console.log(`  ✓ [HTTP PASS] ${message}`);
    passed++;
  } else {
    console.error(`  ✗ [HTTP FAIL] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runHttpE2ETest() {
  console.log('\n' + '═'.repeat(70));
  console.log('   KRONOS HTTP API TWO-ACCOUNT COLLABORATION INVITATION E2E TEST');
  console.log('   Live HTTP Server on http://localhost:4000');
  console.log('═'.repeat(70) + '\n');

  const suffix = Date.now().toString(36);
  const emailA = `inviter.alice.${suffix}@testcorp.io`;
  const invitedEmailRaw = `Friend.Collab.${suffix}@GMAIL.COM`;
  const registerEmailB = `friend.collab.${suffix}@gmail.com`;
  const password = 'StrongPassword!123';

  let cookieA = '';
  let cookieB = '';
  let documentId = '';
  let rawToken = '';
  let userBId = '';

  try {
    // 1. Account A Register
    const regARes = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: 'Alice Inviter',
        email: emailA,
        password,
        confirmPassword: password,
      }),
    });
    const regAData = await regARes.json();
    assert(regARes.status === 201 && regAData.success, `Account A registered: ${emailA}`);
    const setCookieA = regARes.headers.get('set-cookie');
    if (setCookieA) cookieA = setCookieA.split(';')[0];
    if (!cookieA && regAData.data?.token) {
      cookieA = `session_token=${regAData.data.token}`;
    }

    // 2. Account A creates document "Team Collaboration Test"
    const docRes = await fetch(`${API_BASE}/api/documents`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieA,
      },
      body: JSON.stringify({
        title: 'Team Collaboration Test',
        content: { type: 'doc', content: [{ type: 'paragraph', text: 'Live briefing document' }] },
      }),
    });
    const docData = await docRes.json();
    assert(docRes.status === 201 && docData.success, 'Account A created document: "Team Collaboration Test"');
    documentId = docData.data.document.id;

    // 3. Account A invites Account B with uppercase & whitespace in email
    const inviteRes = await fetch(`${API_BASE}/api/documents/${documentId}/invitations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieA,
      },
      body: JSON.stringify({
        recipientEmail: invitedEmailRaw,
        role: 'VIEWER',
        message: 'Welcome to the document! Please review.',
      }),
    });
    const inviteData = await inviteRes.json();
    assert(inviteRes.status === 201 && inviteData.success, `Account A issued invitation to ${invitedEmailRaw}`);
    const inviteUrl = inviteData.data.invitation.inviteUrl;
    assert(Boolean(inviteUrl), `Invitation URL generated: ${inviteUrl}`);
    rawToken = inviteUrl.split('/invite/')[1];
    assert(Boolean(rawToken), 'Cryptographic raw token extracted from invitation link');

    // 4. Token validation via GET /api/public/invitations/:token
    const inspectRes = await fetch(`${API_BASE}/api/public/invitations/${rawToken}`);
    const inspectData = await inspectRes.json();
    assert(inspectRes.status === 200 && inspectData.success, 'Token validated via public endpoint');
    assert(inspectData.data.document.title === 'Team Collaboration Test', 'Public endpoint returns accurate document title');
    assert(inspectData.data.role === 'VIEWER', 'Public endpoint returns correct assigned permission: VIEWER');
    assert(inspectData.data.status === 'PENDING', 'Token remains unconsumed in PENDING status');

    // 5. Account B registers with lowercase matching email
    const regBRes = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: 'Bob Collaborator',
        email: registerEmailB,
        password,
        confirmPassword: password,
      }),
    });
    const regBData = await regBRes.json();
    assert(regBRes.status === 201 && regBData.success, `Account B registered with lowercase identity: ${registerEmailB}`);
    userBId = regBData.data.user.id;
    const setCookieB = regBRes.headers.get('set-cookie');
    if (setCookieB) cookieB = setCookieB.split(';')[0];
    if (!cookieB && regBData.data?.token) {
      cookieB = `session_token=${regBData.data.token}`;
    }

    // 6. Account B accepts invitation via POST /api/invitations/accept
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
      'Account B successfully accepted invitation without Authentication Mismatch!'
    );
    assert(
      acceptData.data.redirectUrl === `/documents/${documentId}`,
      `Acceptance returned correct canonical document destination: ${acceptData.data.redirectUrl}`
    );
    assert(acceptData.data.role === 'VIEWER', 'Acceptance confirmed VIEWER permission');

    // 7. Account B opens the shared document via GET /api/documents/:id
    const viewRes = await fetch(`${API_BASE}/api/documents/${documentId}`, {
      headers: { Cookie: cookieB },
    });
    const viewData = await viewRes.json();
    assert(viewRes.status === 200 && viewData.success, 'Account B successfully opened shared document');
    assert(viewData.data.document.title === 'Team Collaboration Test', 'Document title confirmed');
    assert(viewData.data.document.userRole === 'VIEWER', 'Document userRole confirmed as VIEWER');

    // 8. Account B attempts to edit document via PATCH /api/documents/:id (must be rejected)
    const editRes = await fetch(`${API_BASE}/api/documents/${documentId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieB,
      },
      body: JSON.stringify({
        title: 'Hacked Title By Viewer',
        content: { type: 'doc', content: [{ type: 'paragraph', text: 'Illegal edit' }] },
      }),
    });
    const editData = await editRes.json();
    assert(
      editRes.status === 403 && !editData.success,
      'Backend strictly REJECTED unauthorized edit attempt by VIEWER with 403 Forbidden'
    );

    // 9. Account A views Collaborators List via GET /api/documents/:id/access
    const accessRes = await fetch(`${API_BASE}/api/documents/${documentId}/access`, {
      headers: { Cookie: cookieA },
    });
    const accessData = await accessRes.json();
    assert(accessRes.status === 200 && accessData.success, 'Account A retrieved document access configuration');
    assert(accessData.data.title === 'Team Collaboration Test', 'Access config reflects real document title');
    const memberB = accessData.data.members.find((m: any) => m.userId === userBId);
    assert(Boolean(memberB), 'Account B is present in document collaborators list');
    assert(memberB.role === 'VIEWER', 'Account B role is confirmed as VIEWER in collaborators list');

    // 10. Replay attack rejection: Account B tries to accept again
    const replayRes = await fetch(`${API_BASE}/api/invitations/accept`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieB,
      },
      body: JSON.stringify({ token: rawToken }),
    });
    assert(
      replayRes.status === 400,
      'Replay attack rejected: already-accepted token cannot be consumed a second time'
    );

    // 11. Account A revokes Account B's collaborator membership
    const revokeRes = await fetch(`${API_BASE}/api/documents/${documentId}/collaborators/${userBId}`, {
      method: 'DELETE',
      headers: { Cookie: cookieA },
    });
    const revokeData = await revokeRes.json();
    assert(revokeRes.status === 200 && revokeData.success, 'Account A revoked Account B access');

    // 12. Account B tries to read document again (must be 403)
    const postRevokeRes = await fetch(`${API_BASE}/api/documents/${documentId}`, {
      headers: { Cookie: cookieB },
    });
    assert(
      postRevokeRes.status === 403,
      'Account B immediately loses read access after collaborator revocation'
    );

    console.log('\n' + '═'.repeat(70));
    console.log(`🎉 ALL ${passed}/${total} HTTP END-TO-END WORKFLOW ASSERTIONS VERIFIED!`);
    console.log('═'.repeat(70) + '\n');
  } catch (err) {
    console.error('HTTP E2E test failed:', err);
    process.exitCode = 1;
  }
}

runHttpE2ETest();
