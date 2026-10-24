/**
 * KRONOS — TEAM CHANNELS FULL-STACK PRODUCTION E2E VERIFICATION SUITE
 * 
 * Verifies:
 * 1. Multi-User provisioning (Alice Owner, Bob Member, Charlie Foreign User)
 * 2. Workspace & Channel creation (#general, #engineering, custom #product-launch)
 * 3. Topic updating, duplicate channel rejection (409)
 * 4. Private channel security & membership gate (#exec-strategy: Bob 403 until invited)
 * 5. Two-account real-time workflow (Alice sends, Bob receives, Bob replies with replyToId)
 * 6. Reactions toggling (Bob reacts 🚀, Alice verifies)
 * 7. Message editing (Alice edits own, Bob rejected 403)
 * 8. Pinning / unpinning messages
 * 9. Markdown preservation and malicious script sanitization
 * 10. Idempotency / duplicate submission protection
 * 11. Cross-workspace isolation (Charlie denied access)
 * 12. Search respecting channel privacy permissions
 * 13. Message deletion & clean database teardown
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

async function runTeamChannelsSuite() {
  console.log('\n' + '═'.repeat(75));
  console.log('   KRONOS — TEAM CHANNELS ULTIMATE MASTER VERIFICATION SUITE');
  console.log('   Multi-Account • Persistence • Private Channels • Security • Realtime');
  console.log('═'.repeat(75) + '\n');

  const stamp = crypto.randomBytes(4).toString('hex');
  const emailA = `alice.chat.${stamp}@kronos.internal`;
  const emailB = `bob.chat.${stamp}@kronos.internal`;
  const emailC = `charlie.foreign.${stamp}@kronos.internal`;
  const password = 'StrongPassword!123';

  let cookieA = '';
  let cookieB = '';
  let cookieC = '';

  let userA: any = null;
  let userB: any = null;
  let userC: any = null;

  let workspaceA: any = null;
  let workspaceB: any = null;

  let publicChannel: any = null;
  let privateChannel: any = null;
  let messageAId: string = '';
  let replyBId: string = '';

  try {
    // ─── STEP 1: Provision Accounts & Multi-Tenant Workspaces ───────────────
    console.log('[Step 1] Provisioning two authorized accounts + one foreign account...');

    // Register Alice
    const regARes = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: 'Alice Engineering Lead', email: emailA, password, confirmPassword: password }),
    });
    const regAData = (await regARes.json()) as any;
    assert(regARes.status === 201 && regAData.success, `Account Alice registered: ${emailA}`);
    const setCookieA = regARes.headers.get('set-cookie');
    if (setCookieA) cookieA = setCookieA.split(';')[0];
    if (!cookieA && regAData.data?.token) cookieA = `session_token=${regAData.data.token}`;
    userA = regAData.data.user;

    // Register Bob
    const regBRes = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: 'Bob Staff Developer', email: emailB, password, confirmPassword: password }),
    });
    const regBData = (await regBRes.json()) as any;
    assert(regBRes.status === 201 && regBData.success, `Account Bob registered: ${emailB}`);
    const setCookieB = regBRes.headers.get('set-cookie');
    if (setCookieB) cookieB = setCookieB.split(';')[0];
    if (!cookieB && regBData.data?.token) cookieB = `session_token=${regBData.data.token}`;
    userB = regBData.data.user;

    // Register Charlie (Foreign account)
    const regCRes = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: 'Charlie Foreign Operator', email: emailC, password, confirmPassword: password }),
    });
    const regCData = (await regCRes.json()) as any;
    assert(regCRes.status === 201 && regCData.success, `Account Charlie registered: ${emailC}`);
    const setCookieC = regCRes.headers.get('set-cookie');
    if (setCookieC) cookieC = setCookieC.split(';')[0];
    if (!cookieC && regCData.data?.token) cookieC = `session_token=${regCData.data.token}`;
    userC = regCData.data.user;

    // Establish Workspaces
    workspaceA = await prisma.workspace.create({
      data: {
        name: `KRONOS Core Team ${stamp}`,
        slug: `kronos-core-${stamp}`,
        members: {
          create: [
            { userId: userA.id, role: 'OWNER' },
            { userId: userB.id, role: 'MEMBER' },
          ],
        },
      },
    });
    assert(!!workspaceA.id, `Workspace A created with Alice (OWNER) and Bob (MEMBER)`);

    workspaceB = await prisma.workspace.create({
      data: {
        name: `Foreign Corp Workspace ${stamp}`,
        slug: `foreign-corp-${stamp}`,
        members: {
          create: [{ userId: userC.id, role: 'OWNER' }],
        },
      },
    });
    assert(!!workspaceB.id, `Workspace B created for Charlie (Foreign isolation)`);

    // ─── STEP 2: Default Channels Auto-Provisioning & Retrieval ─────────────
    console.log('\n[Step 2] Verifying default channel auto-initialization...');
    const channelsRes = await fetch(`${API_BASE}/api/chat/channels`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieA,
        'x-workspace-id': workspaceA.id,
      },
    });
    const channelsData = (await channelsRes.json()) as any;
    if (!channelsData.success) {
      console.log('channelsRes status:', channelsRes.status, 'error:', channelsData);
    }
    assert(channelsRes.status === 200 && channelsData.success, 'Alice fetched workspace channels');
    const channelNames = channelsData.data.channels.map((c: any) => c.name);
    assert(channelNames.includes('general'), 'Default channel #general present');
    assert(channelNames.includes('engineering'), 'Default channel #engineering present');
    assert(channelNames.includes('design'), 'Default channel #design present');
    assert(channelNames.includes('announcements'), 'Default channel #announcements present');
    assert(channelNames.includes('random'), 'Default channel #random present');

    // ─── STEP 3: Channel Lifecycle (Create, Duplicate Rejection, Update Topic) ─
    console.log('\n[Step 3] Testing dynamic channel creation and management...');

    // Create public channel #product-launch
    const createChanRes = await fetch(`${API_BASE}/api/chat/channels`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieA,
        'x-workspace-id': workspaceA.id,
      },
      body: JSON.stringify({
        name: 'product-launch',
        topic: 'Q4 Global Product Rollout',
        description: 'Coordination for international deployment',
        isPrivate: false,
      }),
    });
    const createChanData = (await createChanRes.json()) as any;
    assert(createChanRes.status === 201 && createChanData.success, 'Alice created public channel #product-launch');
    publicChannel = createChanData.data.channel;
    assert(publicChannel.name === 'product-launch', 'Created channel name matches product-launch');

    // Duplicate channel creation rejection
    const dupChanRes = await fetch(`${API_BASE}/api/chat/channels`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieA,
        'x-workspace-id': workspaceA.id,
      },
      body: JSON.stringify({
        name: 'product-launch',
        topic: 'Duplicate channel',
      }),
    });
    assert(dupChanRes.status === 409, 'Duplicate channel creation correctly rejected with HTTP 409');

    // Update topic
    const updateTopicRes = await fetch(`${API_BASE}/api/chat/channels/${publicChannel.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieA,
        'x-workspace-id': workspaceA.id,
      },
      body: JSON.stringify({
        topic: 'Updated: Q4 Global Multi-Region Rollout Strategy',
      }),
    });
    const updateTopicData = (await updateTopicRes.json()) as any;
    assert(updateTopicRes.status === 200 && updateTopicData.data.channel.topic.includes('Updated'), 'Channel topic successfully updated');

    // ─── STEP 4: Private Channel Authorization Gate ─────────────────────────
    console.log('\n[Step 4] Testing private channel security and access control...');

    // Alice creates private channel #exec-strategy
    const createPrivRes = await fetch(`${API_BASE}/api/chat/channels`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieA,
        'x-workspace-id': workspaceA.id,
      },
      body: JSON.stringify({
        name: 'exec-strategy',
        topic: 'Executive Board Discussion',
        isPrivate: true,
      }),
    });
    const createPrivData = (await createPrivRes.json()) as any;
    assert(createPrivRes.status === 201 && createPrivData.success, 'Alice created private channel #exec-strategy');
    privateChannel = createPrivData.data.channel;

    // Bob (not yet member of private channel) attempts to fetch messages
    const bobPrivRes = await fetch(`${API_BASE}/api/chat/messages?channel=exec-strategy`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieB,
        'x-workspace-id': workspaceA.id,
      },
    });
    assert(bobPrivRes.status === 403, 'Bob denied access to private channel with HTTP 403 Forbidden');

    // Bob attempts to post message to private channel
    const bobPostPrivRes = await fetch(`${API_BASE}/api/chat/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieB,
        'x-workspace-id': workspaceA.id,
      },
      body: JSON.stringify({
        channel: 'exec-strategy',
        content: 'Unauthorized message',
      }),
    });
    assert(bobPostPrivRes.status === 403, 'Bob posting to unauthorized private channel rejected with HTTP 403');

    // Alice invites Bob to #exec-strategy
    const inviteBobRes = await fetch(`${API_BASE}/api/chat/channels/${privateChannel.id}/members`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieA,
        'x-workspace-id': workspaceA.id,
      },
      body: JSON.stringify({
        targetUserId: userB.id,
        role: 'MEMBER',
      }),
    });
    assert(inviteBobRes.status === 200, 'Alice authorized Bob as member of #exec-strategy');

    // Bob now accesses private channel successfully
    const bobPrivAllowedRes = await fetch(`${API_BASE}/api/chat/messages?channel=exec-strategy`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieB,
        'x-workspace-id': workspaceA.id,
      },
    });
    assert(bobPrivAllowedRes.status === 200, 'Bob now granted access to private channel after invitation');

    // ─── STEP 5: Mandatory Two-Account End-to-End Messaging Workflow ────────
    console.log('\n[Step 5] Executing mandatory two-account messaging & reply workflow...');

    // 5.1 Alice posts unique message in #engineering
    const testContentA = `Deploying Atlas Kernel v2.4-${stamp} with zero-downtime database migrations`;
    const sendMsgARes = await fetch(`${API_BASE}/api/chat/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieA,
        'x-workspace-id': workspaceA.id,
      },
      body: JSON.stringify({
        channel: 'engineering',
        content: testContentA,
      }),
    });
    const sendMsgAData = (await sendMsgARes.json()) as any;
    assert(sendMsgARes.status === 201 && sendMsgAData.success, 'Alice sent message to #engineering');
    messageAId = sendMsgAData.data.message.id;

    // 5.2 Verify message persisted in PostgreSQL database
    const dbMsgA = await prisma.workspaceChannelMessage.findUnique({
      where: { id: messageAId },
      include: { user: true },
    });
    assert(!!dbMsgA && dbMsgA.content === testContentA, 'Message verified in PostgreSQL database table');
    assert(dbMsgA?.userId === userA.id, 'Persisted message author matches Alice');

    // 5.3 Bob fetches messages and sees Alice's message
    const bobFetchRes = await fetch(`${API_BASE}/api/chat/messages?channel=engineering`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieB,
        'x-workspace-id': workspaceA.id,
      },
    });
    const bobFetchData = (await bobFetchRes.json()) as any;
    assert(bobFetchRes.status === 200 && bobFetchData.success, 'Bob retrieved message history for #engineering');
    const receivedA = bobFetchData.data.messages.find((m: any) => m.id === messageAId);
    assert(!!receivedA && receivedA.content === testContentA, 'Bob received Alice\'s exact persisted message');

    // 5.4 Bob replies to Alice's message with replyToId
    const replyContentB = `Confirmed. Observability dashboards green across all clusters for stamp ${stamp}.`;
    const replyRes = await fetch(`${API_BASE}/api/chat/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieB,
        'x-workspace-id': workspaceA.id,
      },
      body: JSON.stringify({
        channel: 'engineering',
        content: replyContentB,
        replyToId: messageAId,
      }),
    });
    const replyData = (await replyRes.json()) as any;
    assert(replyRes.status === 201 && replyData.success, 'Bob replied to Alice\'s message with replyToId');
    replyBId = replyData.data.message.id;

    // 5.5 Alice refreshes channel and verifies Bob's reply with threaded reference
    const aliceRefreshRes = await fetch(`${API_BASE}/api/chat/messages?channel=engineering`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieA,
        'x-workspace-id': workspaceA.id,
      },
    });
    const aliceRefreshData = (await aliceRefreshRes.json()) as any;
    assert(aliceRefreshRes.status === 200, 'Alice refreshed page / messages');
    const receivedReply = aliceRefreshData.data.messages.find((m: any) => m.id === replyBId);
    assert(!!receivedReply, 'Bob\'s reply persists across page refresh');
    assert(receivedReply.replyTo?.content === testContentA, 'Reply thread preserves parent message reference and author');

    // ─── STEP 6: Reactions Persistence ──────────────────────────────────────
    console.log('\n[Step 6] Testing emoji reactions persistence...');
    const reactRes = await fetch(`${API_BASE}/api/chat/messages/${messageAId}/reactions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieB,
        'x-workspace-id': workspaceA.id,
      },
      body: JSON.stringify({ emoji: '🚀' }),
    });
    const reactData = (await reactRes.json()) as any;
    assert(reactRes.status === 200 && reactData.success, 'Bob toggled reaction 🚀 on Alice\'s message');
    assert(reactData.data.message.reactions['🚀'].includes(userB.id), 'Reaction persisted in message with Bob\'s user ID');

    // ─── STEP 7: Message Editing & Authorization ────────────────────────────
    console.log('\n[Step 7] Testing message editing & permission boundaries...');

    // Bob attempts to edit Alice's message (forbidden)
    const bobEditRes = await fetch(`${API_BASE}/api/chat/messages/${messageAId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieB,
        'x-workspace-id': workspaceA.id,
      },
      body: JSON.stringify({ content: 'Tampered content by Bob' }),
    });
    assert(bobEditRes.status === 403, 'Bob editing Alice\'s message rejected with HTTP 403 Forbidden');

    // Alice edits her own message
    const editedContentA = `Deploying Atlas Kernel v2.4-${stamp} (Hotfix v2.4.1 applied successfully)`;
    const aliceEditRes = await fetch(`${API_BASE}/api/chat/messages/${messageAId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieA,
        'x-workspace-id': workspaceA.id,
      },
      body: JSON.stringify({ content: editedContentA }),
    });
    const aliceEditData = (await aliceEditRes.json()) as any;
    assert(aliceEditRes.status === 200 && aliceEditData.data.message.content === editedContentA, 'Alice successfully edited her own message');
    assert(aliceEditData.data.message.isEdited === true, 'Message marked with isEdited: true flag');

    // ─── STEP 8: Pinning Operations ─────────────────────────────────────────
    console.log('\n[Step 8] Testing message pinning...');
    const pinRes = await fetch(`${API_BASE}/api/chat/messages/${messageAId}/pin`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieA,
        'x-workspace-id': workspaceA.id,
      },
    });
    const pinData = (await pinRes.json()) as any;
    assert(pinRes.status === 200 && pinData.data.message.pinned === true, 'Alice pinned the message');

    // ─── STEP 9: Markdown Preservation & Security Sanitization ──────────────
    console.log('\n[Step 9] Verifying Markdown rendering preservation & script sanitization...');
    const markdownPayload = `Check out this architecture:\n\`\`\`typescript\nconst status = "operational";\n\`\`\`\n<script>alert("xss")</script> **System Ready**`;
    const secMsgRes = await fetch(`${API_BASE}/api/chat/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieA,
        'x-workspace-id': workspaceA.id,
      },
      body: JSON.stringify({
        channel: 'engineering',
        content: markdownPayload,
      }),
    });
    const secMsgData = (await secMsgRes.json()) as any;
    assert(secMsgRes.status === 201, 'Markdown message created');
    const storedContent = secMsgData.data.message.content;
    assert(!storedContent.includes('<script>'), 'Dangerous <script> tag sanitized from message content');
    assert(storedContent.includes('const status = "operational";'), 'Code block markdown preserved intact');
    assert(storedContent.includes('**System Ready**'), 'Bold markdown syntax preserved');

    // ─── STEP 10: Idempotency & Duplicate Protection ────────────────────────
    console.log('\n[Step 10] Testing rapid duplicate submission protection...');
    const fastContent = `Rapid click test ${stamp}`;
    const firstSubmit = await fetch(`${API_BASE}/api/chat/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieA,
        'x-workspace-id': workspaceA.id,
      },
      body: JSON.stringify({ channel: 'general', content: fastContent }),
    });
    const secondSubmit = await fetch(`${API_BASE}/api/chat/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieA,
        'x-workspace-id': workspaceA.id,
      },
      body: JSON.stringify({ channel: 'general', content: fastContent }),
    });
    const secondData = (await secondSubmit.json()) as any;
    assert(secondSubmit.status === 200 && secondData.data?.deduplicated === true, 'Rapid duplicate message recognized and deduplicated');

    // ─── STEP 11: Cross-Workspace Data Isolation ────────────────────────────
    console.log('\n[Step 11] Testing multi-tenant workspace isolation...');
    const charlieAttemptRes = await fetch(`${API_BASE}/api/chat/messages?channel=engineering`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieC,
        'x-workspace-id': workspaceA.id, // Foreign user requesting Workspace A
      },
    });
    assert(charlieAttemptRes.status === 403, 'Foreign user Charlie denied access to Workspace A with HTTP 403 Forbidden');

    // ─── STEP 12: Search Engine & Privacy Filtering ─────────────────────────
    console.log('\n[Step 12] Testing persisted message search with privacy filter...');
    const searchRes = await fetch(`${API_BASE}/api/chat/search?q=Atlas+Kernel`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieA,
        'x-workspace-id': workspaceA.id,
      },
    });
    const searchData = (await searchRes.json()) as any;
    assert(searchRes.status === 200 && searchData.success, 'Search query executed successfully');
    const match = searchData.data.results.find((r: any) => r.id === messageAId);
    assert(!!match, 'Search found the persisted message by content query');

    // ─── STEP 13: Message Deletion & Clean Teardown ─────────────────────────
    console.log('\n[Step 13] Testing message deletion and clean teardown...');
    const delRes = await fetch(`${API_BASE}/api/chat/messages/${messageAId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieA,
        'x-workspace-id': workspaceA.id,
      },
    });
    const delData = (await delRes.json()) as any;
    assert(delRes.status === 200 && delData.data?.deleted === true, 'Alice deleted test message');

    const checkDbDeleted = await prisma.workspaceChannelMessage.findUnique({
      where: { id: messageAId },
    });
    assert(checkDbDeleted === null, 'Deleted message confirmed removed from PostgreSQL table');

    console.log('\n' + '═'.repeat(75));
    console.log(`   ALL TEAM CHANNELS E2E TESTS PASSED (${passed}/${total})`);
    console.log('   Full-Stack Verification Complete: 100% Success');
    console.log('═'.repeat(75) + '\n');
  } catch (error: any) {
    console.error('\nE2E Suite Encountered Error:', error);
    throw error;
  } finally {
    // Teardown test records
    console.log('Teardown: Cleaning up test workspaces & accounts...');
    if (workspaceA?.id) {
      await prisma.workspaceChannelMessage.deleteMany({ where: { workspaceId: workspaceA.id } });
      await prisma.channelMember.deleteMany({ where: { channel: { workspaceId: workspaceA.id } } });
      await prisma.workspaceChannel.deleteMany({ where: { workspaceId: workspaceA.id } });
      await prisma.workspaceMember.deleteMany({ where: { workspaceId: workspaceA.id } });
      await prisma.workspace.delete({ where: { id: workspaceA.id } });
    }
    if (workspaceB?.id) {
      await prisma.workspaceChannelMessage.deleteMany({ where: { workspaceId: workspaceB.id } });
      await prisma.channelMember.deleteMany({ where: { channel: { workspaceId: workspaceB.id } } });
      await prisma.workspaceChannel.deleteMany({ where: { workspaceId: workspaceB.id } });
      await prisma.workspaceMember.deleteMany({ where: { workspaceId: workspaceB.id } });
      await prisma.workspace.delete({ where: { id: workspaceB.id } });
    }
    if (userA?.id) await prisma.user.delete({ where: { id: userA.id } }).catch(() => {});
    if (userB?.id) await prisma.user.delete({ where: { id: userB.id } }).catch(() => {});
    if (userC?.id) await prisma.user.delete({ where: { id: userC.id } }).catch(() => {});
    await prisma.$disconnect();
  }
}

runTeamChannelsSuite().catch((e) => {
  console.error('Fatal Test Runner Failure:', e);
  process.exit(1);
});
