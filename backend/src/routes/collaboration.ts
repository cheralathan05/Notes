import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { hashPassword, verifyPassword } from '../lib/password';
import { prisma } from '../lib/prisma';
import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth';
import { verifyWorkspaceMembership } from '../lib/workspace';
import { verifyDocumentPermission } from '../lib/document-auth';
import { getEmailProvider, buildDocumentInvitationEmail } from '../lib/email';
import { DocumentRole } from '@prisma/client';

const router = Router();

const APP_URL = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

// ─── GET /api/public/documents/:token (Public Document View) ──────────────────
router.get('/public/documents/:token', optionalAuthMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const token = req.params.token as string;
    const providedPassword = req.query.password as string | undefined;

    // Check DocumentPublicLink first
    const link = await prisma.documentPublicLink.findUnique({
      where: { publicToken: token },
      include: {
        document: {
          select: {
            id: true,
            title: true,
            icon: true,
            coverImage: true,
            content: true,
            status: true,
            isFullWidth: true,
            createdAt: true,
            updatedAt: true,
            creator: {
              select: { displayName: true, avatarUrl: true },
            },
          },
        },
      },
    });

    if (link) {
      if (!link.isEnabled || link.revokedAt) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'This public link has been disabled or revoked' },
        });
        return;
      }

      if (link.expiresAt && link.expiresAt < new Date()) {
        res.status(410).json({
          success: false,
          error: { code: 'LINK_EXPIRED', message: 'This public link has expired' },
        });
        return;
      }

      if (link.passwordHash) {
        if (!providedPassword) {
          res.status(401).json({
            success: false,
            error: { code: 'PASSWORD_REQUIRED', message: 'Password required to access this document' },
          });
          return;
        }
        const isValid = await verifyPassword(link.passwordHash, providedPassword);
        if (!isValid) {
          res.status(403).json({
            success: false,
            error: { code: 'INVALID_PASSWORD', message: 'Incorrect document access password' },
          });
          return;
        }
      }

      res.json({
        success: true,
        data: {
          document: link.document,
          permission: link.permission,
          isPublic: true,
        },
      });
      return;
    }

    // Fallback: Check legacy DocumentShare
    const share = await prisma.documentShare.findUnique({
      where: { shareToken: token },
      include: {
        document: {
          select: {
            id: true,
            title: true,
            icon: true,
            coverImage: true,
            content: true,
            status: true,
            isFullWidth: true,
            createdAt: true,
            updatedAt: true,
            creator: {
              select: { displayName: true, avatarUrl: true },
            },
          },
        },
      },
    });

    if (!share || !share.isPublic) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Shared document not found or link has expired' },
      });
      return;
    }

    res.json({
      success: true,
      data: {
        document: share.document,
        permission: share.permission,
        isPublic: true,
      },
    });
  } catch (error) {
    console.error('Public document error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve shared document' },
    });
  }
});

// ─── GET /api/public/invitations/:token (Verify invitation token details) ─────
router.get('/public/invitations/:token', optionalAuthMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const rawToken = req.params.token as string;
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    const invitation = await prisma.documentInvitation.findUnique({
      where: { tokenHash },
      include: {
        document: { select: { id: true, title: true, icon: true } },
        inviter: { select: { id: true, displayName: true, email: true, avatarUrl: true } },
      },
    });

    if (!invitation) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Invitation not found or invalid link' },
      });
      return;
    }

    if (invitation.status === 'REVOKED') {
      res.status(410).json({
        success: false,
        error: { code: 'INVITATION_REVOKED', message: 'This invitation was revoked by the document owner' },
      });
      return;
    }

    if (invitation.status === 'ACCEPTED') {
      res.status(410).json({
        success: false,
        error: { code: 'ALREADY_ACCEPTED', message: 'This invitation has already been accepted' },
      });
      return;
    }

    if (invitation.expiresAt < new Date()) {
      res.status(410).json({
        success: false,
        error: { code: 'INVITATION_EXPIRED', message: 'This invitation has expired' },
      });
      return;
    }

    res.json({
      success: true,
      data: {
        document: invitation.document,
        inviter: invitation.inviter,
        recipientEmail: invitation.recipientEmail,
        role: invitation.role,
        expiresAt: invitation.expiresAt,
        status: invitation.status,
      },
    });
  } catch (error) {
    console.error('Verify invitation error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to verify invitation' },
    });
  }
});

