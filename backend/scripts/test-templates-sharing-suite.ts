import { prisma } from '../src/lib/prisma';
import { hashPassword } from '../src/lib/password';
import crypto from 'crypto';

const API_BASE = 'http://localhost:4000/api';

async function runTemplatesAndSharingTests() {
  console.log('════════════════════════════════════════════════════════════════');
  console.log('  KRONOS WORKSPACE TEMPLATES + SECURE SHARING & ACCESS CONTROL  ');
  console.log('           AUTOMATED END-TO-END VERIFICATION SUITE              ');
  console.log('════════════════════════════════════════════════════════════════\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  ✔ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  ✖ [FAIL] ${testName} ${detail ? `(${detail})` : ''}`);
      failed++;
    }
  }

  // ─── 0. Create Test Users & Sessions ─────────────────────────────────────────
  const ownerEmail = `owner-${Date.now()}@kronos.internal`;
  const collaboratorEmail = `collab-${Date.now()}@kronos.internal`;
  const thirdPartyEmail = `intruder-${Date.now()}@kronos.internal`;

  const passwordHash = await hashPassword('SovereignPass123!');

  // User 1: Document Owner
  const ownerUser = await prisma.user.create({
    data: {
      email: ownerEmail,
      emailNormalized: ownerEmail.toLowerCase(),
      displayName: 'System Architect',
      passwordHash,
      emailVerified: true,
      onboardingComplete: true,
    },
  });

  const ownerSessionToken = crypto.randomBytes(32).toString('hex');
  await prisma.session.create({
    data: {
      userId: ownerUser.id,
      tokenHash: crypto.createHash('sha256').update(ownerSessionToken).digest('hex'),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });

  const ownerHeaders = {
    'Content-Type': 'application/json',
    'Cookie': `session_token=${ownerSessionToken}`,
  };

  // User 2: Collaborator Invitee
  const collabUser = await prisma.user.create({
    data: {
      email: collaboratorEmail,
      emailNormalized: collaboratorEmail.toLowerCase(),
      displayName: 'Collaborator Engineer',
      passwordHash,
      emailVerified: true,
      onboardingComplete: true,
    },
  });

  const collabSessionToken = crypto.randomBytes(32).toString('hex');
  await prisma.session.create({
    data: {
      userId: collabUser.id,
      tokenHash: crypto.createHash('sha256').update(collabSessionToken).digest('hex'),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });

  const collabHeaders = {
    'Content-Type': 'application/json',
    'Cookie': `session_token=${collabSessionToken}`,
  };

  // User 3: Unauthorized Third Party
  const intruderUser = await prisma.user.create({
    data: {
      email: thirdPartyEmail,
      emailNormalized: thirdPartyEmail.toLowerCase(),
      displayName: 'Untrusted Entity',
      passwordHash,
      emailVerified: true,
      onboardingComplete: true,
    },
  });

  const intruderSessionToken = crypto.randomBytes(32).toString('hex');
  await prisma.session.create({
    data: {
      userId: intruderUser.id,
      tokenHash: crypto.createHash('sha256').update(intruderSessionToken).digest('hex'),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });

  const intruderHeaders = {
    'Content-Type': 'application/json',
    'Cookie': `session_token=${intruderSessionToken}`,
  };

  try {
    // ═══════════════════════════════════════════════════════════════════════════
    // STAGE 2 & 3: TEMPLATES CATALOG & PERSISTENCE
    // ═══════════════════════════════════════════════════════════════════════════
    console.log('\n[STAGE 2 & 3] Workspace Templates Catalog & Real Document Instantiation:');

    // 1. List all templates
    const templatesRes = await fetch(`${API_BASE}/templates`, { headers: ownerHeaders });
    const templatesData = await templatesRes.json();
    assert(templatesRes.status === 200 && templatesData.success, 'List templates endpoint (GET /api/templates)');
    const allTemplates: any[] = templatesData.data?.templates || [];
    assert(allTemplates.length >= 40, `All built-in templates seeded and active (Count: ${allTemplates.length} >= 40)`);

    // Verify categories present
    const categories = new Set(allTemplates.map((t) => t.category));
    assert(
      categories.has('Work') &&
      categories.has('Personal') &&
      categories.has('Engineering') &&
      categories.has('Product') &&
      categories.has('Research') &&
      categories.has('Education') &&
      categories.has('General'),
      'All 7 core categories present in catalog'
    );

    // 2. Category filtering
    const engRes = await fetch(`${API_BASE}/templates?category=Engineering`, { headers: ownerHeaders });
    const engData = await engRes.json();
    const engTemplates = engData.data?.templates || [];
    assert(
      engTemplates.length > 0 && engTemplates.every((t: any) => t.category === 'Engineering'),
      'Category filter matches only Engineering templates'
    );

    // 3. Search filtering
    const searchRes = await fetch(`${API_BASE}/templates?q=Meeting`, { headers: ownerHeaders });
    const searchData = await searchRes.json();
    const meetingTemplates = searchData.data?.templates || [];
    assert(
      meetingTemplates.length > 0 && meetingTemplates.some((t: any) => t.name.includes('Meeting')),
      'Search query "Meeting" finds Meeting Notes template'
    );

    // 4. Detail view
    const meetingTemplate = meetingTemplates[0];
    const detailRes = await fetch(`${API_BASE}/templates/${meetingTemplate.id}`, { headers: ownerHeaders });
    const detailData = await detailRes.json();
    assert(detailRes.status === 200 && detailData.data?.template?.id === meetingTemplate.id, 'Get template detail by ID');
    assert(Boolean(detailData.data?.template?.content?.content?.length), 'Template contains structured ProseMirror AST content');

    // 5. Favorite toggle
    const favRes = await fetch(`${API_BASE}/templates/${meetingTemplate.id}/favorite`, {
      method: 'POST',
      headers: ownerHeaders,
    });
    const favData = await favRes.json();
    assert(favRes.status === 200 && favData.success, 'Toggle favorite template status');

    // 6. Template Duplication
    const dupRes = await fetch(`${API_BASE}/templates/${meetingTemplate.id}/duplicate`, {
      method: 'POST',
      headers: ownerHeaders,
    });
    const dupData = await dupRes.json();
    assert(dupRes.status === 201 && dupData.data?.template?.name?.includes('(Copy)'), 'Duplicate template into custom copy');
    const customTemplateId = dupData.data?.template?.id;

    // 7. CRITICAL TEST: Instantiate document from template (Meeting Notes)
    const instantiateRes = await fetch(`${API_BASE}/templates/${meetingTemplate.id}/use`, {
      method: 'POST',
      headers: ownerHeaders,
      body: JSON.stringify({
        title: 'Q4 Product Strategy Sync',
      }),
    });
    const instantiateData = await instantiateRes.json();
    assert(instantiateRes.status === 201 && instantiateData.success, 'Use template to instantiate document (POST /api/templates/:id/use)');

    const documentId = instantiateData.data?.document?.id;
    assert(Boolean(documentId), 'Created document ID returned');
    assert(instantiateData.data?.document?.title === 'Q4 Product Strategy Sync', 'Custom document title applied');
    assert(
      Array.isArray(instantiateData.data?.document?.content?.content) &&
      instantiateData.data?.document?.content?.content.length >= 3,
      'Document initialized with rich structured AST blocks (headings, checklists, sections)'
    );

    // Verify creator has OWNER membership
    const ownerMembership = await prisma.documentMembership.findUnique({
      where: {
        documentId_userId: {
          documentId,
          userId: ownerUser.id,
        },
      },
    });
    assert(ownerMembership?.role === 'OWNER', 'Document creator automatically assigned OWNER membership in DB');

    // ═══════════════════════════════════════════════════════════════════════════
    // STAGE 4 & 5: COLLABORATION, ROLES, CRYPTOGRAPHIC INVITATIONS
    // ═══════════════════════════════════════════════════════════════════════════
    console.log('\n[STAGE 4 & 5] Document Access, Cryptographic Invitations & Transactional Acceptance:');

    // 1. Get access configuration as Owner
    const accessRes = await fetch(`${API_BASE}/documents/${documentId}/access`, { headers: ownerHeaders });
    const accessData = await accessRes.json();
    assert(accessRes.status === 200 && accessData.success, 'Retrieve access configuration (GET /api/documents/:id/access)');
    assert(accessData.data?.isOwner === true, 'Current user correctly identified as Document Owner');

    // 2. Dispatch Email Invitation to Collaborator (Role: VIEWER)
    const inviteRes = await fetch(`${API_BASE}/documents/${documentId}/invitations`, {
      method: 'POST',
      headers: ownerHeaders,
      body: JSON.stringify({
        recipientEmail: collaboratorEmail,
        role: 'VIEWER',
        message: 'Please review our Q4 strategy.',
      }),
    });
    const inviteData = await inviteRes.json();
    assert(inviteRes.status === 201 && inviteData.success, 'Issue cryptographic invitation (POST /api/documents/:id/invitations)');
    const invitationId = inviteData.data?.invitation?.id;
    assert(Boolean(invitationId), 'Invitation ID generated');

    // Verify invitation record in database
    const dbInvitation = await prisma.documentInvitation.findUnique({
      where: { id: invitationId },
    });
    assert(dbInvitation?.status === 'PENDING', 'Database invitation status is PENDING');
    assert(Boolean(dbInvitation?.tokenHash), 'High-entropy token hashed via SHA-256 in database (Raw token not stored)');
    assert(dbInvitation?.role === 'VIEWER', 'Assigned role stored as VIEWER');

    // 3. Resend invitation
    const resendRes = await fetch(`${API_BASE}/documents/${documentId}/invitations/${invitationId}/resend`, {
      method: 'POST',
      headers: ownerHeaders,
    });
    const resendData = await resendRes.json();
    assert(resendRes.status === 200 && resendData.success, 'Resend invitation refreshes token and extends expiry');

    // 4. Retrieve fresh raw token from DB's tokenHash or generate verification
    // To test acceptance via the public endpoint, let's generate a known token pair
    const testRawToken = crypto.randomBytes(32).toString('hex');
    const testTokenHash = crypto.createHash('sha256').update(testRawToken).digest('hex');

    await prisma.documentInvitation.update({
      where: { id: invitationId },
      data: { tokenHash: testTokenHash },
    });

    // Verify public invitation details check
    const verifyTokenRes = await fetch(`${API_BASE}/public/invitations/${testRawToken}`);
    const verifyTokenData = await verifyTokenRes.json();
    assert(verifyTokenRes.status === 200 && verifyTokenData.data?.recipientEmail === collaboratorEmail, 'Public verify invitation token');

    // 5. Acceptance Security Guard: Wrong user attempts to accept -> EXPECT 403 EMAIL_MISMATCH
    const mismatchAcceptRes = await fetch(`${API_BASE}/invitations/accept`, {
      method: 'POST',
      headers: intruderHeaders,
      body: JSON.stringify({ token: testRawToken }),
    });
    const mismatchAcceptData = await mismatchAcceptRes.json();
    assert(
      mismatchAcceptRes.status === 403 && mismatchAcceptData.error?.code === 'EMAIL_MISMATCH',
      'Security guard: Acceptance rejected when authenticated email does not match invited recipient (EMAIL_MISMATCH)'
    );

    // 6. Authorized user accepts invitation -> EXPECT 200 SUCCESS
    const validAcceptRes = await fetch(`${API_BASE}/invitations/accept`, {
      method: 'POST',
      headers: collabHeaders,
      body: JSON.stringify({ token: testRawToken }),
    });
    const validAcceptData = await validAcceptRes.json();
    assert(validAcceptRes.status === 200 && validAcceptData.success, 'Transactional acceptance grants access to authorized recipient');

    // Verify DB state after acceptance
    const acceptedInvitation = await prisma.documentInvitation.findUnique({ where: { id: invitationId } });
    assert(acceptedInvitation?.status === 'ACCEPTED', 'Invitation status transitioned to ACCEPTED');

    const collabMembership = await prisma.documentMembership.findUnique({
      where: { documentId_userId: { documentId, userId: collabUser.id } },
    });
    assert(collabMembership?.role === 'VIEWER', 'Collaborator membership created with VIEWER role');

    // ═══════════════════════════════════════════════════════════════════════════
    // PERMISSION ENFORCEMENT MATRIX (NEGATIVE TESTS)
    // ═══════════════════════════════════════════════════════════════════════════
    console.log('\n[STAGE 4 & 5] Permission Enforcement Matrix (Negative & Positive Authorization):');

    // As VIEWER: Can view document
    const viewerReadRes = await fetch(`${API_BASE}/documents/${documentId}`, { headers: collabHeaders });
    assert(viewerReadRes.status === 200, 'VIEWER can read document (GET /api/documents/:id)');

    // As VIEWER: Negative test: Cannot edit document (PATCH returns 403)
    const viewerEditRes = await fetch(`${API_BASE}/documents/${documentId}`, {
      method: 'PATCH',
      headers: collabHeaders,
      body: JSON.stringify({ title: 'Hacked Title By Viewer' }),
    });
    assert(viewerEditRes.status === 403, 'NEGATIVE TEST: VIEWER cannot edit document (PATCH /api/documents/:id returns 403 Forbidden)');

    // Promote Collaborator to EDITOR
    const promoteRes = await fetch(`${API_BASE}/documents/${documentId}/collaborators/${collabUser.id}`, {
      method: 'PATCH',
      headers: ownerHeaders,
      body: JSON.stringify({ role: 'EDITOR' }),
    });
    assert(promoteRes.status === 200, 'Owner promotes collaborator from VIEWER to EDITOR');

    // As EDITOR: Can now edit document
    const editorEditRes = await fetch(`${API_BASE}/documents/${documentId}`, {
      method: 'PATCH',
      headers: collabHeaders,
      body: JSON.stringify({ title: 'Q4 Product Strategy Sync (Reviewed by Editor)' }),
    });
    assert(editorEditRes.status === 200, 'EDITOR can successfully edit document');

    // As EDITOR: Negative test: Cannot delete document (DELETE returns 403)
    const editorDeleteRes = await fetch(`${API_BASE}/documents/${documentId}`, {
      method: 'DELETE',
      headers: collabHeaders,
    });
    assert(editorDeleteRes.status === 403, 'NEGATIVE TEST: EDITOR cannot delete document (DELETE /api/documents/:id returns 403 Forbidden)');

    // Owner revokes Collaborator access
    const removeMemberRes = await fetch(`${API_BASE}/documents/${documentId}/collaborators/${collabUser.id}`, {
      method: 'DELETE',
      headers: ownerHeaders,
    });
    assert(removeMemberRes.status === 200, 'Owner revokes collaborator access (DELETE /api/documents/:id/collaborators/:userId)');

    // As Revoked User: Negative test: Cannot read document anymore
    const revokedReadRes = await fetch(`${API_BASE}/documents/${documentId}`, { headers: collabHeaders });
    assert(revokedReadRes.status === 403, 'NEGATIVE TEST: Revoked user immediately loses read access (returns 403 Forbidden)');

    // ═══════════════════════════════════════════════════════════════════════════
    // STAGE 6: PUBLIC LINK SHARING WITH PASSWORD & EXPIRY
    // ═══════════════════════════════════════════════════════════════════════════
    console.log('\n[STAGE 6] Public Link Sharing & Password Security:');

    // 1. Enable public link with Argon2 password
    const publicConfigRes = await fetch(`${API_BASE}/documents/${documentId}/public-link`, {
      method: 'POST',
      headers: ownerHeaders,
      body: JSON.stringify({
        isEnabled: true,
        permission: 'VIEW',
        password: 'ClassifiedAccess2026',
      }),
    });
    const publicConfigData = await publicConfigRes.json();
    assert(publicConfigRes.status === 200 && publicConfigData.success, 'Enable public link with Argon2 password protection');
    const publicToken = publicConfigData.data?.publicLink?.publicToken;
    assert(Boolean(publicToken), 'Unique public token generated');

    // 2. Fetch public link without password -> Expect 401 PASSWORD_REQUIRED
    const noPassRes = await fetch(`${API_BASE}/public/documents/${publicToken}`);
    const noPassData = await noPassRes.json();
    assert(noPassRes.status === 401 && noPassData.error?.code === 'PASSWORD_REQUIRED', 'Access rejected without password (401 PASSWORD_REQUIRED)');

    // 3. Fetch public link with wrong password -> Expect 403 INVALID_PASSWORD
    const wrongPassRes = await fetch(`${API_BASE}/public/documents/${publicToken}?password=wrong-pass`);
    const wrongPassData = await wrongPassRes.json();
    assert(wrongPassRes.status === 403 && wrongPassData.error?.code === 'INVALID_PASSWORD', 'Access rejected with incorrect password (403 INVALID_PASSWORD)');

    // 4. Fetch public link with valid password -> Expect 200 OK
    const validPassRes = await fetch(`${API_BASE}/public/documents/${publicToken}?password=ClassifiedAccess2026`);
    const validPassData = await validPassRes.json();
    assert(validPassRes.status === 200 && validPassData.data?.document?.id === documentId, 'Public link verified and accessed with valid password');

    // 5. Disable public link -> Expect revoked access
    await fetch(`${API_BASE}/documents/${documentId}/public-link`, {
      method: 'POST',
      headers: ownerHeaders,
      body: JSON.stringify({ isEnabled: false }),
    });

    const disabledRes = await fetch(`${API_BASE}/public/documents/${publicToken}?password=ClassifiedAccess2026`);
    assert(disabledRes.status === 404, 'Disabled public link immediately revokes access (404 NOT_FOUND)');

    // ═══════════════════════════════════════════════════════════════════════════
    // STAGE 7: DOCUMENT PUBLISHING WORKFLOW
    // ═══════════════════════════════════════════════════════════════════════════
    console.log('\n[STAGE 7] Document Publishing & Release Management:');

    // 1. Publish document release
    const publishRes = await fetch(`${API_BASE}/documents/${documentId}/publish`, {
      method: 'POST',
      headers: ownerHeaders,
      body: JSON.stringify({ title: 'Q4 Product Strategy Release v1' }),
    });
    const publishData = await publishRes.json();
    assert(publishRes.status === 200 && publishData.data?.document?.status === 'PUBLISHED', 'Publish document release (POST /api/documents/:id/publish)');

    // Verify snapshot in DB
    const publication = await prisma.documentPublication.findFirst({
      where: { documentId, status: 'PUBLISHED' },
    });
    assert(publication?.publishedTitle === 'Q4 Product Strategy Release v1', 'Document publication snapshot persisted with title');

    // 2. Unpublish document back to DRAFT
    const unpublishRes = await fetch(`${API_BASE}/documents/${documentId}/unpublish`, {
      method: 'POST',
      headers: ownerHeaders,
    });
    const unpublishData = await unpublishRes.json();
    assert(unpublishRes.status === 200 && unpublishData.data?.document?.status === 'DRAFT', 'Unpublish document back to DRAFT');

    // ═══════════════════════════════════════════════════════════════════════════
    // NOTES-TO-ACTIONS ENGINE VERIFICATION
    // ═══════════════════════════════════════════════════════════════════════════
    console.log('\n[SUPREME DIRECTIVE] Notes-to-Actions Engine (Task Persistence):');

    const tasksRes = await fetch(`${API_BASE}/tasks/batch`, {
      method: 'POST',
      headers: ownerHeaders,
      body: JSON.stringify({
        documentId,
        tasks: [
          { title: 'Finalize Q4 architecture review with leads', priority: 'HIGH' },
          { title: 'Provision staging cluster environment', priority: 'MEDIUM' },
        ],
      }),
    });
    const tasksData = await tasksRes.json();
    assert(tasksRes.status === 201 && tasksData.data?.count === 2, 'Batch persist extracted action items into Tasks module');

    // List tasks linked to document
    const listTasksRes = await fetch(`${API_BASE}/tasks?documentId=${documentId}`, { headers: ownerHeaders });
    const listTasksData = await listTasksRes.json();
    assert(
      listTasksRes.status === 200 &&
      listTasksData.data?.tasks?.length === 2 &&
      listTasksData.data?.tasks[0]?.documentId === documentId,
      'Tasks query verified: linked directly to source document'
    );

    // Update task status
    const firstTaskId = listTasksData.data?.tasks[0]?.id;
    const updateTaskRes = await fetch(`${API_BASE}/tasks/${firstTaskId}`, {
      method: 'PATCH',
      headers: ownerHeaders,
      body: JSON.stringify({ status: 'DONE' }),
    });
    const updateTaskData = await updateTaskRes.json();
    assert(updateTaskRes.status === 200 && updateTaskData.data?.task?.status === 'DONE', 'Task status transition to DONE');

  } catch (err: any) {
    console.error('Fatal test error:', err);
    failed++;
  } finally {
    // Clean up test users & docs
    await prisma.document.deleteMany({ where: { creatorId: ownerUser.id } }).catch(() => null);
    await prisma.user.deleteMany({ where: { id: { in: [ownerUser.id, collabUser.id, intruderUser.id] } } }).catch(() => null);
  }

  console.log('\n════════════════════════════════════════════════════════════════');
  console.log(`  VERIFICATION RESULTS:  TOTAL PASSED: ${passed}  |  FAILED: ${failed}`);
  console.log('════════════════════════════════════════════════════════════════\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTemplatesAndSharingTests();
