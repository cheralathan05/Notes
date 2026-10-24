/**
 * KRONOS — ARCHITECTURE CANVAS FULL-STACK E2E VERIFICATION SUITE
 * 
 * Verifies:
 * 1. Multi-tenant workspace provisioning (Alice in WS-A, Charlie in WS-B)
 * 2. Canvas creation and initial state retrieval
 * 3. Node operations (creation, editing, positioning, duplication, deletion)
 * 4. Connection operations (creation, label editing, invalid reference rejection, cleanup upon node deletion)
 * 5. Sticky note annotations and persistence
 * 6. Critical Test 1: Add node + connection, save canvas, reload, verify exact positions and labels
 * 7. Critical Test 2: Multiple canvases, switch between them, verify nodes and notes do not mix
 * 8. Canvas duplication: independent entity IDs with preserved connection mappings
 * 9. Critical Test 3: Save failure reporting (honesty test: server returns error, not false success)
 * 10. Blueprint templates retrieval and validation (monolith, microservices, ai_pipeline)
 * 11. Cross-workspace security: foreign user Charlie denied access (HTTP 403 Forbidden)
 * 12. Canvas deletion and clean database teardown
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

async function runArchitectureCanvasSuite() {
  console.log('\n' + '═'.repeat(75));
  console.log('   KRONOS — ARCHITECTURE CANVAS FULL-STACK E2E VERIFICATION SUITE');
  console.log('   Visual Design Studio • Node/Connection Editor • Persistence • Security');
  console.log('═'.repeat(75) + '\n');

  const stamp = crypto.randomBytes(4).toString('hex');
  const emailA = `alice.arch.${stamp}@kronos.internal`;
  const emailC = `charlie.foreign.${stamp}@kronos.internal`;
  const password = 'StrongPassword!123';

  let cookieA = '';
  let cookieC = '';

  let userA: any = null;
  let userC: any = null;

  let workspaceA: any = null;
  let workspaceB: any = null;

  let canvas1Id: string = '';
  let canvas2Id: string = '';
  let duplicatedCanvasId: string = '';

  try {
    // ─── STEP 1: Provision Accounts & Multi-Tenant Workspaces ───────────────
    console.log('[Step 1] Provisioning test accounts and multi-tenant workspaces...');

    // Register Alice
    const regARes = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: 'Alice Lead Architect', email: emailA, password, confirmPassword: password }),
    });
    const regAData = (await regARes.json()) as any;
    assert(regARes.status === 201 && regAData.success, `Account Alice registered: ${emailA}`);
    const setCookieA = regARes.headers.get('set-cookie');
    if (setCookieA) cookieA = setCookieA.split(';')[0];
    if (!cookieA && regAData.data?.token) cookieA = `session_token=${regAData.data.token}`;
    userA = regAData.data.user;

    // Register Charlie
    const regCRes = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: 'Charlie Foreign Auditor', email: emailC, password, confirmPassword: password }),
    });
    const regCData = (await regCRes.json()) as any;
    assert(regCRes.status === 201 && regCData.success, `Account Charlie registered: ${emailC}`);
    const setCookieC = regCRes.headers.get('set-cookie');
    if (setCookieC) cookieC = setCookieC.split(';')[0];
    if (!cookieC && regCData.data?.token) cookieC = `session_token=${regCData.data.token}`;
    userC = regCData.data.user;

    workspaceA = await prisma.workspace.create({
      data: {
        name: `Architecture Studio WS ${stamp}`,
        slug: `arch-studio-${stamp}`,
        members: {
          create: [{ userId: userA.id, role: 'OWNER' }],
        },
      },
    });
    assert(!!workspaceA.id, `Workspace A established: ${workspaceA.id}`);

    workspaceB = await prisma.workspace.create({
      data: {
        name: `Foreign Corp WS ${stamp}`,
        slug: `foreign-corp-${stamp}`,
        members: {
          create: [{ userId: userC.id, role: 'OWNER' }],
        },
      },
    });
    assert(!!workspaceB.id, `Workspace B established for Charlie`);

    // ─── STEP 2: Create Initial Canvas ──────────────────────────────────────
    console.log('\n[Step 2] Creating and initializing primary architecture canvas...');
    const createRes = await fetch(`${API_BASE}/api/canvases`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieA,
        'x-workspace-id': workspaceA.id,
      },
      body: JSON.stringify({
        title: `Core Infrastructure Diagram ${stamp}`,
        description: 'Main production topology layout',
        data: {
          nodes: [
            { id: 'fe-1', type: 'frontend', title: 'Next.js 16 Web App', description: 'User interface & SSR', x: 100, y: 150, color: '#3B82F6', icon: 'Globe' },
            { id: 'api-1', type: 'api', title: 'Express Monolithic Core', description: 'REST & SSE Gateway', x: 420, y: 150, color: '#10B981', icon: 'Server' },
          ],
          connections: [
            { from: 'fe-1', to: 'api-1', label: 'HTTPS / JSON' },
          ],
          notes: [
            { id: 'note-1', text: 'Monolithic single-tenant core design', x: 200, y: 350, color: '#F59E0B' },
          ],
        },
      }),
    });
    const createData = (await createRes.json()) as any;
    assert(createRes.status === 201 && createData.success, 'Alice created primary canvas');
    canvas1Id = createData.data.canvas.id;
    assert(createData.data.canvas.data.nodes.length === 2, 'Canvas initialized with 2 nodes');
    assert(createData.data.canvas.data.connections.length === 1, 'Canvas initialized with 1 connection');

    // ─── STEP 3: Node Management Operations ─────────────────────────────────
    console.log('\n[Step 3] Testing node creation, editing, and positioning...');

    // Add database node & update canvas
    const updatedNodes = [
      ...createData.data.canvas.data.nodes,
      { id: 'db-1', type: 'db', title: 'PostgreSQL Relational DB', description: 'Primary database cluster', x: 780, y: 150, color: '#8B5CF6', icon: 'Database' },
    ];
    const updatedConns = [
      ...createData.data.canvas.data.connections,
      { from: 'api-1', to: 'db-1', label: 'Prisma Client ORM' },
    ];

    const updateRes = await fetch(`${API_BASE}/api/canvases/${canvas1Id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieA,
        'x-workspace-id': workspaceA.id,
      },
      body: JSON.stringify({
        data: {
          nodes: updatedNodes,
          connections: updatedConns,
          notes: createData.data.canvas.data.notes,
        },
      }),
    });
    const updateData = (await updateRes.json()) as any;
    assert(updateRes.status === 200 && updateData.success, 'Canvas updated with new database node');
    assert(updateData.data.canvas.data.nodes.length === 3, 'Canvas contains 3 nodes');
    assert(updateData.data.canvas.data.connections.length === 2, 'Canvas contains 2 connections');

    // ─── STEP 4: Connection Management & Cleanup on Node Deletion ───────────
    console.log('\n[Step 4] Testing connection validation and cleanup on node deletion...');

    // Delete node 'fe-1' and verify its connection to 'api-1' is cleaned up
    const filteredNodes = updatedNodes.filter((n: any) => n.id !== 'fe-1');
    const delNodeUpdateRes = await fetch(`${API_BASE}/api/canvases/${canvas1Id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieA,
        'x-workspace-id': workspaceA.id,
      },
      body: JSON.stringify({
        data: {
          nodes: filteredNodes,
          // Connection validator strips connection referencing deleted fe-1
          connections: updatedConns,
          notes: createData.data.canvas.data.notes,
        },
      }),
    });
    const delNodeData = (await delNodeUpdateRes.json()) as any;
    assert(delNodeUpdateRes.status === 200, 'Canvas updated after node removal');
    assert(delNodeData.data.canvas.data.nodes.length === 2, 'Node count decreased to 2');
    const remainingConns = delNodeData.data.canvas.data.connections;
    assert(remainingConns.length === 1 && remainingConns[0].from === 'api-1', 'Dangling connection automatically removed by validator');

    // ─── STEP 5: Sticky Note Annotations ────────────────────────────────────
    console.log('\n[Step 5] Testing sticky notes persistence and formatting...');
    const newNote = { id: 'note-2', text: 'Security requirement: TLS 1.3 only', x: 450, y: 350, color: '#10B981' };
    const noteRes = await fetch(`${API_BASE}/api/canvases/${canvas1Id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieA,
        'x-workspace-id': workspaceA.id,
      },
      body: JSON.stringify({
        data: {
          nodes: filteredNodes,
          connections: remainingConns,
          notes: [...createData.data.canvas.data.notes, newNote],
        },
      }),
    });
    const noteData = (await noteRes.json()) as any;
    assert(noteRes.status === 200, 'Sticky note added and persisted');
    assert(noteData.data.canvas.data.notes.length === 2, '2 sticky notes present in canvas data');

    // ─── STEP 6: Critical Test 1 — Save and Reload Exact Positions ──────────
    console.log('\n[Step 6] Critical Test 1: Save Canvas, reload, and verify exact positions and connections...');
    const test1Nodes = [
      { id: 'node-pos-1', type: 'api', title: 'Gateway', description: 'Port 4000', x: 234, y: 567, color: '#10B981', icon: 'Server' },
      { id: 'node-pos-2', type: 'db', title: 'PostgreSQL', description: 'Port 5432', x: 890, y: 123, color: '#8B5CF6', icon: 'Database' },
    ];
    const test1Conns = [
      { from: 'node-pos-1', to: 'node-pos-2', label: 'SQL Connection Pool' },
    ];

    const saveRes = await fetch(`${API_BASE}/api/canvases/${canvas1Id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieA,
        'x-workspace-id': workspaceA.id,
      },
      body: JSON.stringify({
        data: {
          nodes: test1Nodes,
          connections: test1Conns,
          notes: [{ id: 'note-pos', text: 'Verified precision positioning', x: 300, y: 400, color: '#F59E0B' }],
        },
      }),
    });
    assert(saveRes.status === 200, 'Saved canvas with precision coordinates');

    // Simulate page refresh by reloading via GET
    const reloadRes = await fetch(`${API_BASE}/api/canvases/${canvas1Id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieA,
        'x-workspace-id': workspaceA.id,
      },
    });
    const reloadData = (await reloadRes.json()) as any;
    assert(reloadRes.status === 200 && reloadData.success, 'Reloaded canvas after refresh');

    const reloadedNodes = reloadData.data.canvas.data.nodes;
    const reloadedConns = reloadData.data.canvas.data.connections;

    const reloadedNode1 = reloadedNodes.find((n: any) => n.id === 'node-pos-1');
    const reloadedNode2 = reloadedNodes.find((n: any) => n.id === 'node-pos-2');

    assert(reloadedNode1?.x === 234 && reloadedNode1?.y === 567, 'Node 1 exact coordinates (234, 567) preserved after reload');
    assert(reloadedNode2?.x === 890 && reloadedNode2?.y === 123, 'Node 2 exact coordinates (890, 123) preserved after reload');
    assert(reloadedConns.length === 1 && reloadedConns[0].label === 'SQL Connection Pool', 'Connection and label preserved intact');

    // Also verify directly against PostgreSQL table
    const dbCanvas1 = await prisma.workspaceCanvas.findUnique({ where: { id: canvas1Id } });
    const dbData1 = dbCanvas1?.data as any;
    assert(dbData1.nodes[0].x === 234 && dbData1.nodes[0].y === 567, 'Database record directly verified with matching coordinates');

    // ─── STEP 7: Critical Test 2 — Multiple Canvases & Non-Mixing Data ──────
    console.log('\n[Step 7] Critical Test 2: Multiple Canvases isolation (nodes/notes do not mix)...');

    const create2Res = await fetch(`${API_BASE}/api/canvases`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieA,
        'x-workspace-id': workspaceA.id,
      },
      body: JSON.stringify({
        title: `Analytics Pipeline Canvas ${stamp}`,
        description: 'Separate event stream topology',
        data: {
          nodes: [
            { id: 'analytics-worker', type: 'cloud', title: 'ClickHouse Ingestion Job', x: 50, y: 50, color: '#F59E0B', icon: 'Cloud' },
          ],
          connections: [],
          notes: [
            { id: 'analytics-note', text: 'Analytics specific note', x: 50, y: 200, color: '#3B82F6' },
          ],
        },
      }),
    });
    const create2Data = (await create2Res.json()) as any;
    assert(create2Res.status === 201, 'Created second canvas');
    canvas2Id = create2Data.data.canvas.id;

    // Fetch both canvases and verify independent data
    const fetch1 = await fetch(`${API_BASE}/api/canvases/${canvas1Id}`, {
      headers: { Cookie: cookieA, 'x-workspace-id': workspaceA.id },
    });
    const data1 = (await fetch1.json()) as any;

    const fetch2 = await fetch(`${API_BASE}/api/canvases/${canvas2Id}`, {
      headers: { Cookie: cookieA, 'x-workspace-id': workspaceA.id },
    });
    const data2 = (await fetch2.json()) as any;

    assert(data1.data.canvas.title !== data2.data.canvas.title, 'Canvases have distinct titles');
    assert(data1.data.canvas.data.nodes.some((n: any) => n.id === 'node-pos-1'), 'Canvas 1 contains its original node-pos-1');
    assert(!data2.data.canvas.data.nodes.some((n: any) => n.id === 'node-pos-1'), 'Canvas 2 does NOT contain Canvas 1 nodes');
    assert(data2.data.canvas.data.nodes.some((n: any) => n.id === 'analytics-worker'), 'Canvas 2 contains its own analytics worker');
    assert(!data1.data.canvas.data.nodes.some((n: any) => n.id === 'analytics-worker'), 'Canvas 1 does NOT contain Canvas 2 nodes');
    assert(data1.data.canvas.data.notes[0].text !== data2.data.canvas.data.notes[0].text, 'Sticky notes are completely isolated between canvases');

    // ─── STEP 8: Canvas Duplication with Independent IDs ────────────────────
    console.log('\n[Step 8] Testing canvas duplication with entity remapping...');
    const dupRes = await fetch(`${API_BASE}/api/canvases/${canvas1Id}/duplicate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieA,
        'x-workspace-id': workspaceA.id,
      },
    });
    const dupData = (await dupRes.json()) as any;
    assert(dupRes.status === 201 && dupData.success, 'Duplicated canvas successfully');
    duplicatedCanvasId = dupData.data.canvas.id;
    assert(duplicatedCanvasId !== canvas1Id, 'Duplicated canvas received new unique ID');
    assert(dupData.data.canvas.title.includes('(Copy)'), 'Duplicated canvas title appended with (Copy)');

    const dupNodes = dupData.data.canvas.data.nodes;
    const dupConns = dupData.data.canvas.data.connections;

    // Verify IDs are remapped
    assert(dupNodes[0].id !== test1Nodes[0].id, 'Duplicated node 1 assigned brand new ID');
    assert(dupNodes[1].id !== test1Nodes[1].id, 'Duplicated node 2 assigned brand new ID');
    assert(dupConns[0].from === dupNodes[0].id && dupConns[0].to === dupNodes[1].id, 'Duplicated connection properly remapped to new node IDs');

    // ─── STEP 9: Critical Test 3 — Save Failure Reporting ───────────────────
    console.log('\n[Step 9] Critical Test 3: Save failure reporting (honesty test)...');
    // Attempt to update a nonexistent canvas ID
    const failRes = await fetch(`${API_BASE}/api/canvases/nonexistent-canvas-id-99999`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieA,
        'x-workspace-id': workspaceA.id,
      },
      body: JSON.stringify({
        title: 'Should fail',
      }),
    });
    assert(failRes.status === 404, 'Server correctly returned HTTP 404 for invalid canvas ID (does not claim false success)');
    const failData = (await failRes.json()) as any;
    assert(failData.success === false, 'Response payload explicitly reports success: false');

    // ─── STEP 10: Blueprint Templates Verification ──────────────────────────
    console.log('\n[Step 10] Testing architecture blueprints retrieval...');
    const tplRes = await fetch(`${API_BASE}/api/canvases/templates`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieA,
        'x-workspace-id': workspaceA.id,
      },
    });
    const tplData = (await tplRes.json()) as any;
    assert(tplRes.status === 200 && tplData.success, 'Blueprint templates endpoint returned HTTP 200');
    assert(!!tplData.data.templates.monolith, 'Monolithic blueprint template available');
    assert(!!tplData.data.templates.microservices, 'Microservices blueprint template available');
    assert(!!tplData.data.templates.ai_pipeline, 'AI Pipeline blueprint template available');
    assert(tplData.data.templates.monolith.data.nodes.length >= 4, 'Monolith blueprint contains full set of production nodes');

    // ─── STEP 11: Cross-Workspace Security Isolation ────────────────────────
    console.log('\n[Step 11] Testing cross-workspace security boundaries...');
    // Charlie from Workspace B attempts to access Alice's canvas from Workspace A
    const unauthorizedReadRes = await fetch(`${API_BASE}/api/canvases/${canvas1Id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieC,
        'x-workspace-id': workspaceA.id, // Foreign workspace header
      },
    });
    assert(unauthorizedReadRes.status === 403, 'Charlie denied access to Workspace A canvas with HTTP 403 Forbidden');

    // Charlie attempts to delete Alice's canvas
    const unauthorizedDelRes = await fetch(`${API_BASE}/api/canvases/${canvas1Id}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieC,
        'x-workspace-id': workspaceA.id,
      },
    });
    assert(unauthorizedDelRes.status === 403, 'Charlie denied permission to delete Alice\'s canvas with HTTP 403 Forbidden');

    // ─── STEP 12: Canvas Deletion & Database Verification ───────────────────
    console.log('\n[Step 12] Testing canvas deletion and clean teardown...');
    const delRes = await fetch(`${API_BASE}/api/canvases/${canvas1Id}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieA,
        'x-workspace-id': workspaceA.id,
      },
    });
    const delData = (await delRes.json()) as any;
    assert(delRes.status === 200 && delData.data?.deleted === true, 'Alice deleted primary canvas');

    const checkDbDeleted = await prisma.workspaceCanvas.findUnique({
      where: { id: canvas1Id },
    });
    assert(checkDbDeleted === null, 'Primary canvas verified completely removed from PostgreSQL table');

    console.log('\n' + '═'.repeat(75));
    console.log(`   ALL ARCHITECTURE CANVAS E2E TESTS PASSED (${passed}/${total})`);
    console.log('   Full-Stack Verification Complete: 100% Success');
    console.log('═'.repeat(75) + '\n');
  } catch (err: any) {
    console.error('Test Suite Failed:', err);
    throw err;
  } finally {
    console.log('Teardown: Cleaning up test workspaces & records...');
    if (workspaceA?.id) {
      await prisma.workspaceCanvas.deleteMany({ where: { workspaceId: workspaceA.id } });
      await prisma.workspaceMember.deleteMany({ where: { workspaceId: workspaceA.id } });
      await prisma.workspace.delete({ where: { id: workspaceA.id } });
    }
    if (workspaceB?.id) {
      await prisma.workspaceCanvas.deleteMany({ where: { workspaceId: workspaceB.id } });
      await prisma.workspaceMember.deleteMany({ where: { workspaceId: workspaceB.id } });
      await prisma.workspace.delete({ where: { id: workspaceB.id } });
    }
    if (userA?.id) await prisma.user.delete({ where: { id: userA.id } }).catch(() => {});
    if (userC?.id) await prisma.user.delete({ where: { id: userC.id } }).catch(() => {});
    await prisma.$disconnect();
  }
}

runArchitectureCanvasSuite().catch((e) => {
  console.error('Fatal Suite Failure:', e);
  process.exit(1);
});