// All following routes require authenticated session
router.use(authMiddleware);

// ─── POST /api/invitations/accept (Accept invitation transactionally) ─────────
router.post('/invitations/accept', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { token } = req.body;

    if (!token || typeof token !== 'string') {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Invitation token is required' },
      });
      return;
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const invitation = await prisma.documentInvitation.findUnique({
      where: { tokenHash },
      include: {
        document: { select: { id: true, title: true, workspaceId: true } },
      },
    });

    if (!invitation) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Invalid or nonexistent invitation token' },
      });
      return;
    }

    if (invitation.status !== 'PENDING') {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_STATUS', message: `Invitation cannot be accepted (Status: ${invitation.status})` },
      });
      return;
    }

    if (invitation.expiresAt < new Date()) {
      res.status(400).json({
        success: false,
        error: { code: 'EXPIRED', message: 'This invitation has expired' },
      });
      return;
    }

    // Verify authenticated user's email matches the invited recipient email
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, emailNormalized: true, displayName: true },
    });

    if (!user) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'User account not found' },
      });
      return;
    }

    const normalizedInvited = invitation.recipientEmail.toLowerCase().trim();
    if (user.emailNormalized !== normalizedInvited && user.email.toLowerCase() !== normalizedInvited) {
      res.status(403).json({
        success: false,
        error: {
          code: 'EMAIL_MISMATCH',
          message: `This invitation was issued to ${invitation.recipientEmail}. You are authenticated as ${user.email}.`,
        },
      });
      return;
    }

    // Atomic transaction: Grant DocumentMembership + Update Invitation status
    await prisma.$transaction([
      prisma.documentMembership.upsert({
        where: {
          documentId_userId: {
            documentId: invitation.documentId,
            userId,
          },
        },
        update: {
          role: invitation.role,
        },
        create: {
          documentId: invitation.documentId,
          userId,
          role: invitation.role,
        },
      }),
      prisma.documentInvitation.update({
        where: { id: invitation.id },
        data: {
          status: 'ACCEPTED',
          acceptedAt: new Date(),
        },
      }),
      prisma.documentActivity.create({
        data: {
          documentId: invitation.documentId,
          userId,
          action: 'ACCEPTED_INVITATION',
          metadata: { role: invitation.role, email: user.email },
        },
      }),
    ]);

    res.json({
      success: true,
      data: {
        documentId: invitation.documentId,
        documentTitle: invitation.document.title,
        role: invitation.role,
        message: 'Invitation accepted successfully',
      },
    });
  } catch (error) {
    console.error('Accept invitation error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to accept invitation' },
    });
  }
});

