import { prisma } from '../src/lib/prisma';
import { hashPassword } from '../src/lib/password';
import crypto from 'crypto';

const API_BASE = 'http://localhost:4000/api';

async function runTests() {
  console.log('════════════════════════════════════════════════════════════════');
  console.log('  KRONOS DOCUMENTS & NOTES — AUTOMATED INTEGRATION VERIFICATION ');
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

  // 1. Create a clean test user & session directly
  const testEmail = `operator-test-${Date.now()}@kronos.internal`;
  const passwordHash = await hashPassword('Password123!');
  const testUser = await prisma.user.create({
    data: {
      email: testEmail,
      emailNormalized: testEmail.toLowerCase(),
      displayName: 'Test Operator',
      passwordHash,
      emailVerified: true,
      onboardingComplete: true,
    },
  });

  const sessionToken = crypto.randomBytes(32).toString('hex');
  const sessionTokenHash = crypto.createHash('sha256').update(sessionToken).digest('hex');

  await prisma.session.create({
    data: {
      userId: testUser.id,
      tokenHash: sessionTokenHash,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });

  const headers = {
    'Content-Type': 'application/json',
    'Cookie': `session_token=${sessionToken}`,
  };

  try {
    // ─── Test 1: Workspace Auto-Resolution & Initial Document Creation ───
    console.log('\n[STAGE 2] Document CRUD & Database Persistence:');

    const createRes = await fetch(`${API_BASE}/documents`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        title: 'Quantum Telemetry Protocol',
        icon: '⚡',
        content: {
          type: 'doc',
          content: [
            { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Quantum Telemetry Protocol' }] },
            { type: 'paragraph', content: [{ type: 'text', text: 'Persistent telemetry baseline for sovereign nodes.' }] },
          ],
        },
      }),
    });

    const createData = await createRes.json();
    assert(createRes.status === 201 && createData.success, 'Document Creation (POST /api/documents)');
    const documentId = createData.data?.document?.id;
    assert(Boolean(documentId), 'Document ID generated with cuid()');
    assert(createData.data?.document?.version === 1, 'Initial OCC Version is 1');

    // ─── Test 2: Document Retrieval by ID ───
    const getRes = await fetch(`${API_BASE}/documents/${documentId}`, { headers });
    const getData = await getRes.json();
    assert(getRes.status === 200 && getData.data?.document?.title === 'Quantum Telemetry Protocol', 'Document Fetch by ID (GET /api/documents/:id)');
    assert(Array.isArray(getData.data?.document?.breadcrumbs), 'Breadcrumb hierarchy computed');

    // ─── Test 3: Document Update & Version Increment ───
    const updateRes = await fetch(`${API_BASE}/documents/${documentId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        clientVersion: 1,
        title: 'Quantum Telemetry Protocol v2',
        content: {
          type: 'doc',
          content: [
            { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Quantum Telemetry Protocol v2' }] },
            { type: 'paragraph', content: [{ type: 'text', text: 'Updated node parameters and cryptographic key rotation.' }] },
          ],
        },
      }),
    });
    const updateData = await updateRes.json();
    assert(updateRes.status === 200 && updateData.data?.document?.version === 2, 'Document Update with OCC Increment to v2 (PATCH /api/documents/:id)');

    // ─── Test 4: Optimistic Concurrency Control (OCC) Conflict Detection ───
    console.log('\n[STAGE 5] Autosave & Optimistic Concurrency Control (OCC):');

    const staleRes = await fetch(`${API_BASE}/documents/${documentId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        clientVersion: 1, // Stale version! Server is now at version 2!
        title: 'Stale Overwrite Attempt',
      }),
    });
    const staleData = await staleRes.json();
    assert(staleRes.status === 409 && staleData.error?.code === 'CONCURRENCY_CONFLICT', 'OCC Conflict Prevention (409 CONFLICT on Stale Version Update)');

    // ─── Test 5: Revisions & History Snapshot Rollback ───
    console.log('\n[STAGE 5 cont.] Revision Snapshots & Rollback Restoration:');

    const revSnapshotRes = await fetch(`${API_BASE}/documents/${documentId}/revisions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ description: 'Pre-Deployment Baseline Snapshot' }),
    });
    const revSnapshotData = await revSnapshotRes.json();
    assert(revSnapshotRes.status === 201 && revSnapshotData.data?.revision?.version === 2, 'Manual Revision Snapshot Creation');
    const snapshotId = revSnapshotData.data?.revision?.id;

    // Mutate document to v3
    await fetch(`${API_BASE}/documents/${documentId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ clientVersion: 2, title: 'Experimental Mutated Title' }),
    });

    // Restore to snapshot
    const restoreRevRes = await fetch(`${API_BASE}/documents/${documentId}/revisions/${snapshotId}/restore`, {
      method: 'POST',
      headers,
    });
    const restoreRevData = await restoreRevRes.json();
    assert(restoreRevRes.status === 200 && restoreRevData.data?.document?.title === 'Quantum Telemetry Protocol v2', 'Snapshot Rollback Restoration');

    // ─── Test 6: Folder Hierarchy & Document Nesting ───
    console.log('\n[STAGE 4] Folder Organization & Hierarchy:');

    const folderRes = await fetch(`${API_BASE}/folders`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: 'Architecture Specifications', icon: '📁' }),
    });
    const folderData = await folderRes.json();
    assert(folderRes.status === 201 && folderData.data?.folder?.name === 'Architecture Specifications', 'Folder Creation (POST /api/folders)');
    const folderId = folderData.data?.folder?.id;

    // Move document into folder
    const moveRes = await fetch(`${API_BASE}/documents/${documentId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ folderId }),
    });
    const moveData = await moveRes.json();
    assert(moveRes.status === 200 && moveData.data?.document?.folderId === folderId, 'Move Document to Folder');

    // ─── Test 7: Workspace Search & Snippet Matching ───
    console.log('\n[STAGE 8] Full-Text Workspace Search:');

    const searchRes = await fetch(`${API_BASE}/search?q=Quantum`, { headers });
    const searchData = await searchRes.json();
    assert(
      searchRes.status === 200 &&
      Array.isArray(searchData.data?.results) &&
      searchData.data.results.some((r: any) => r.id === documentId),
      'Workspace Full-Text Search (GET /api/search?q=Quantum)'
    );

    // ─── Test 8: Template Catalog & Template Instantiation ───
    console.log('\n[STAGE 7] System Templates & Instantiation:');

    const templatesRes = await fetch(`${API_BASE}/templates`, { headers });
    const templatesData = await templatesRes.json();
    assert(
      templatesRes.status === 200 &&
      templatesData.data?.templates?.length >= 5,
      'Pre-Seeded System Templates Available (GET /api/templates)'
    );

    const meetingTemplate = templatesData.data.templates.find((t: any) => t.name === 'Meeting Notes');
    assert(Boolean(meetingTemplate), 'Meeting Notes System Template exists');

    const useTplRes = await fetch(`${API_BASE}/templates/${meetingTemplate.id}/use`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ title: 'Sprint Retrospective Sync' }),
    });
    const useTplData = await useTplRes.json();
    assert(useTplRes.status === 201 && useTplData.data?.document?.title === 'Sprint Retrospective Sync', 'Document Instantiated from Template');

    // ─── Test 9: AI Writing, Task Checklist Extraction, & Q&A ───
    console.log('\n[STAGE 9] AI Transformations & Grounded Q&A:');

    const aiTasksRes = await fetch(`${API_BASE}/ai/transform`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        action: 'extract_tasks',
        text: 'Review system architecture benchmarks\nConfirm database indexing and migration status\nValidate client-side optimistic concurrency rollback',
      }),
    });
    const aiTasksData = await aiTasksRes.json();
    assert(
      aiTasksRes.status === 200 &&
      aiTasksData.data?.result?.includes('- [ ]'),
      'AI Action Items Extraction to Task Checklist (POST /api/ai/transform)'
    );

    const aiQaRes = await fetch(`${API_BASE}/ai/qa`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        question: 'What is the purpose of this telemetry document?',
        documentId,
      }),
    });
    const aiQaData = await aiQaRes.json();
    assert(
      aiQaRes.status === 200 &&
      Boolean(aiQaData.data?.answer),
      'AI Grounded Q&A Against Document Context (POST /api/ai/qa)'
    );

    // ─── Test 10: Public Share Link & Security Isolation ───
    console.log('\n[STAGE 10] Public Sharing & Permission Gates:');

    const shareRes = await fetch(`${API_BASE}/documents/${documentId}/share`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ isPublic: true, permission: 'VIEW', publish: true }),
    });
    const shareData = await shareRes.json();
    assert(shareRes.status === 200 && shareData.data?.isPublic === true, 'Public Share Enabled (POST /api/documents/:id/share)');
    const shareToken = shareData.data?.shareToken;

    // Fetch public document WITHOUT auth headers
    const publicRes = await fetch(`${API_BASE}/public/documents/${shareToken}`);
    const publicData = await publicRes.json();
    assert(
      publicRes.status === 200 &&
      publicData.data?.document?.title === 'Quantum Telemetry Protocol v2',
      'Public Document Access without Session (GET /api/public/documents/:token)'
    );

    // ─── Test 11: Soft Deletion to Trash & Restoration ───
    console.log('\n[STAGE 2 cont.] Safe Deletion, Trash, & Restoration:');

    const trashRes = await fetch(`${API_BASE}/documents/${documentId}`, {
      method: 'DELETE',
      headers,
    });
    assert(trashRes.status === 200, 'Soft Delete Document to Trash (DELETE /api/documents/:id)');

    // Verify it is excluded from active list
    const activeListRes = await fetch(`${API_BASE}/documents`, { headers });
    const activeListData = await activeListRes.json();
    assert(
      !activeListData.data?.documents?.some((d: any) => d.id === documentId),
      'Trashed Document Excluded from Active Documents List'
    );

    // Restore from trash
    const restoreTrashRes = await fetch(`${API_BASE}/documents/${documentId}/restore`, {
      method: 'POST',
      headers,
    });
    assert(restoreTrashRes.status === 200, 'Restore Document from Trash (POST /api/documents/:id/restore)');

    // ─── Test 12: Workspace Backup & Recovery Procedures ───
    console.log('\n[STAGE 11] Workspace Backup & Recovery Procedures (Feature 152):');

    const backupRes = await fetch(`${API_BASE}/documents/export-all`, { headers });
    const backupData = await backupRes.json();
    assert(backupRes.status === 200 && backupData.documentsCount > 0, 'Workspace Backup Export (GET /api/documents/export-all)');

    const restoreBackupRes = await fetch(`${API_BASE}/documents/restore-backup`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        documents: [
          {
            title: 'Recovered Archive Document',
            markdown: '# Disaster Recovery Node\nVerified snapshot restoration.',
          },
        ],
      }),
    });
    const restoreBackupData = await restoreBackupRes.json();
    assert(
      restoreBackupRes.status === 200 && restoreBackupData.data?.restoredCount === 1,
      'Workspace Disaster Recovery Procedure (POST /api/documents/restore-backup)'
    );

    // ─── Clean up test data ───
    await prisma.document.deleteMany({ where: { creatorId: testUser.id } });
    await prisma.folder.deleteMany({ where: { creatorId: testUser.id } });
    await prisma.session.deleteMany({ where: { userId: testUser.id } });
    await prisma.user.delete({ where: { id: testUser.id } });

  } catch (error) {
    console.error('Test execution error:', error);
    failed++;
  }

  console.log('\n════════════════════════════════════════════════════════════════');
  console.log(`  SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('════════════════════════════════════════════════════════════════\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(console.error);
