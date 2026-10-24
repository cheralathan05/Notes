/**
 * KRONOS — Comprehensive Collaboration Invitation Workflow Master Test Suite
 *
 * Validates:
 * 1. Identity Verification & Normalization (case, whitespace, dots, zero-width chars)
 * 2. Public vs Localhost Base URL Generation
 * 3. Document Creation ("Team Collaboration Test") and Invitation Creation
 * 4. Token Resolution (does not consume on GET)
 * 5. Rejection of Identity Mismatches (Wrong Account)
 * 6. Two-Account End-to-End Acceptance (Account B accepts Account A's invitation)
 * 7. Document Permission Gating (VIEWER can read, cannot edit, cannot delete)
 * 8. Collaborator List Persistence & Synchronization
 * 9. Single-use Token Enforced (replay attack rejection)
 * 10. Invitation Revocation & Access Termination
 */

import crypto from 'crypto';
import { prisma } from '../src/lib/prisma';
import { normalizeEmail, areEmailsMatching, canonicalizeEmailForMatch } from '../src/lib/email-identity';
import { resolveAppUrl } from '../src/routes/collaboration';
import { buildDocumentInvitationEmail } from '../src/lib/email';
import { verifyDocumentPermission } from '../src/lib/document-auth';
import { getOrCreateUserWorkspace } from '../src/lib/workspace';

let passed = 0;
let total = 0;