// ─── GET /api/documents/:id/access (Complete Sharing & Access Control state) ──
router.get('/:id/access', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const documentId = req.params.id as string;

    const authCheck = await verifyDocumentPermission(userId, documentId, 'VIEWER');
    if (!authCheck.allowed) {
      res.status(authCheck.error?.status || 403).json({
        success: false,
        error: authCheck.error || { code: 'FORBIDDEN', message: 'Access denied' },
      });
      return;
    }

    const doc = authCheck.document;

    // 1. Fetch Collaborator Memberships
    const memberships = await prisma.documentMembership.findMany({
      where: { documentId },
      include: {
        user: { select: { id: true, displayName: true, email: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    // 2. Fetch Pending Invitations
    const pendingInvitations = await prisma.documentInvitation.findMany({
      where: {
        documentId,
        status: 'PENDING',
        expiresAt: { gt: new Date() },
      },
      include: {
        inviter: { select: { id: true, displayName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // 3. Fetch Public Link state
    let publicLink = await prisma.documentPublicLink.findUnique({
      where: { documentId },
    });

    // 4. Fetch Publication state
    const publication = await prisma.documentPublication.findFirst({
      where: { documentId },
      orderBy: { createdAt: 'desc' },
    });

    // Ensure creator is present in owners list
    const isOwner = authCheck.isOwner;

    res.json({
      success: true,
      data: {
        currentUserRole: authCheck.role,
        isOwner,
        owner: {
          id: doc.creator.id,
          displayName: doc.creator.displayName,
          email: doc.creator.email,
        },
        members: memberships.map((m) => ({
          id: m.id,
          userId: m.user.id,
          displayName: m.user.displayName,
          email: m.user.email,
          avatarUrl: m.user.avatarUrl,
          role: m.role,
          createdAt: m.createdAt,
        })),
        pendingInvitations: pendingInvitations.map((inv) => ({
          id: inv.id,
          recipientEmail: inv.recipientEmail,
          role: inv.role,
          createdAt: inv.createdAt,
          expiresAt: inv.expiresAt,
          inviterName: inv.inviter.displayName,
        })),
        publicLink: publicLink
          ? {
              isEnabled: publicLink.isEnabled,
              permission: publicLink.permission,
              publicToken: publicLink.publicToken,
              expiresAt: publicLink.expiresAt,
              hasPassword: Boolean(publicLink.passwordHash),
            }
          : {
              isEnabled: false,
              permission: 'VIEW',
              publicToken: null,
              expiresAt: null,
              hasPassword: false,
            },
        publication: {
          status: doc.status,
          isPublished: doc.status === 'PUBLISHED',
          publishedAt: publication?.publishedAt || null,
          version: publication?.version || 1,
        },
      },
    });
  } catch (error) {
    console.error('Get document access error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve access settings' },
    });
  }
});

// ─── POST /api/documents/:id/invitations (Send Email Invitation) ─────────────
router.post('/:id/invitations', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const documentId = req.params.id as string;
    const { recipientEmail, role = 'VIEWER', message } = req.body;

    // Verify owner rights to invite
    const authCheck = await verifyDocumentPermission(userId, documentId, 'OWNER');
    if (!authCheck.allowed) {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Only document owners can invite collaborators' },
      });
      return;
    }

    if (!recipientEmail || typeof recipientEmail !== 'string') {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Valid recipientEmail is required' },
      });
      return;
    }

    const normalizedEmail = recipientEmail.toLowerCase().trim();
    const validRoles: DocumentRole[] = ['VIEWER', 'COMMENTER', 'EDITOR'];
    if (!validRoles.includes(role as DocumentRole)) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_ROLE', message: 'Role must be VIEWER, COMMENTER, or EDITOR' },
      });
      return;
    }

    // Check if recipient is already an active collaborator with this role
    const existingMember = await prisma.documentMembership.findFirst({
      where: {
        documentId,
        user: { emailNormalized: normalizedEmail },
      },
    });

    if (existingMember) {
      res.status(409).json({
        success: false,
        error: { code: 'ALREADY_COLLABORATOR', message: 'User is already an authorized collaborator on this document' },
      });
      return;
    }

    // Generate high-entropy 256-bit cryptographic token
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Revoke any previous pending invitation for this email on this doc
    await prisma.documentInvitation.updateMany({
      where: {
        documentId,
        recipientEmail: normalizedEmail,
        status: 'PENDING',
      },
      data: { status: 'REVOKED', revokedAt: new Date() },
    });

    // Create fresh invitation record
    const invitation = await prisma.documentInvitation.create({
      data: {
        documentId,
        inviterId: userId,
        recipientEmail: normalizedEmail,
        role: role as DocumentRole,
        tokenHash,
        status: 'PENDING',
        message: message ? message.trim() : null,
        expiresAt,
      },
    });

    // Send real invitation email via configured provider
    const inviter = await prisma.user.findUnique({
      where: { id: userId },
      select: { displayName: true },
    });

    const inviteUrl = `${APP_URL}/invite/${rawToken}`;
    const emailProvider = getEmailProvider();
    const emailData = buildDocumentInvitationEmail(
      inviteUrl,
      inviter?.displayName || 'An operator',
      authCheck.document.title,
      role,
      message
    );

    await emailProvider.send({
      to: normalizedEmail,
      ...emailData,
    });

    // Activity log
    await prisma.documentActivity.create({
      data: {
        documentId,
        userId,
        action: 'SENT_INVITATION',
        metadata: { recipientEmail: normalizedEmail, role },
      },
    });

    res.status(201).json({
      success: true,
      data: {
        invitation: {
          id: invitation.id,
          recipientEmail: invitation.recipientEmail,
          role: invitation.role,
          expiresAt: invitation.expiresAt,
          status: invitation.status,
        },
        message: `Invitation successfully dispatched to ${normalizedEmail}`,
      },
    });
  } catch (error) {
    console.error('Send invitation error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to issue invitation' },
    });
  }
});

// ─── POST /api/documents/:id/invitations/:invitationId/resend ─────────────────
router.post('/:id/invitations/:invitationId/resend', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const documentId = req.params.id as string;
    const invitationId = req.params.invitationId as string;

    const authCheck = await verifyDocumentPermission(userId, documentId, 'OWNER');
    if (!authCheck.allowed) {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Only document owners can resend invitations' },
      });
      return;
    }

    const invitation = await prisma.documentInvitation.findUnique({
      where: { id: invitationId },
    });

    if (!invitation || invitation.documentId !== documentId) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Invitation record not found' },
      });
      return;
    }

    // Generate fresh token and reset expiry to 7 days
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const updated = await prisma.documentInvitation.update({
      where: { id: invitationId },
      data: {
        tokenHash,
        status: 'PENDING',
        expiresAt,
        revokedAt: null,
      },
    });

    const inviter = await prisma.user.findUnique({
      where: { id: userId },
      select: { displayName: true },
    });

    const inviteUrl = `${APP_URL}/invite/${rawToken}`;
    const emailProvider = getEmailProvider();
    const emailData = buildDocumentInvitationEmail(
      inviteUrl,
      inviter?.displayName || 'An operator',
      authCheck.document.title,
      updated.role,
      updated.message || undefined
    );

    await emailProvider.send({
      to: updated.recipientEmail,
      ...emailData,
    });

    res.json({
      success: true,
      data: {
        invitation: updated,
        message: 'Invitation resent successfully',
      },
    });
  } catch (error) {
    console.error('Resend invitation error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to resend invitation' },
    });
  }
});

// ─── DELETE /api/documents/:id/invitations/:invitationId (Revoke Invitation) ──
router.delete('/:id/invitations/:invitationId', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const documentId = req.params.id as string;
    const invitationId = req.params.invitationId as string;

    const authCheck = await verifyDocumentPermission(userId, documentId, 'OWNER');
    if (!authCheck.allowed) {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Only document owners can revoke invitations' },
      });
      return;
    }

    const invitation = await prisma.documentInvitation.findUnique({
      where: { id: invitationId },
    });

    if (!invitation || invitation.documentId !== documentId) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Invitation not found' },
      });
      return;
    }

    await prisma.documentInvitation.update({
      where: { id: invitationId },
      data: {
        status: 'REVOKED',
        revokedAt: new Date(),
      },
    });

    res.json({
      success: true,
      data: { message: 'Invitation revoked successfully' },
    });
  } catch (error) {
    console.error('Revoke invitation error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to revoke invitation' },
    });
  }
});

// ─── PATCH /api/documents/:id/collaborators/:userId (Change Collaborator Role) ─
router.patch('/:id/collaborators/:memberUserId', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const documentId = req.params.id as string;
    const memberUserId = req.params.memberUserId as string;
    const { role } = req.body;

    const authCheck = await verifyDocumentPermission(userId, documentId, 'OWNER');
    if (!authCheck.allowed) {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Only document owners can update permissions' },
      });
      return;
    }

    // Prevent modifying the final creator / owner
    if (authCheck.document.creatorId === memberUserId && role !== 'OWNER') {
      res.status(400).json({
        success: false,
        error: { code: 'CANNOT_DEMOTE_OWNER', message: 'Cannot demote the primary document creator' },
      });
      return;
    }

    const validRoles: DocumentRole[] = ['VIEWER', 'COMMENTER', 'EDITOR', 'OWNER'];
    if (!validRoles.includes(role)) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_ROLE', message: 'Role must be VIEWER, COMMENTER, EDITOR, or OWNER' },
      });
      return;
    }

    const membership = await prisma.documentMembership.upsert({
      where: {
        documentId_userId: {
          documentId,
          userId: memberUserId,
        },
      },
      update: { role },
      create: {
        documentId,
        userId: memberUserId,
        role,
      },
    });

    await prisma.documentActivity.create({
      data: {
        documentId,
        userId,
        action: 'UPDATED_PERMISSION',
        metadata: { targetUserId: memberUserId, newRole: role },
      },
    });

    res.json({
      success: true,
      data: { membership, message: 'Collaborator permission updated' },
    });
  } catch (error) {
    console.error('Update collaborator error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to update collaborator permission' },
    });
  }
});