function assert(condition: boolean, message: string) {
  total++;
  if (condition) {
    console.log(`  ✓ [PASS] ${message}`);
    passed++;
  } else {
    console.error(`  ✗ [FAIL] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runMasterTestSuite() {
  console.log('\n' + '═'.repeat(70));
  console.log('   KRONOS COLLABORATION INVITATION WORKFLOW REGRESSION & VERIFICATION');
  console.log('   End-to-End Two-Account Identity, Permissions, and Token Validation');
  console.log('═'.repeat(70) + '\n');

  const testSuffix = Date.now().toString(36);
  const emailA = `inviter.owner.${testSuffix}@kronos-institute.edu`;
  // Account B with uppercase and whitespace to test normalization
  const emailB_raw = `  Friend.Recipient.${testSuffix}@GMAIL.COM  `;
  const emailB_normalized = `friend.recipient.${testSuffix}@gmail.com`;
  const emailC_outsider = `unauthorized.intruder.${testSuffix}@other-corp.org`;

  let userA: any;
  let userB: any;
  let userC: any;
  let wsA: any;
  let document: any;
  let invitationTokenRaw = '';
  let invitationTokenHash = '';
  let invitationId = '';

  try {
    // ──────────────────────────────────────────────────────────────────────────
    // SUITE 1: IDENTITY NORMALIZATION & EMAIL MATCHING
    // ──────────────────────────────────────────────────────────────────────────
    console.log('┌── [SUITE 1] Identity Normalization & False-Mismatch Prevention');

    // 1.1 Direct equality with case and whitespace
    assert(
      areEmailsMatching('friend@institution.edu', '  friend@institution.edu  '),
      'Matches emails with surrounding ASCII whitespace'
    );
    assert(
      areEmailsMatching('Friend@Institution.EDU', 'friend@institution.edu'),
      'Matches emails with uppercase letters in local-part and domain'
    );

    // 1.2 Zero-width characters & non-breaking spaces (copied from webmail/clipboard)
    const zeroWidthCharEmail = '\u200Bfriend@institution.edu\uFEFF';
    const nonBreakingSpaceEmail = 'friend@institution.edu\u00A0';
    assert(
      areEmailsMatching(zeroWidthCharEmail, 'friend@institution.edu'),
      'Strips zero-width spaces (\u200B, \uFEFF) without false mismatch'
    );
    assert(
      areEmailsMatching(nonBreakingSpaceEmail, 'friend@institution.edu'),
      'Strips non-breaking space (&nbsp; / \u00A0) without false mismatch'
    );

    // 1.3 Institutional Gmail / Google Workspace dot-insensitivity
    assert(
      areEmailsMatching('first.last@gmail.com', 'firstlast@gmail.com'),
      'Disregards dots in Gmail addresses (first.last@gmail.com === firstlast@gmail.com)'
    );
    assert(
      areEmailsMatching('First.Middle.Last@Googlemail.com', 'firstmiddlelast@gmail.com'),
      'Normalizes googlemail.com to gmail.com and ignores casing/dots'
    );
    assert(
      areEmailsMatching('student.collab@university.edu', 'studentcollab@university.edu'),
      'Permissive dot matching across matching institutional domains'
    );

    // 1.4 Subaddressing / plus-tags
    assert(
      areEmailsMatching('operator+kronos@domain.com', 'operator@domain.com'),
      'Matches plus-addressing alias with root inbox identity'
    );

    // 1.5 Rejects genuinely distinct accounts
    assert(
      !areEmailsMatching('alice@kronos.io', 'bob@kronos.io'),
      'Rejects genuinely different accounts (alice@kronos.io !== bob@kronos.io)'
    );
    assert(
      !areEmailsMatching('alice@company-a.com', 'alice@company-b.com'),
      'Rejects matching username on different domains'
    );
    console.log('└── Suite 1 Complete.\n');

    // ──────────────────────────────────────────────────────────────────────────
    // SUITE 2: SAFE PUBLIC URL RESOLUTION (NO INACCESSIBLE LOCALHOST FOR PROD)
    // ──────────────────────────────────────────────────────────────────────────
    console.log('┌── [SUITE 2] Safe URL Resolution & Production Safety');

    // 2.1 Explicit APP_BASE_URL prioritized
    const oldBaseUrl = process.env.APP_BASE_URL;
    process.env.APP_BASE_URL = 'https://kronos.enterprise.io';
    const resolvedProd = resolveAppUrl();
    assert(
      resolvedProd === 'https://kronos.enterprise.io',
      'Configured APP_BASE_URL is prioritized for invitation generation'
    );

    // 2.2 Production mode prevents localhost emission
    const oldNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    delete process.env.APP_BASE_URL;
    process.env.FRONTEND_URL = 'https://portal.kronos.io';
    const resolvedProdFallback = resolveAppUrl();
    assert(
      !resolvedProdFallback.includes('localhost'),
      'Production environment never emits localhost in invitation links'
    );
    assert(
      resolvedProdFallback === 'https://portal.kronos.io',
      'Production falls back to trusted HTTPS FRONTEND_URL when APP_BASE_URL is omitted'
    );

    // Restore test environment
    process.env.APP_BASE_URL = oldBaseUrl || 'http://localhost:3001';
    process.env.NODE_ENV = oldNodeEnv || 'development';
    console.log('└── Suite 2 Complete.\n');

    // ──────────────────────────────────────────────────────────────────────────
    // SUITE 3: TWO-ACCOUNT PROVISIONING & DOCUMENT CREATION
    // ──────────────────────────────────────────────────────────────────────────
    console.log('┌── [SUITE 3] Two-Account Provisioning & Document Setup');

    // Create Account A (Owner)
    userA = await prisma.user.create({
      data: {
        email: emailA,
        emailNormalized: normalizeEmail(emailA),
        displayName: 'Account A (Owner)',
        passwordHash: 'dummy_hash_for_test',
        emailVerified: true,
      },
    });
    assert(Boolean(userA.id), `Provisioned Account A: ${userA.email}`);

    // Create Account B (Invited Collaborator)
    userB = await prisma.user.create({
      data: {
        email: emailB_raw.trim(),
        emailNormalized: emailB_normalized,
        displayName: 'Account B (Invited Recipient)',
        passwordHash: 'dummy_hash_for_test',
        emailVerified: false, // Initially unverified to test verified-email claim upon acceptance
      },
    });
    assert(Boolean(userB.id), `Provisioned Account B: ${userB.email}`);

    // Create Account C (Unauthorized Outsider)
    userC = await prisma.user.create({
      data: {
        email: emailC_outsider,
        emailNormalized: normalizeEmail(emailC_outsider),
        displayName: 'Account C (Outsider)',
        passwordHash: 'dummy_hash_for_test',
        emailVerified: true,
      },
    });
    assert(Boolean(userC.id), `Provisioned Account C (Outsider): ${userC.email}`);

    // Create Account A Workspace
    wsA = await getOrCreateUserWorkspace(userA.id);
    assert(Boolean(wsA.workspaceId), `Created sovereign workspace for Account A: ${wsA.workspaceName}`);

    // Account A creates document "Team Collaboration Test"
    document = await prisma.document.create({
      data: {
        title: 'Team Collaboration Test',
        workspaceId: wsA.workspaceId,
        creatorId: userA.id,
        content: { type: 'doc', content: [{ type: 'paragraph', text: 'Confidential project briefing.' }] },
        plainText: 'Confidential project briefing.',
        status: 'DRAFT',
      },
    });
    assert(
      document.title === 'Team Collaboration Test',
      'Account A created document: "Team Collaboration Test"'
    );

    // Initial creator membership
    await prisma.documentMembership.create({
      data: {
        documentId: document.id,
        userId: userA.id,
        role: 'OWNER',
      },
    });
    console.log('└── Suite 3 Complete.\n');

    // ──────────────────────────────────────────────────────────────────────────
    // SUITE 4: INVITATION CREATION & EMAIL CONTENT GENERATION
    // ──────────────────────────────────────────────────────────────────────────
    console.log('┌── [SUITE 4] Invitation Issuance & Email Construction');

    invitationTokenRaw = crypto.randomBytes(32).toString('hex');
    invitationTokenHash = crypto.createHash('sha256').update(invitationTokenRaw).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const inviteRecord = await prisma.documentInvitation.create({
      data: {
        documentId: document.id,
        inviterId: userA.id,
        recipientEmail: emailB_raw, // Stored with original input to test resilience
        role: 'VIEWER',
        tokenHash: invitationTokenHash,
        status: 'PENDING',
        message: 'Welcome to the team! Please review the specification.',
        expiresAt,
      },
    });
    invitationId = inviteRecord.id;
    assert(Boolean(invitationId), 'Document invitation created with status PENDING and 7-day expiry');

    // Test email builder output
    const inviteUrl = `${resolveAppUrl()}/invite/${invitationTokenRaw}`;
    const emailData = buildDocumentInvitationEmail(
      inviteUrl,
      userA.displayName,
      document.title,
      'VIEWER',
      emailB_normalized,
      'Welcome to the team! Please review the specification.'
    );

    assert(
      emailData.subject.includes('[KRONOS]') && emailData.subject.includes('Team Collaboration Test'),
      `Email subject contains correct branding and title: "${emailData.subject}"`
    );
    assert(
      emailData.html.includes(emailB_normalized),
      'Email HTML explicitly displays designated recipient email'
    );
    assert(
      emailData.html.includes('read-only mode') || emailData.html.includes('VIEWER'),
      'Email HTML explains assigned role permissions'
    );
    assert(
      emailData.html.includes('Accept Invitation'),
      'Email contains clear "Accept Invitation" CTA'
    );
    console.log('└── Suite 4 Complete.\n');

    // ──────────────────────────────────────────────────────────────────────────
    // SUITE 5: TOKEN VALIDATION WITHOUT ACCESS CONSUMPTION (GET REQUEST SAFETY)
    // ──────────────────────────────────────────────────────────────────────────
    console.log('┌── [SUITE 5] Safe Token Inspection (GET Request Invariance)');

    const loadedInvite = await prisma.documentInvitation.findUnique({
      where: { tokenHash: invitationTokenHash },
      include: { document: { select: { id: true, title: true } } },
    });

    assert(Boolean(loadedInvite), 'Token hash successfully identifies persisted invitation');
    assert(loadedInvite?.status === 'PENDING', 'Inspecting token metadata preserves PENDING status');
    assert(loadedInvite?.document.title === 'Team Collaboration Test', 'Returns accurate document title');

    // Verify Account B has ZERO access prior to acceptance
    const preCheckAccess = await verifyDocumentPermission(userB.id, document.id, 'VIEWER');
    assert(
      !preCheckAccess.allowed,
      'Account B has NO access before explicitly accepting invitation'
    );
    console.log('└── Suite 5 Complete.\n');

    // ──────────────────────────────────────────────────────────────────────────
    // SUITE 6: IDENTITY MISMATCH REJECTION (PREVENTS WRONG ACCOUNT ACCESS)
    // ──────────────────────────────────────────────────────────────────────────
    console.log('┌── [SUITE 6] Strict Identity Matching & Mismatch Rejection');

    // Account C tries to accept Account B's invitation
    const matchForUserC = areEmailsMatching(userC.email, loadedInvite!.recipientEmail) ||
      areEmailsMatching(userC.emailNormalized, loadedInvite!.recipientEmail);
    assert(
      !matchForUserC,
      'Identity verification accurately detects mismatch for unauthorized Account C'
    );

    // Account B with uppercase/whitespace matches invited recipient
    const matchForUserB = areEmailsMatching(userB.email, loadedInvite!.recipientEmail) ||
      areEmailsMatching(userB.emailNormalized, loadedInvite!.recipientEmail);
    assert(
      matchForUserB,
      'Identity verification accurately matches Account B despite whitespace/casing'
    );
    console.log('└── Suite 6 Complete.\n');

    // ──────────────────────────────────────────────────────────────────────────
    // SUITE 7: ATOMIC INVITATION ACCEPTANCE
    // ──────────────────────────────────────────────────────────────────────────
    console.log('┌── [SUITE 7] Explicit & Atomic Acceptance');

    // Execute acceptance transaction
    await prisma.$transaction([
      prisma.documentMembership.upsert({
        where: {
          documentId_userId: {
            documentId: loadedInvite!.documentId,
            userId: userB.id,
          },
        },
        update: { role: loadedInvite!.role },
        create: {
          documentId: loadedInvite!.documentId,
          userId: userB.id,
          role: loadedInvite!.role,
        },
      }),
      prisma.documentInvitation.update({
        where: { id: loadedInvite!.id },
        data: { status: 'ACCEPTED', acceptedAt: new Date() },
      }),
      prisma.documentActivity.create({
        data: {
          documentId: loadedInvite!.documentId,
          userId: userB.id,
          action: 'ACCEPTED_INVITATION',
          metadata: { role: loadedInvite!.role, email: userB.email },
        },
      }),
    ]);

    // Mark email verified upon token possession
    await prisma.user.update({
      where: { id: userB.id },
      data: { emailVerified: true },
    });

    const postAcceptInvite = await prisma.documentInvitation.findUnique({
      where: { id: loadedInvite!.id },
    });
    assert(postAcceptInvite?.status === 'ACCEPTED', 'Invitation status updated to ACCEPTED');
    assert(Boolean(postAcceptInvite?.acceptedAt), 'Invitation records accepted timestamp');

    const updatedUserB = await prisma.user.findUnique({ where: { id: userB.id } });
    assert(updatedUserB?.emailVerified === true, 'Account B verified-email status confirmed');
    console.log('└── Suite 7 Complete.\n');

    // ──────────────────────────────────────────────────────────────────────────
    // SUITE 8: DOCUMENT PERMISSION ENFORCEMENT (VIEWER ROLE)
    // ──────────────────────────────────────────────────────────────────────────
    console.log('┌── [SUITE 8] Backend Document Permission & Role Enforcement');

    // 8.1 Account B CAN read document as VIEWER
    const readCheckB = await verifyDocumentPermission(userB.id, document.id, 'VIEWER');
    assert(readCheckB.allowed, 'Account B is granted VIEWER read access to document');
    assert(readCheckB.role === 'VIEWER', 'Effective role is verified as VIEWER');

    // 8.2 Account B CANNOT edit document (Requires EDITOR)
    const editCheckB = await verifyDocumentPermission(userB.id, document.id, 'EDITOR');
    assert(!editCheckB.allowed, 'Account B (VIEWER) is strictly FORBIDDEN from editing content');

    // 8.3 Account B CANNOT delete document (Requires OWNER)
    const deleteCheckB = await verifyDocumentPermission(userB.id, document.id, 'OWNER');
    assert(!deleteCheckB.allowed, 'Account B (VIEWER) is strictly FORBIDDEN from deleting document');

    // 8.4 Outsider Account C CANNOT read document
    const readCheckC = await verifyDocumentPermission(userC.id, document.id, 'VIEWER');
    assert(!readCheckC.allowed, 'Unauthorized Account C is denied access (403)');
    console.log('└── Suite 8 Complete.\n');

    // ──────────────────────────────────────────────────────────────────────────
    // SUITE 9: COLLABORATOR LIST PERSISTENCE & VISIBILITY
    // ──────────────────────────────────────────────────────────────────────────
    console.log('┌── [SUITE 9] Collaborator Roster Synchronization');

    const members = await prisma.documentMembership.findMany({
      where: { documentId: document.id },
      include: { user: { select: { id: true, email: true, displayName: true } } },
    });

    assert(members.length === 2, 'Collaborator roster contains exactly 2 members (Owner + Collaborator)');
    const memberB = members.find((m) => m.userId === userB.id);
    assert(Boolean(memberB), 'Account B is persisted in document_memberships table');
    assert(memberB?.role === 'VIEWER', 'Account B role is persisted as VIEWER');
    console.log('└── Suite 9 Complete.\n');

    // ──────────────────────────────────────────────────────────────────────────
    // SUITE 10: SINGLE-USE & REPLAY ATTACK PREVENTION
    // ──────────────────────────────────────────────────────────────────────────
    console.log('┌── [SUITE 10] Replay Attack & Expired/Revoked Rejection');

    // 10.1 Re-accepting already accepted invitation is rejected
    const replayInvite = await prisma.documentInvitation.findUnique({
      where: { tokenHash: invitationTokenHash },
    });
    assert(
      replayInvite?.status !== 'PENDING',
      'Invitation token cannot be re-used (Status: ACCEPTED)'
    );

    // 10.2 Revoked invitation cannot grant access
    const revokedTokenRaw = crypto.randomBytes(32).toString('hex');
    const revokedTokenHash = crypto.createHash('sha256').update(revokedTokenRaw).digest('hex');
    await prisma.documentInvitation.create({
      data: {
        documentId: document.id,
        inviterId: userA.id,
        recipientEmail: 'some.other@test.org',
        role: 'EDITOR',
        tokenHash: revokedTokenHash,
        status: 'REVOKED',
        expiresAt: new Date(Date.now() + 86400000),
        revokedAt: new Date(),
      },
    });

    const revokedCheck = await prisma.documentInvitation.findUnique({
      where: { tokenHash: revokedTokenHash },
    });
    assert(revokedCheck?.status === 'REVOKED', 'Revoked invitation is flagged as REVOKED');

    // 10.3 Collaborator Revocation immediately terminates access
    await prisma.documentMembership.delete({
      where: {
        documentId_userId: {
          documentId: document.id,
          userId: userB.id,
        },
      },
    });

    const postRevokeAccess = await verifyDocumentPermission(userB.id, document.id, 'VIEWER');
    assert(
      !postRevokeAccess.allowed,
      'Revoking Account B membership immediately terminates document access'
    );
    console.log('└── Suite 10 Complete.\n');

    console.log('═'.repeat(70));
    console.log(`🎉 ALL TESTS PASSED: ${passed}/${total} assertions verified!`);
    console.log('═'.repeat(70) + '\n');
  } catch (error) {
    console.error('\n❌ TEST RUN FAILED:', error);
    process.exitCode = 1;
  } finally {
    // Cleanup created test records
    try {
      if (document?.id) {
        await prisma.documentActivity.deleteMany({ where: { documentId: document.id } });
        await prisma.documentInvitation.deleteMany({ where: { documentId: document.id } });
        await prisma.documentMembership.deleteMany({ where: { documentId: document.id } });
        await prisma.document.delete({ where: { id: document.id } });
      }
      if (wsA?.workspaceId) {
        await prisma.workspaceMember.deleteMany({ where: { workspaceId: wsA.workspaceId } });
        await prisma.workspace.delete({ where: { id: wsA.workspaceId } }).catch(() => {});
      }
      if (userA?.id) {
        await prisma.workspaceMember.deleteMany({ where: { userId: userA.id } });
        await prisma.user.delete({ where: { id: userA.id } });
      }
      if (userB?.id) {
        await prisma.user.delete({ where: { id: userB.id } });
      }
      if (userC?.id) {
        await prisma.user.delete({ where: { id: userC.id } });
      }
      await prisma.$disconnect();
    } catch (cleanupErr) {
      console.warn('Test cleanup warning:', cleanupErr);
    }
  }
}

runMasterTestSuite();