// ─── DELETE /api/documents/:id/collaborators/:userId (Remove Collaborator) ────
router.delete('/:id/collaborators/:memberUserId', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const documentId = req.params.id as string;
    const memberUserId = req.params.memberUserId as string;

    const authCheck = await verifyDocumentPermission(userId, documentId, 'OWNER');
    if (!authCheck.allowed) {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Only document owners can remove collaborators' },
      });
      return;
    }

    if (authCheck.document.creatorId === memberUserId) {
      res.status(400).json({
        success: false,
        error: { code: 'CANNOT_REMOVE_CREATOR', message: 'Cannot remove the primary document creator' },
      });
      return;
    }

    await prisma.documentMembership.deleteMany({
      where: {
        documentId,
        userId: memberUserId,
      },
    });

    await prisma.documentActivity.create({
      data: {
        documentId,
        userId,
        action: 'REMOVED_COLLABORATOR',
        metadata: { targetUserId: memberUserId },
      },
    });

    res.json({
      success: true,
      data: { message: 'Collaborator access revoked successfully' },
    });
  } catch (error) {
    console.error('Remove collaborator error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to remove collaborator' },
    });
  }
});

// ─── POST /api/documents/:id/public-link (Configure Public Link Sharing) ──────
router.post('/:id/public-link', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const documentId = req.params.id as string;
    const { isEnabled, permission = 'VIEW', password, expiresAt } = req.body;

    const authCheck = await verifyDocumentPermission(userId, documentId, 'OWNER');
    if (!authCheck.allowed) {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Only document owners can manage public links' },
      });
      return;
    }

    let publicLink = await prisma.documentPublicLink.findUnique({
      where: { documentId },
    });

    const publicToken = publicLink?.publicToken || crypto.randomBytes(16).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(publicToken).digest('hex');
    const passwordHash = password ? await hashPassword(password) : publicLink?.passwordHash || null;

    if (!publicLink) {
      publicLink = await prisma.documentPublicLink.create({
        data: {
          documentId,
          publicToken,
          tokenHash,
          permission: permission === 'EDIT' ? 'EDIT' : 'VIEW',
          isEnabled: Boolean(isEnabled),
          expiresAt: expiresAt ? new Date(expiresAt) : null,
          passwordHash,
          createdById: userId,
        },
      });
    } else {
      publicLink = await prisma.documentPublicLink.update({
        where: { id: publicLink.id },
        data: {
          isEnabled: isEnabled !== undefined ? Boolean(isEnabled) : publicLink.isEnabled,
          permission: permission === 'EDIT' ? 'EDIT' : 'VIEW',
          expiresAt: expiresAt ? new Date(expiresAt) : publicLink.expiresAt,
          passwordHash,
          revokedAt: isEnabled === false ? new Date() : null,
        },
      });
    }

    // Keep legacy DocumentShare in sync
    try {
      const existingShare = await prisma.documentShare.findFirst({ where: { documentId } });
      if (existingShare) {
        await prisma.documentShare.update({
          where: { id: existingShare.id },
          data: {
            isPublic: publicLink.isEnabled,
            permission: publicLink.permission,
            shareToken: publicLink.publicToken,
          },
        });
      } else {
        await prisma.documentShare.create({
          data: {
            documentId,
            isPublic: publicLink.isEnabled,
            permission: publicLink.permission,
            shareToken: publicLink.publicToken,
          },
        });
      }
    } catch (_err) {
      // Ignored for legacy sync
    }

    res.json({
      success: true,
      data: {
        publicLink: {
          isEnabled: publicLink.isEnabled,
          permission: publicLink.permission,
          publicToken: publicLink.publicToken,
          expiresAt: publicLink.expiresAt,
          hasPassword: Boolean(publicLink.passwordHash),
        },
        message: publicLink.isEnabled ? 'Public link enabled' : 'Public link disabled',
      },
    });
  } catch (error) {
    console.error('Configure public link error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to configure public link' },
    });
  }
});

// ─── POST /api/documents/:id/publish (Publish Document Release) ───────────────
router.post('/:id/publish', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const documentId = req.params.id as string;
    const { title } = req.body;

    const authCheck = await verifyDocumentPermission(userId, documentId, 'OWNER');
    if (!authCheck.allowed) {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Only document owners can publish releases' },
      });
      return;
    }

    const doc = authCheck.document;
    const publishedTitle = title?.trim() || doc.title;

    const [publishedDoc, publication] = await prisma.$transaction([
      prisma.document.update({
        where: { id: documentId },
        data: { status: 'PUBLISHED' },
      }),
      prisma.documentPublication.create({
        data: {
          documentId,
          publisherId: userId,
          status: 'PUBLISHED',
          publishedTitle,
          publishedContent: doc.content as any,
          publishedAt: new Date(),
          version: doc.version,
        },
      }),
      prisma.documentActivity.create({
        data: {
          documentId,
          userId,
          action: 'PUBLISHED_DOCUMENT',
          metadata: { version: doc.version, publishedTitle },
        },
      }),
    ]);

    res.json({
      success: true,
      data: {
        document: publishedDoc,
        publication,
        message: 'Document officially published',
      },
    });
  } catch (error) {
    console.error('Publish document error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to publish document' },
    });
  }
});

// ─── POST /api/documents/:id/unpublish (Unpublish Document to Draft) ──────────
router.post('/:id/unpublish', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const documentId = req.params.id as string;

    const authCheck = await verifyDocumentPermission(userId, documentId, 'OWNER');
    if (!authCheck.allowed) {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Only document owners can unpublish' },
      });
      return;
    }

    const [updatedDoc] = await prisma.$transaction([
      prisma.document.update({
        where: { id: documentId },
        data: { status: 'DRAFT' },
      }),
      prisma.documentPublication.create({
        data: {
          documentId,
          publisherId: userId,
          status: 'DRAFT',
          publishedTitle: authCheck.document.title,
          publishedContent: authCheck.document.content as any,
          unpublishedAt: new Date(),
          version: authCheck.document.version,
        },
      }),
      prisma.documentActivity.create({
        data: {
          documentId,
          userId,
          action: 'UNPUBLISHED_DOCUMENT',
        },
      }),
    ]);

    res.json({
      success: true,
      data: {
        document: updatedDoc,
        message: 'Document returned to draft status',
      },
    });
  } catch (error) {
    console.error('Unpublish error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to unpublish document' },
    });
  }
});

// ─── GET /api/documents/:id/comments (List comments) ─────────────────────────
router.get('/:id/comments', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const documentId = req.params.id as string;

    const authCheck = await verifyDocumentPermission(userId, documentId, 'VIEWER');
    if (!authCheck.allowed) {
      res.status(authCheck.error?.status || 403).json({
        success: false,
        error: authCheck.error || { code: 'FORBIDDEN', message: 'Access denied' },
      });
      return;
    }

    const comments = await prisma.documentComment.findMany({
      where: { documentId, parentId: null },
      orderBy: { createdAt: 'asc' },
      include: {
        author: { select: { id: true, displayName: true, avatarUrl: true } },
        replies: {
          orderBy: { createdAt: 'asc' },
          include: {
            author: { select: { id: true, displayName: true, avatarUrl: true } },
          },
        },
      },
    });

    res.json({
      success: true,
      data: { comments },
    });
  } catch (error) {
    console.error('List comments error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to list comments' },
    });
  }
});

// ─── POST /api/documents/:id/comments (Create comment) ───────────────────────
router.post('/:id/comments', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const documentId = req.params.id as string;
    const { content, selectedText, parentId } = req.body;

    const authCheck = await verifyDocumentPermission(userId, documentId, 'COMMENTER');
    if (!authCheck.allowed) {
      res.status(authCheck.error?.status || 403).json({
        success: false,
        error: authCheck.error || { code: 'FORBIDDEN', message: 'Commenter or Editor permission required' },
      });
      return;
    }

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Comment content cannot be empty' },
      });
      return;
    }

    const comment = await prisma.documentComment.create({
      data: {
        documentId,
        authorId: userId,
        parentId: parentId || null,
        content: content.trim(),
        selectedText: selectedText || null,
      },
      include: {
        author: { select: { id: true, displayName: true, avatarUrl: true } },
      },
    });

    res.status(201).json({
      success: true,
      data: { comment },
    });
  } catch (error) {
    console.error('Create comment error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to create comment' },
    });
  }
});

// ─── GET /api/documents/:id/activity (Audit Timeline) ─────────────────────────
router.get('/:id/activity', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const documentId = req.params.id as string;

    const authCheck = await verifyDocumentPermission(userId, documentId, 'VIEWER');
    if (!authCheck.allowed) {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Access denied' },
      });
      return;
    }

    const activities = await prisma.documentActivity.findMany({
      where: { documentId },
      orderBy: { createdAt: 'desc' },
      take: 30,
      include: {
        user: { select: { id: true, displayName: true, avatarUrl: true } },
      },
    });
