import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { hashPassword, verifyPassword } from '../lib/password';
import { prisma } from '../lib/prisma';
import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth';
import { verifyWorkspaceMembership, getOrCreateUserWorkspace } from '../lib/workspace';
import { verifyDocumentPermission } from '../lib/document-auth';
import {
  verifyWorkspaceAuth,
  canInviteRole,
  canUpdateRole,
  canRemoveMember,
  logWorkspaceActivity,
} from '../lib/collaboration-auth';
import {
  getEmailProvider,
  buildDocumentInvitationEmail,
  buildWorkspaceInvitationEmail,
} from '../lib/email';
import { areEmailsMatching, normalizeEmail } from '../lib/email-identity';
import {
  realtimeHub,
  broadcastCollaborationEvent,
} from '../lib/realtime';
import { DocumentRole, WorkspaceRole, Prisma } from '@prisma/client';

const router = Router();
export const resolveAppUrl = (req?: Request): string => {
  const envBaseUrl = (process.env.APP_BASE_URL || process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || '').trim();
  if (envBaseUrl) {
    return envBaseUrl.replace(/\/+$/, '');
  }

  const isProd = process.env.NODE_ENV === 'production';
  const configuredFrontend = (process.env.FRONTEND_URL || '').trim();
  if (isProd) {
    if (configuredFrontend && !configuredFrontend.includes('localhost') && !configuredFrontend.includes('127.0.0.1')) {
      return configuredFrontend.split(',')[0].trim().replace(/\/+$/, '');
    }
    return 'https://app.kronos.workspace';
  }

  if (req) {
    const origin = req.get('origin') || req.get('referer');
    if (origin) {
      try {
        const parsed = new URL(origin);
        if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
          return `${parsed.protocol}//${parsed.host}`;
        }
      } catch {}
    }
  }

  if (configuredFrontend) {
    return configuredFrontend.split(',')[0].trim().replace(/\/+$/, '');
  }

  return 'http://localhost:3001';
};

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
const handleGetInvitationDetails = async (req: Request, res: Response): Promise<void> => {
  try {
    const rawToken = req.params.token as string;
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    // 1. Check WorkspaceInvitation first
    const wsInvite = await prisma.workspaceInvitation.findUnique({
      where: { tokenHash },
      include: {
        workspace: { select: { id: true, name: true, slug: true } },
        inviter: { select: { id: true, displayName: true, email: true, avatarUrl: true } },
      },
    });

    if (wsInvite) {
      if (wsInvite.status === 'REVOKED') {
        res.status(410).json({
          success: false,
          error: { code: 'INVITATION_REVOKED', message: 'This workspace invitation was revoked by an administrator' },
        });
        return;
      }
      if (wsInvite.status === 'ACCEPTED') {
        res.status(410).json({
          success: false,
          error: { code: 'ALREADY_ACCEPTED', message: 'This workspace invitation has already been accepted' },
        });
        return;
      }
      if (wsInvite.expiresAt < new Date()) {
        res.status(410).json({
          success: false,
          error: { code: 'INVITATION_EXPIRED', message: 'This workspace invitation has expired' },
        });
        return;
      }

      res.json({
        success: true,
        data: {
          type: 'WORKSPACE',
          workspace: wsInvite.workspace,
          inviter: wsInvite.inviter,
          recipientEmail: wsInvite.recipientEmail,
          role: wsInvite.role,
          expiresAt: wsInvite.expiresAt,
          status: wsInvite.status,
        },
      });
      return;
    }

    // 2. Check DocumentInvitation
    const docInvite = await prisma.documentInvitation.findUnique({
      where: { tokenHash },
      include: {
        document: { select: { id: true, title: true, icon: true } },
        inviter: { select: { id: true, displayName: true, email: true, avatarUrl: true } },
      },
    });

    if (!docInvite) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Invitation not found or invalid link' },
      });
      return;
    }

    if (docInvite.status === 'REVOKED') {
      res.status(410).json({
        success: false,
        error: { code: 'INVITATION_REVOKED', message: 'This document invitation was revoked by the document owner' },
      });
      return;
    }
    if (docInvite.status === 'ACCEPTED') {
      res.status(410).json({
        success: false,
        error: { code: 'ALREADY_ACCEPTED', message: 'This document invitation has already been accepted' },
      });
      return;
    }
    if (docInvite.expiresAt < new Date()) {
      res.status(410).json({
        success: false,
        error: { code: 'INVITATION_EXPIRED', message: 'This document invitation has expired' },
      });
      return;
    }

    res.json({
      success: true,
      data: {
        type: 'DOCUMENT',
        document: docInvite.document,
        inviter: docInvite.inviter,
        recipientEmail: docInvite.recipientEmail,
        role: docInvite.role,
        expiresAt: docInvite.expiresAt,
        status: docInvite.status,
      },
    });
  } catch (error) {
    console.error('Verify invitation error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to verify invitation' },
    });
  }
};

router.get('/public/invitations/:token', optionalAuthMiddleware, handleGetInvitationDetails);
router.get('/invitations/details/:token', optionalAuthMiddleware, handleGetInvitationDetails);
router.get('/collaboration/invitations/details/:token', optionalAuthMiddleware, handleGetInvitationDetails);
router.get('/invitations/:token', optionalAuthMiddleware, handleGetInvitationDetails);

// All subsequent routes require authenticated user session
router.use(authMiddleware);

// ─── GET /api/collaboration/workspaces (List authorized workspaces for current user) ──
const handleListWorkspaces = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;

    const memberships = await prisma.workspaceMember.findMany({
      where: { userId },
      include: {
        workspace: {
          include: {
            _count: {
              select: {
                members: true,
                tasks: true,
                repositories: true,
                projects: true,
              },
            },
          },
        },
      },
      orderBy: { joinedAt: 'desc' },
    });

    let activeMemberships = memberships;
    if (activeMemberships.length === 0) {
      await getOrCreateUserWorkspace(userId);
      activeMemberships = await prisma.workspaceMember.findMany({
        where: { userId },
        include: {
          workspace: {
            include: {
              _count: {
                select: {
                  members: true,
                  tasks: true,
                  repositories: true,
                  projects: true,
                },
              },
            },
          },
        },
        orderBy: { joinedAt: 'desc' },
      });
    }

    const requestedWsId = (req.headers['x-workspace-id'] as string) || (req.query.workspaceId as string);
    const workspaces = activeMemberships.map((m, index) => ({
      id: m.workspace.id,
      name: m.workspace.name,
      slug: m.workspace.slug,
      description: m.workspace.description,
      role: m.role,
      joinedAt: m.joinedAt,
      isCurrent: requestedWsId ? m.workspace.id === requestedWsId : index === 0,
      memberCount: m.workspace._count.members,
      taskCount: m.workspace._count.tasks,
      repoCount: m.workspace._count.repositories,
      projectCount: m.workspace._count.projects,
    }));

    res.json({
      success: true,
      data: { workspaces },
    });
  } catch (error) {
    console.error('Error listing user workspaces:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to list workspaces' } });
  }
};

// ─── POST /api/collaboration/workspaces (Create a new workspace) ───────────────
const handleCreateWorkspace = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { name, description } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ success: false, error: { code: 'INVALID_INPUT', message: 'Workspace name is required' } });
      return;
    }

    const trimmedName = name.trim();
    const baseSlug = trimmedName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').slice(0, 30);
    const uniqueSlug = `${baseSlug}-${Date.now().toString(36)}`;

    const workspace = await prisma.workspace.create({
      data: {
        name: trimmedName,
        slug: uniqueSlug,
        description: description?.trim() || undefined,
        members: {
          create: {
            userId,
            role: 'OWNER',
          },
        },
      },
    });

    await logWorkspaceActivity({
      workspaceId: workspace.id,
      userId,
      action: 'WORKSPACE_CREATED',
      entityType: 'WORKSPACE',
      entityId: workspace.id,
      metadata: { name: workspace.name },
    });

    res.status(201).json({
      success: true,
      data: {
        workspace: {
          id: workspace.id,
          name: workspace.name,
          slug: workspace.slug,
          description: workspace.description,
          role: 'OWNER',
          memberCount: 1,
        },
      },
    });
  } catch (error) {
    console.error('Error creating workspace:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create workspace' } });
  }
};

const handleUpdateWorkspace = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const workspaceId = req.params.id as string;
    const { name, description } = req.body;

    const authCheck = await verifyWorkspaceAuth(userId, workspaceId, 'ADMIN');
    if (!authCheck.allowed) {
      res.status(authCheck.error?.status || 403).json({
        success: false,
        error: authCheck.error || { code: 'FORBIDDEN', message: 'Only workspace administrators can update workspace settings' },
      });
      return;
    }

    const dataToUpdate: Prisma.WorkspaceUpdateInput = {};
    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim()) {
        res.status(400).json({ success: false, error: { code: 'INVALID_INPUT', message: 'Workspace name cannot be empty' } });
        return;
      }
      dataToUpdate.name = (name as string).trim();
    }
    if (description !== undefined) {
      dataToUpdate.description = typeof description === 'string' ? description.trim() : null;
    }

    const updated = await prisma.workspace.update({
      where: { id: workspaceId },
      data: dataToUpdate,
    });

    await logWorkspaceActivity({
      workspaceId,
      userId,
      action: 'WORKSPACE_UPDATED',
      entityType: 'WORKSPACE',
      entityId: workspaceId,
      metadata: { name: updated.name },
    });

    broadcastCollaborationEvent('WORKSPACE_UPDATED', workspaceId, {
      id: updated.id,
      name: updated.name,
      description: updated.description,
    });

    res.json({
      success: true,
      data: {
        workspace: {
          id: updated.id,
          name: updated.name,
          slug: updated.slug,
          description: updated.description,
          role: authCheck.role,
        },
      },
    });
  } catch (error) {
    console.error('Error updating workspace:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update workspace' } });
  }
};

router.get('/workspaces', handleListWorkspaces);
router.get('/collaboration/workspaces', handleListWorkspaces);
router.post('/workspaces', handleCreateWorkspace);
router.post('/collaboration/workspaces', handleCreateWorkspace);
router.patch('/workspaces/:id', handleUpdateWorkspace);
router.patch('/collaboration/workspaces/:id', handleUpdateWorkspace);
router.put('/workspaces/:id', handleUpdateWorkspace);
router.put('/collaboration/workspaces/:id', handleUpdateWorkspace);

// ─── POST /api/invitations/accept (Accept Workspace or Document Invitation) ──
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

    const tokenHash = crypto.createHash('sha256').update(token.trim()).digest('hex');

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, emailNormalized: true, displayName: true, emailVerified: true },
    });

    if (!user) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'User account not found' },
      });
      return;
    }

    // 1. Try accepting WorkspaceInvitation
    const wsInvite = await prisma.workspaceInvitation.findUnique({
      where: { tokenHash },
      include: {
        workspace: { select: { id: true, name: true } },
      },
    });

    if (wsInvite) {
      if (wsInvite.status !== 'PENDING') {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_STATUS', message: `Invitation cannot be accepted (Status: ${wsInvite.status})` },
        });
        return;
      }

      if (wsInvite.expiresAt < new Date()) {
        res.status(400).json({
          success: false,
          error: { code: 'EXPIRED', message: 'This workspace invitation has expired' },
        });
        return;
      }

      const matchesWs = areEmailsMatching(user.email, wsInvite.recipientEmail) ||
        areEmailsMatching(user.emailNormalized, wsInvite.recipientEmail);
      if (!matchesWs) {
        res.status(403).json({
          success: false,
          error: {
            code: 'EMAIL_MISMATCH',
            message: `This invitation was issued to ${wsInvite.recipientEmail}. You are authenticated as ${user.email}.`,
          },
        });
        return;
      }

      // Execute transaction: create WorkspaceMember + mark invitation ACCEPTED + log activity
      await prisma.$transaction(async (tx) => {
        await tx.workspaceMember.upsert({
          where: {
            workspaceId_userId: {
              workspaceId: wsInvite.workspaceId,
              userId,
            },
          },
          update: {
            role: wsInvite.role,
            joinedAt: new Date(),
          },
          create: {
            workspaceId: wsInvite.workspaceId,
            userId,
            role: wsInvite.role,
            joinedAt: new Date(),
          },
        });

        await tx.workspaceInvitation.update({
          where: { id: wsInvite.id },
          data: {
            status: 'ACCEPTED',
            acceptedAt: new Date(),
          },
        });

        await logWorkspaceActivity({
          workspaceId: wsInvite.workspaceId,
          userId,
          action: 'MEMBER_JOINED',
          entityType: 'MEMBER',
          entityId: userId,
          metadata: { email: user.email, role: wsInvite.role },
          tx,
        });

        // Notify inviter
        await tx.notification.create({
          data: {
            workspaceId: wsInvite.workspaceId,
            recipientId: wsInvite.inviterId,
            actorId: userId,
            type: 'MEMBER_JOINED',
            title: 'New Member Joined Workspace',
            message: `${user.displayName} (${user.email}) accepted your invitation to join ${wsInvite.workspace.name} as ${wsInvite.role}.`,
            linkUrl: '/collaboration',
          },
        });
      });

      broadcastCollaborationEvent('MEMBER_JOINED', wsInvite.workspaceId, {
        userId,
        displayName: user.displayName,
        role: wsInvite.role,
      });

      res.json({
        success: true,
        data: {
          type: 'WORKSPACE',
          workspaceId: wsInvite.workspaceId,
          workspaceName: wsInvite.workspace.name,
          role: wsInvite.role,
          redirectUrl: '/collaboration',
          message: `Successfully joined ${wsInvite.workspace.name} as ${wsInvite.role}`,
        },
      });
      return;
    }

    // 2. Try accepting DocumentInvitation
    const docInvite = await prisma.documentInvitation.findUnique({
      where: { tokenHash },
      include: {
        document: { select: { id: true, title: true, workspaceId: true, creatorId: true } },
      },
    });

    if (!docInvite) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Invalid or nonexistent invitation token' },
      });
      return;
    }

    if (docInvite.status !== 'PENDING') {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_STATUS', message: `Invitation cannot be accepted (Status: ${docInvite.status})` },
      });
      return;
    }

    if (docInvite.expiresAt < new Date()) {
      res.status(400).json({
        success: false,
        error: { code: 'EXPIRED', message: 'This document invitation has expired' },
      });
      return;
    }

    const matchesDoc = areEmailsMatching(user.email, docInvite.recipientEmail) ||
      areEmailsMatching(user.emailNormalized, docInvite.recipientEmail);
    if (!matchesDoc) {
      res.status(403).json({
        success: false,
        error: {
          code: 'EMAIL_MISMATCH',
          message: `This invitation was issued to ${docInvite.recipientEmail}. You are authenticated as ${user.email}.`,
        },
      });
      return;
    }

    // If creator accepts own invite, maintain sovereign OWNER
    if (docInvite.document.creatorId === userId) {
      await prisma.documentInvitation.update({
        where: { id: docInvite.id },
        data: { status: 'ACCEPTED', acceptedAt: new Date() },
      });
      res.json({
        success: true,
        data: {
          type: 'DOCUMENT',
          documentId: docInvite.documentId,
          documentTitle: docInvite.document.title,
          role: 'OWNER',
          redirectUrl: `/documents/${docInvite.documentId}`,
          message: 'You are the primary creator and retain sovereign OWNER access.',
        },
      });
      return;
    }

    await prisma.$transaction([
      prisma.documentMembership.upsert({
        where: {
          documentId_userId: {
            documentId: docInvite.documentId,
            userId,
          },
        },
        update: {
          role: docInvite.role,
        },
        create: {
          documentId: docInvite.documentId,
          userId,
          role: docInvite.role,
        },
      }),
      prisma.documentInvitation.update({
        where: { id: docInvite.id },
        data: {
          status: 'ACCEPTED',
          acceptedAt: new Date(),
        },
      }),
      prisma.documentActivity.create({
        data: {
          documentId: docInvite.documentId,
          userId,
          action: 'ACCEPTED_INVITATION',
          metadata: { role: docInvite.role, email: user.email },
        },
      }),
    ]);

      if (!user.emailVerified) {
        await prisma.user.update({
          where: { id: userId },
          data: { emailVerified: true },
        });
      }

      res.json({
        success: true,
        data: {
          type: 'DOCUMENT',
          documentId: docInvite.documentId,
          documentTitle: docInvite.document.title,
          role: docInvite.role,
          redirectUrl: `/documents/${docInvite.documentId}`,
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

// ─── GET /api/collaboration/overview (Dashboard Summary Metrics & Activity) ──
const handleOverview = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const requestedWorkspaceId = (req.query.workspaceId as string | undefined) || (req.headers['x-workspace-id'] as string | undefined);

    let workspaceContext;
    if (requestedWorkspaceId) {
      const authCheck = await verifyWorkspaceAuth(userId, requestedWorkspaceId, 'VIEWER');
      if (!authCheck.allowed) {
        res.status(authCheck.error?.status || 403).json({
          success: false,
          error: authCheck.error || { code: 'FORBIDDEN', message: 'Access denied' },
        });
        return;
      }
      workspaceContext = {
        workspaceId: requestedWorkspaceId,
        role: authCheck.role!,
        workspaceName: authCheck.workspace!.name,
      };
    } else {
      workspaceContext = await getOrCreateUserWorkspace(userId);
    }

    const { workspaceId, role: currentUserRole } = workspaceContext;

    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        createdAt: true,
      },
    });

    if (!workspace) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Workspace not found' },
      });
      return;
    }

    // 1. Calculate Real Metric: Active Members
    const activeMembersCount = await prisma.workspaceMember.count({
      where: { workspaceId },
    });

    // 2. Calculate Real Metric: Pending Invitations
    const pendingInvitationsCount = await prisma.workspaceInvitation.count({
      where: {
        workspaceId,
        status: 'PENDING',
        expiresAt: { gt: new Date() },
      },
    });

    // 3. Calculate Real Metric: Shared Documents in this Workspace
    const sharedDocumentsCount = await prisma.document.count({
      where: {
        workspaceId,
        isDeleted: false,
        OR: [
          { memberships: { some: {} } },
          { publicLink: { isEnabled: true } },
          { status: 'PUBLISHED' },
        ],
      },
    });

    // 4. Calculate Real Metric: Recent Activities
    const totalActivitiesCount = await prisma.workspaceActivity.count({
      where: { workspaceId },
    });

    // 5. Calculate Real Metric: Projects and Tasks in this Workspace
    const [projectCount, taskCount] = await Promise.all([
      prisma.project.count({ where: { workspaceId, isArchived: false } }),
      prisma.task.count({ where: { workspaceId, isArchived: false } }),
    ]);

    // 6. Fetch Recent Activities with Author Details
    const recentActivities = await prisma.workspaceActivity.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
    });

    // 7. Fetch Active Realtime Collaborators
    const onlineCollaborators = realtimeHub.getActiveCollaborators(workspaceId);

    // 8. Fetch all workspaces available to this user for the workspace switcher
    const userWorkspaces = await prisma.workspaceMember.findMany({
      where: { userId },
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
      orderBy: { joinedAt: 'asc' },
    });

    res.json({
      success: true,
      data: {
        workspace,
        currentUserRole,
        availableWorkspaces: userWorkspaces.map((m) => ({
          id: m.workspace.id,
          name: m.workspace.name,
          slug: m.workspace.slug,
          role: m.role,
        })),
        metrics: {
          activeMembers: activeMembersCount,
          memberCount: activeMembersCount,
          pendingInvitations: pendingInvitationsCount,
          invitationCount: pendingInvitationsCount,
          sharedDocuments: sharedDocumentsCount,
          documentCount: sharedDocumentsCount,
          recentActivities: totalActivitiesCount,
          activityCount: totalActivitiesCount,
          projectCount,
          taskCount,
        },
        recentActivities: recentActivities.map((a) => ({
          id: a.id,
          action: a.action,
          entityType: a.entityType,
          entityId: a.entityId,
          metadata: a.metadata,
          createdAt: a.createdAt,
          user: a.user,
        })),
        onlineCollaborators,
      },
    });
  } catch (error) {
    console.error('Collaboration overview error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve collaboration overview' },
    });
  }
};

router.get('/overview', handleOverview);
router.get('/collaboration/overview', handleOverview);

// ─── GET /api/collaboration/members (Search, Filter, Paginate Members) ────────
const handleListMembers = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const rawRequested = req.params.id || (req.query.workspaceId as string | undefined) || (req.headers['x-workspace-id'] as string | undefined);
    const requestedWorkspaceId = Array.isArray(rawRequested) ? rawRequested[0] : rawRequested;

    let workspaceId: string;
    if (!requestedWorkspaceId) {
      const ws = await getOrCreateUserWorkspace(userId);
      workspaceId = ws.workspaceId;
    } else {
      workspaceId = requestedWorkspaceId;
    }

    const authCheck = await verifyWorkspaceAuth(userId, workspaceId, 'VIEWER');
    if (!authCheck.allowed) {
      res.status(authCheck.error?.status || 403).json({
        success: false,
        error: authCheck.error || { code: 'FORBIDDEN', message: 'Access denied' },
      });
      return;
    }

    const search = (req.query.search as string | undefined)?.trim();
    const roleFilter = req.query.role as WorkspaceRole | undefined;
    const page = Math.max(1, parseInt((req.query.page as string) || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) || '20', 10)));
    const skip = (page - 1) * limit;

    const whereClause: Prisma.WorkspaceMemberWhereInput = {
      workspaceId,
      ...(roleFilter ? { role: roleFilter } : {}),
      ...(search
        ? {
            user: {
              OR: [
                { displayName: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
              ],
            },
          }
        : {}),
    };

    const [totalCount, members] = await Promise.all([
      prisma.workspaceMember.count({ where: whereClause }),
      prisma.workspaceMember.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
        include: {
          user: {
            select: {
              id: true,
              displayName: true,
              email: true,
              avatarUrl: true,
              createdAt: true,
              sessions: {
                take: 1,
                orderBy: { lastActivityAt: 'desc' },
                select: { lastActivityAt: true },
              },
            },
          },
        },
      }),
    ]);

    const activeOnlineUsers = new Set(
      realtimeHub.getActiveCollaborators(workspaceId).map((c) => c.userId)
    );

    const userIds = members.map((m) => m.user.id);
    const memberTasks = userIds.length > 0
      ? await prisma.task.groupBy({
          by: ['assigneeId', 'status'],
          where: {
            workspaceId,
            assigneeId: { in: userIds },
            isArchived: false,
          },
          _count: {
            _all: true,
          },
        })
      : [];

    const taskSummaryMap = new Map<string, { totalAssigned: number; completed: number; active: number }>();
    userIds.forEach((uid) => taskSummaryMap.set(uid, { totalAssigned: 0, completed: 0, active: 0 }));

    memberTasks.forEach((group: any) => {
      if (group.assigneeId && taskSummaryMap.has(group.assigneeId)) {
        const summary = taskSummaryMap.get(group.assigneeId)!;
        const count = Number(group._count?._all ?? group._count?.id ?? 0);
        summary.totalAssigned += count;
        if (group.status === 'DONE') {
          summary.completed += count;
        } else {
          summary.active += count;
        }
      }
    });

    res.json({
      success: true,
      data: {
        members: members.map((m) => ({
          id: m.id,
          userId: m.user.id,
          workspaceId: m.workspaceId,
          displayName: m.user.displayName,
          email: m.user.email,
          avatarUrl: m.user.avatarUrl,
          role: m.role,
          joinedAt: m.joinedAt,
          isOnline: activeOnlineUsers.has(m.user.id),
          lastActiveAt: m.user.sessions[0]?.lastActivityAt || m.joinedAt,
          assignedWork: taskSummaryMap.get(m.user.id) || { totalAssigned: 0, completed: 0, active: 0 },
          user: {
            id: m.user.id,
            displayName: m.user.displayName,
            email: m.user.email,
            avatarUrl: m.user.avatarUrl,
          },
        })),
        pagination: {
          page,
          limit,
          totalCount,
          totalPages: Math.ceil(totalCount / limit),
        },
      },
    });
  } catch (error) {
    console.error('List members error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve workspace members' },
    });
  }
};

router.get('/members', handleListMembers);
router.get('/collaboration/members', handleListMembers);
router.get('/workspaces/:id/members', handleListMembers);
router.get('/collaboration/workspaces/:id/members', handleListMembers);

// ─── POST /api/collaboration/invitations (Issue Workspace Invitation) ─────────
const handleCreateWorkspaceInvitation = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { workspaceId: inputWsId, recipientEmail, role = 'MEMBER', message } = req.body;

    let workspaceId = inputWsId || req.params.id || (req.headers['x-workspace-id'] as string);
    if (!workspaceId) {
      const ws = await getOrCreateUserWorkspace(userId);
      workspaceId = ws.workspaceId;
    }

    // Verify inviter has ADMIN or OWNER privileges
    const authCheck = await verifyWorkspaceAuth(userId, workspaceId, 'ADMIN');
    if (!authCheck.allowed) {
      res.status(authCheck.error?.status || 403).json({
        success: false,
        error: authCheck.error || { code: 'FORBIDDEN', message: 'Only workspace administrators can invite members' },
      });
      return;
    }

    if (!recipientEmail || typeof recipientEmail !== 'string' || !recipientEmail.includes('@')) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'A valid email address is required' },
      });
      return;
    }

    const normalizedEmail = recipientEmail.toLowerCase().trim();
    const validRoles: WorkspaceRole[] = ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'];
    if (!validRoles.includes(role as WorkspaceRole)) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_ROLE', message: 'Valid role required: OWNER, ADMIN, MEMBER, or VIEWER' },
      });
      return;
    }

    // Role escalation check: ADMIN cannot invite OWNER or ADMIN
    if (!canInviteRole(authCheck.role!, role as WorkspaceRole)) {
      res.status(403).json({
        success: false,
        error: {
          code: 'ROLE_ESCALATION_FORBIDDEN',
          message: `Your current role (${authCheck.role}) cannot grant ${role} privileges`,
        },
      });
      return;
    }

    // Check if recipient is already an active member of this workspace
    const existingMember = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId,
        user: { emailNormalized: normalizedEmail },
      },
    });

    if (existingMember) {
      res.status(409).json({
        success: false,
        error: {
          code: 'ALREADY_MEMBER',
          message: `User is already an active ${existingMember.role} of this workspace.`,
        },
      });
      return;
    }

    // Generate high-entropy 256-bit token
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Revoke any pending invitations for this email in this workspace
    await prisma.workspaceInvitation.updateMany({
      where: {
        workspaceId,
        recipientEmail: normalizedEmail,
        status: 'PENDING',
      },
      data: {
        status: 'REVOKED',
        revokedAt: new Date(),
      },
    });

    // Create fresh invitation record
    const invitation = await prisma.workspaceInvitation.create({
      data: {
        workspaceId,
        inviterId: userId,
        recipientEmail: normalizedEmail,
        role: role as WorkspaceRole,
        tokenHash,
        status: 'PENDING',
        message: message ? message.trim() : null,
        expiresAt,
      },
    });

    // Log activity
    await logWorkspaceActivity({
      workspaceId,
      userId,
      action: 'INVITATION_SENT',
      entityType: 'INVITATION',
      entityId: invitation.id,
      metadata: { recipientEmail: normalizedEmail, role },
    });

    // Dispatch real email via configured Nodemailer transport
    const inviter = await prisma.user.findUnique({
      where: { id: userId },
      select: { displayName: true },
    });

    const inviteUrl = `${resolveAppUrl(req)}/invite/${rawToken}`;
    const emailProvider = getEmailProvider();
    const emailData = buildWorkspaceInvitationEmail(
      inviteUrl,
      inviter?.displayName || 'A workspace administrator',
      authCheck.workspace?.name || 'Workspace',
      role,
      message
    );

    let emailSent = false;
    let emailErrorMessage: string | null = null;

    try {
      await emailProvider.send({
        to: normalizedEmail,
        ...emailData,
      });
      emailSent = true;
    } catch (mailError: any) {
      console.warn('⚠️ Workspace invitation email delivery warning:', mailError?.message || mailError);
      emailErrorMessage = mailError?.message || 'SMTP delivery issue';
    }

    broadcastCollaborationEvent('INVITATION_CREATED', workspaceId, {
      id: invitation.id,
      recipientEmail: invitation.recipientEmail,
      role: invitation.role,
    });

    res.status(201).json({
      success: true,
      data: {
        invitation: {
          id: invitation.id,
          workspaceId: invitation.workspaceId,
          inviterId: invitation.inviterId,
          recipientEmail: invitation.recipientEmail,
          role: invitation.role,
          expiresAt: invitation.expiresAt,
          status: invitation.status,
          inviteUrl,
          rawToken,
        },
        inviteUrl,
        emailSent,
        message: emailSent
          ? `Invitation dispatched to ${normalizedEmail}`
          : `Invitation registered in database. Email delivery note: ${emailErrorMessage || 'Check SMTP credentials in .env'}. Direct link: ${inviteUrl}`,
      },
    });
  } catch (error) {
    console.error('Create workspace invitation error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to issue workspace invitation' },
    });
  }
};

router.post('/invitations', handleCreateWorkspaceInvitation);
router.post('/collaboration/invitations', handleCreateWorkspaceInvitation);
router.post('/workspaces/:id/invitations', handleCreateWorkspaceInvitation);
router.post('/collaboration/workspaces/:id/invitations', handleCreateWorkspaceInvitation);

// ─── GET /api/collaboration/invitations (List Pending Workspace Invitations) ──
const handleListInvitations = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const requestedWorkspaceId = (req.query.workspaceId as string | undefined) || (req.headers['x-workspace-id'] as string | undefined);

    let workspaceId = requestedWorkspaceId;
    if (!workspaceId) {
      const ws = await getOrCreateUserWorkspace(userId);
      workspaceId = ws.workspaceId;
    }

    const authCheck = await verifyWorkspaceAuth(userId, workspaceId, 'ADMIN');
    if (!authCheck.allowed) {
      res.status(authCheck.error?.status || 403).json({
        success: false,
        error: authCheck.error || { code: 'FORBIDDEN', message: 'Access denied' },
      });
      return;
    }

    const invitations = await prisma.workspaceInvitation.findMany({
      where: {
        workspaceId,
        status: 'PENDING',
        expiresAt: { gt: new Date() },
      },
      include: {
        inviter: {
          select: { id: true, displayName: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      data: {
        invitations: invitations.map((inv) => ({
          id: inv.id,
          workspaceId: inv.workspaceId,
          inviterId: inv.inviterId,
          recipientEmail: inv.recipientEmail,
          role: inv.role,
          status: inv.status,
          message: inv.message,
          expiresAt: inv.expiresAt,
          createdAt: inv.createdAt,
          inviter: inv.inviter,
        })),
      },
    });
  } catch (error) {
    console.error('List invitations error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to list pending invitations' },
    });
  }
};

router.get('/invitations/pending', handleListInvitations);
router.get('/collaboration/invitations/pending', handleListInvitations);

// ─── POST /api/collaboration/invitations/:id/resend (Resend Workspace Invite) ─
const handleResendInvitation = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const invitationId = req.params.id as string;

    const invitation = await prisma.workspaceInvitation.findUnique({
      where: { id: invitationId },
      include: { workspace: { select: { id: true, name: true } } },
    });

    if (!invitation) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Invitation record not found' },
      });
      return;
    }

    const authCheck = await verifyWorkspaceAuth(userId, invitation.workspaceId, 'ADMIN');
    if (!authCheck.allowed) {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Only administrators can resend invitations' },
      });
      return;
    }

    // Refresh token and update expiration to +7 days
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const updated = await prisma.workspaceInvitation.update({
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

    const inviteUrl = `${resolveAppUrl(req)}/invite/${rawToken}`;
    const emailProvider = getEmailProvider();
    const emailData = buildWorkspaceInvitationEmail(
      inviteUrl,
      inviter?.displayName || 'A workspace administrator',
      invitation.workspace.name,
      updated.role,
      updated.message || undefined
    );

    let emailSent = false;
    let emailErrorMessage: string | null = null;
    try {
      await emailProvider.send({
        to: updated.recipientEmail,
        ...emailData,
      });
      emailSent = true;
    } catch (err: any) {
      console.warn('⚠️ Resend email warning:', err?.message || err);
      emailErrorMessage = err?.message || 'SMTP delivery issue';
    }

    await logWorkspaceActivity({
      workspaceId: invitation.workspaceId,
      userId,
      action: 'INVITATION_RESENT',
      entityType: 'INVITATION',
      entityId: invitation.id,
      metadata: { recipientEmail: updated.recipientEmail },
    });

    res.json({
      success: true,
      data: {
        invitation: updated,
        emailSent,
        inviteUrl,
        message: emailSent
          ? `Invitation resent to ${updated.recipientEmail}`
          : `Token refreshed. Email status: ${emailErrorMessage}. Direct link: ${inviteUrl}`,
      },
    });
  } catch (error) {
    console.error('Resend invitation error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to resend invitation' },
    });
  }
};

router.post('/invitations/:id/resend', handleResendInvitation);
router.post('/collaboration/invitations/:id/resend', handleResendInvitation);

// ─── DELETE /api/collaboration/invitations/:id (Revoke Workspace Invite) ──────
const handleRevokeInvitation = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const invitationId = req.params.id as string;

    const invitation = await prisma.workspaceInvitation.findUnique({
      where: { id: invitationId },
    });

    if (!invitation) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Invitation record not found' },
      });
      return;
    }

    const authCheck = await verifyWorkspaceAuth(userId, invitation.workspaceId, 'ADMIN');
    if (!authCheck.allowed) {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Only administrators can revoke invitations' },
      });
      return;
    }

    await prisma.workspaceInvitation.update({
      where: { id: invitationId },
      data: {
        status: 'REVOKED',
        revokedAt: new Date(),
      },
    });

    await logWorkspaceActivity({
      workspaceId: invitation.workspaceId,
      userId,
      action: 'INVITATION_REVOKED',
      entityType: 'INVITATION',
      entityId: invitation.id,
      metadata: { recipientEmail: invitation.recipientEmail },
    });

    broadcastCollaborationEvent('INVITATION_REVOKED', invitation.workspaceId, {
      id: invitation.id,
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
};

router.delete('/invitations/:id', handleRevokeInvitation);
router.delete('/collaboration/invitations/:id', handleRevokeInvitation);

// ─── PATCH /api/collaboration/members/:memberId/role (Change Workspace Role) ──
const handleUpdateMemberRole = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const memberId = req.params.memberId as string;
    const { role: newRole } = req.body;

    const validRoles: WorkspaceRole[] = ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'];
    if (!validRoles.includes(newRole)) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_ROLE', message: 'Role must be OWNER, ADMIN, MEMBER, or VIEWER' },
      });
      return;
    }

    // Locate target member
    const targetMember = await prisma.workspaceMember.findUnique({
      where: { id: memberId },
      include: {
        user: { select: { id: true, displayName: true, email: true } },
      },
    });

    if (!targetMember) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Workspace member record not found' },
      });
      return;
    }

    const authCheck = await verifyWorkspaceAuth(userId, targetMember.workspaceId, 'ADMIN');
    if (!authCheck.allowed) {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Only workspace administrators can update member roles' },
      });
      return;
    }

    const isSelf = targetMember.userId === userId;
    if (!canUpdateRole(authCheck.role!, targetMember.role, newRole, isSelf)) {
      res.status(403).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED_ROLE_CHANGE',
          message: isSelf
            ? 'You cannot modify your own workspace role'
            : `Your current role (${authCheck.role}) cannot change a ${targetMember.role} to ${newRole}`,
        },
      });
      return;
    }

    // Prevent demoting sole owner
    if (targetMember.role === 'OWNER' && newRole !== 'OWNER') {
      const ownerCount = await prisma.workspaceMember.count({
        where: { workspaceId: targetMember.workspaceId, role: 'OWNER' },
      });
      if (ownerCount <= 1) {
        res.status(400).json({
          success: false,
          error: {
            code: 'SOLE_OWNER_DEMOTION',
            message: 'Cannot demote the sole workspace owner. Promote another member to OWNER first.',
          },
        });
        return;
      }
    }

    const updated = await prisma.workspaceMember.update({
      where: { id: memberId },
      data: { role: newRole },
      include: {
        user: { select: { id: true, displayName: true, email: true, avatarUrl: true } },
      },
    });

    await logWorkspaceActivity({
      workspaceId: targetMember.workspaceId,
      userId,
      action: 'ROLE_CHANGED',
      entityType: 'MEMBER',
      entityId: targetMember.userId,
      metadata: {
        targetUserId: targetMember.userId,
        targetEmail: targetMember.user.email,
        oldRole: targetMember.role,
        newRole,
      },
    });

    // Send notification to the member
    await prisma.notification.create({
      data: {
        workspaceId: targetMember.workspaceId,
        recipientId: targetMember.userId,
        actorId: userId,
        type: 'SYSTEM',
        title: 'Workspace Role Updated',
        message: `Your role in this workspace was updated to ${newRole}.`,
        linkUrl: '/collaboration',
      },
    });

    broadcastCollaborationEvent('MEMBER_ROLE_UPDATED', targetMember.workspaceId, {
      memberId: updated.id,
      userId: updated.userId,
      role: updated.role,
    });

    res.json({
      success: true,
      data: {
        member: {
          id: updated.id,
          userId: updated.userId,
          displayName: updated.user.displayName,
          email: updated.user.email,
          avatarUrl: updated.user.avatarUrl,
          role: updated.role,
          joinedAt: updated.joinedAt,
        },
        message: `Member role successfully updated to ${newRole}`,
      },
    });
  } catch (error) {
    console.error('Update member role error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to update member role' },
    });
  }
};

router.patch('/members/:memberId/role', handleUpdateMemberRole);
router.patch('/collaboration/members/:memberId/role', handleUpdateMemberRole);
router.put('/members/:memberId/role', handleUpdateMemberRole);
router.put('/collaboration/members/:memberId/role', handleUpdateMemberRole);

// ─── DELETE /api/collaboration/members/:memberId (Remove Member from Workspace)
const handleRemoveMember = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const memberId = req.params.memberId as string;

    const targetMember = await prisma.workspaceMember.findUnique({
      where: { id: memberId },
      include: {
        user: { select: { id: true, displayName: true, email: true } },
      },
    });

    if (!targetMember) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Workspace member record not found' },
      });
      return;
    }

    const authCheck = await verifyWorkspaceAuth(userId, targetMember.workspaceId, 'ADMIN');
    if (!authCheck.allowed) {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Only workspace administrators can remove members' },
      });
      return;
    }

    const isSelf = targetMember.userId === userId;
    let isTargetSoleOwner = false;

    if (targetMember.role === 'OWNER') {
      const ownerCount = await prisma.workspaceMember.count({
        where: { workspaceId: targetMember.workspaceId, role: 'OWNER' },
      });
      isTargetSoleOwner = ownerCount <= 1;
    }

    if (!canRemoveMember(authCheck.role!, targetMember.role, isTargetSoleOwner, isSelf)) {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN_REMOVAL',
          message: isTargetSoleOwner
            ? 'Cannot remove the sole owner of the workspace.'
            : `Your current role (${authCheck.role}) cannot remove a ${targetMember.role}.`,
        },
      });
      return;
    }

    await prisma.workspaceMember.delete({
      where: { id: memberId },
    });

    await logWorkspaceActivity({
      workspaceId: targetMember.workspaceId,
      userId,
      action: isSelf ? 'MEMBER_LEFT' : 'MEMBER_REMOVED',
      entityType: 'MEMBER',
      entityId: targetMember.userId,
      metadata: { targetEmail: targetMember.user.email, role: targetMember.role },
    });

    broadcastCollaborationEvent('MEMBER_REMOVED', targetMember.workspaceId, {
      memberId,
      userId: targetMember.userId,
    });

    res.json({
      success: true,
      data: {
        message: isSelf ? 'You have successfully left the workspace' : 'Member removed from workspace',
      },
    });
  } catch (error) {
    console.error('Remove member error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to remove workspace member' },
    });
  }
};

router.delete('/members/:memberId', handleRemoveMember);
router.delete('/collaboration/members/:memberId', handleRemoveMember);
router.delete('/workspaces/:id/members/:memberId', handleRemoveMember);
router.delete('/collaboration/workspaces/:id/members/:memberId', handleRemoveMember);

// ─── GET /api/collaboration/documents (Workspace Documents with Collaboration Context) ─
const handleListSharedDocuments = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const requestedWorkspaceId = (req.query.workspaceId as string | undefined) || (req.headers['x-workspace-id'] as string | undefined);

    let workspaceId = requestedWorkspaceId;
    if (!workspaceId) {
      const ws = await getOrCreateUserWorkspace(userId);
      workspaceId = ws.workspaceId;
    }

    const authCheck = await verifyWorkspaceAuth(userId, workspaceId, 'VIEWER');
    if (!authCheck.allowed) {
      res.status(authCheck.error?.status || 403).json({
        success: false,
        error: authCheck.error || { code: 'FORBIDDEN', message: 'Access denied' },
      });
      return;
    }

    const search = (req.query.search as string | undefined)?.trim();

    const documents = await prisma.document.findMany({
      where: {
        workspaceId,
        isDeleted: false,
        ...(search ? { title: { contains: search, mode: 'insensitive' } } : {}),
      },
      orderBy: { updatedAt: 'desc' },
      include: {
        creator: {
          select: { id: true, displayName: true, email: true, avatarUrl: true },
        },
        memberships: {
          include: {
            user: {
              select: { id: true, displayName: true, email: true, avatarUrl: true },
            },
          },
        },
        publicLink: {
          select: { isEnabled: true, permission: true },
        },
        _count: {
          select: { comments: true, revisions: true },
        },
      },
    });

    res.json({
      success: true,
      data: {
        documents: documents.map((doc) => {
          const userMembership = doc.memberships.find((m) => m.userId === userId);
          const isCreator = doc.creatorId === userId;
          const isOwner = isCreator || authCheck.role === 'OWNER' || authCheck.role === 'ADMIN';

          return {
            id: doc.id,
            title: doc.title,
            icon: doc.icon || '📄',
            status: doc.status,
            createdAt: doc.createdAt,
            updatedAt: doc.updatedAt,
            creator: doc.creator,
            userRole: isOwner ? 'OWNER' : userMembership?.role || 'VIEWER',
            isShared: doc.memberships.length > 0 || Boolean(doc.publicLink?.isEnabled),
            publicLinkEnabled: Boolean(doc.publicLink?.isEnabled),
            publicPermission: doc.publicLink?.permission || null,
            commentCount: doc._count.comments,
            revisionCount: doc._count.revisions,
            collaborators: doc.memberships.map((m) => ({
              id: m.id,
              userId: m.user.id,
              displayName: m.user.displayName,
              email: m.user.email,
              avatarUrl: m.user.avatarUrl,
              role: m.role,
            })),
          };
        }),
      },
    });
  } catch (error) {
    console.error('List shared documents error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve shared documents' },
    });
  }
};

router.get('/documents', handleListSharedDocuments);
router.get('/collaboration/documents', handleListSharedDocuments);

// ─── GET /api/collaboration/activity (Workspace Audit Timeline) ───────────────
const handleListWorkspaceActivity = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const requestedWorkspaceId = (req.query.workspaceId as string | undefined) || (req.headers['x-workspace-id'] as string | undefined);

    let workspaceId = requestedWorkspaceId;
    if (!workspaceId) {
      const ws = await getOrCreateUserWorkspace(userId);
      workspaceId = ws.workspaceId;
    }

    const authCheck = await verifyWorkspaceAuth(userId, workspaceId, 'VIEWER');
    if (!authCheck.allowed) {
      res.status(authCheck.error?.status || 403).json({
        success: false,
        error: authCheck.error || { code: 'FORBIDDEN', message: 'Access denied' },
      });
      return;
    }

    const entityType = req.query.entityType as string | undefined;
    const page = Math.max(1, parseInt((req.query.page as string) || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) || '25', 10)));
    const skip = (page - 1) * limit;

    const whereClause: Prisma.WorkspaceActivityWhereInput = {
      workspaceId,
      ...(entityType && entityType !== 'ALL' ? { entityType } : {}),
    };

    const [totalCount, activities] = await Promise.all([
      prisma.workspaceActivity.count({ where: whereClause }),
      prisma.workspaceActivity.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { id: true, displayName: true, email: true, avatarUrl: true },
          },
        },
      }),
    ]);

    res.json({
      success: true,
      data: {
        activities: activities.map((a) => ({
          id: a.id,
          action: a.action,
          entityType: a.entityType,
          entityId: a.entityId,
          metadata: a.metadata,
          createdAt: a.createdAt,
          user: a.user,
        })),
        pagination: {
          page,
          limit,
          totalCount,
          totalPages: Math.ceil(totalCount / limit),
        },
      },
    });
  } catch (error) {
    console.error('List workspace activity error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve activity history' },
    });
  }
};

router.get('/activity', handleListWorkspaceActivity);
router.get('/collaboration/activity', handleListWorkspaceActivity);

// ─── GET /api/collaboration/mentionable-users (@mention account suggestions) ───
const handleMentionableUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const requestedWorkspaceId = (req.query.workspaceId as string | undefined) || (req.headers['x-workspace-id'] as string | undefined);

    let workspaceId = requestedWorkspaceId;
    if (!workspaceId) {
      const ws = await getOrCreateUserWorkspace(userId);
      workspaceId = ws.workspaceId;
    }

    const authCheck = await verifyWorkspaceAuth(userId, workspaceId, 'VIEWER');
    if (!authCheck.allowed) {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Access denied' },
      });
      return;
    }

    const members = await prisma.workspaceMember.findMany({
      where: { workspaceId },
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { joinedAt: 'asc' },
    });

    res.json({
      success: true,
      data: {
        users: members.map((m) => ({
          id: m.user.id,
          displayName: m.user.displayName,
          email: m.user.email,
          avatarUrl: m.user.avatarUrl,
          role: m.role,
        })),
      },
    });
  } catch (error) {
    console.error('Mentionable users error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve mentionable users' },
    });
  }
};

router.get('/mentionable-users', handleMentionableUsers);
router.get('/collaboration/mentionable-users', handleMentionableUsers);

// ─── GET /api/collaboration/realtime (SSE Stream for Presence & Live Sync) ─────
const handleRealtimeStream = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const requestedWorkspaceId = (req.query.workspaceId as string | undefined) || (req.headers['x-workspace-id'] as string | undefined);
    const documentId = req.query.documentId as string | undefined;

    let workspaceId = requestedWorkspaceId;
    if (!workspaceId) {
      const ws = await getOrCreateUserWorkspace(userId);
      workspaceId = ws.workspaceId;
    }

    const authCheck = await verifyWorkspaceAuth(userId, workspaceId, 'VIEWER');
    if (!authCheck.allowed) {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Access denied to workspace realtime channel' },
      });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, displayName: true, email: true, avatarUrl: true },
    });

    if (!user) {
      res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'User not found' } });
      return;
    }

    const clientId = crypto.randomUUID();
    realtimeHub.addClient(clientId, userId, workspaceId, res, user, documentId || null);
  } catch (error) {
    console.error('SSE realtime stream error:', error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to initialize realtime connection' },
      });
    }
  }
};

router.get('/realtime', handleRealtimeStream);
router.get('/collaboration/realtime', handleRealtimeStream);

// ─── POST /api/collaboration/presence/heartbeat (Keepalive & Context Switch) ──
const handlePresenceHeartbeat = async (req: Request, res: Response): Promise<void> => {
  try {
    const { clientId, documentId } = req.body;
    if (clientId) {
      realtimeHub.touchClient(clientId);
      if (documentId !== undefined) {
        realtimeHub.switchDocumentContext(clientId, documentId);
      }
    }
    res.json({ success: true, timestamp: new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Heartbeat failed' } });
  }
};

router.post('/presence/heartbeat', handlePresenceHeartbeat);
router.post('/collaboration/presence/heartbeat', handlePresenceHeartbeat);

// ─── POST /api/collaboration/document-sync (Simultaneous Editing Delta Broadcast) ─
const handleDocumentSync = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { documentId, action, version, patch, clientId } = req.body;

    if (!documentId) {
      res.status(400).json({ success: false, error: { code: 'INVALID_INPUT', message: 'documentId required' } });
      return;
    }

    const authCheck = await verifyDocumentPermission(userId, documentId, 'EDITOR');
    if (!authCheck.allowed) {
      res.status(authCheck.error?.status || 403).json({
        success: false,
        error: authCheck.error || { code: 'FORBIDDEN', message: 'Editor permission required' },
      });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, displayName: true, avatarUrl: true },
    });

    broadcastCollaborationEvent(
      'DOCUMENT_SYNC',
      authCheck.document.workspaceId,
      {
        documentId,
        action: action || 'EDIT',
        version,
        patch,
        author: user,
        timestamp: new Date().toISOString(),
      },
      { documentId, excludeClientId: clientId }
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Document sync broadcast error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Sync failed' } });
  }
};

router.post('/document-sync', handleDocumentSync);
router.post('/collaboration/document-sync', handleDocumentSync);

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

    // 1. Fetch Collaborator Memberships (Exclude creator to avoid duplicate entries)
    const memberships = await prisma.documentMembership.findMany({
      where: {
        documentId,
        userId: { not: doc.creatorId },
      },
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

    res.json({
      success: true,
      data: {
        currentUserRole: authCheck.role,
        isOwner: authCheck.isOwner,
        title: doc.title,
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

// ─── POST /api/documents/:id/invitations (Send Document Email Invitation) ────
router.post('/:id/invitations', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const documentId = req.params.id as string;
    const { recipientEmail, role = 'VIEWER', message } = req.body;

    const authCheck = await verifyDocumentPermission(userId, documentId, 'OWNER');
    if (!authCheck.allowed) {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Only document owners can invite collaborators' },
      });
      return;
    }

    if (!recipientEmail || typeof recipientEmail !== 'string' || !recipientEmail.includes('@')) {
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

    // Check if recipient is the creator
    if (authCheck.document.creator.email.toLowerCase() === normalizedEmail) {
      res.status(400).json({
        success: false,
        error: { code: 'CANNOT_INVITE_CREATOR', message: 'The document creator already holds sovereign OWNER privileges.' },
      });
      return;
    }

    // Check if recipient is already a collaborator
    const existingMember = await prisma.documentMembership.findFirst({
      where: {
        documentId,
        user: { emailNormalized: normalizedEmail },
      },
    });

    if (existingMember) {
      res.status(409).json({
        success: false,
        error: {
          code: 'ALREADY_COLLABORATOR',
          message: `User is already an active ${existingMember.role} on this document.`,
        },
      });
      return;
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await prisma.documentInvitation.updateMany({
      where: {
        documentId,
        recipientEmail: normalizedEmail,
        status: 'PENDING',
      },
      data: { status: 'REVOKED', revokedAt: new Date() },
    });

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

    const inviter = await prisma.user.findUnique({
      where: { id: userId },
      select: { displayName: true },
    });

    const inviteUrl = `${resolveAppUrl(req)}/invite/${rawToken}`;
    const emailProvider = getEmailProvider();
    const emailData = buildDocumentInvitationEmail(
      inviteUrl,
      inviter?.displayName || 'An operator',
      authCheck.document.title,
      role,
      normalizedEmail,
      message
    );

    let emailSent = false;
    let emailErrorMessage: string | null = null;

    try {
      await emailProvider.send({
        to: normalizedEmail,
        ...emailData,
      });
      emailSent = true;
    } catch (mailError: any) {
      console.warn('⚠️ Document invitation email delivery warning:', mailError?.message || mailError);
      emailErrorMessage = mailError?.message || 'SMTP delivery issue';
    }

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
          inviteUrl,
        },
        emailSent,
        message: emailSent
          ? `Invitation dispatched to ${normalizedEmail}`
          : `Invitation created in database. Email note: ${emailErrorMessage || 'Check SMTP credentials in .env'}. Link: ${inviteUrl}`,
      },
    });
  } catch (error) {
    console.error('Send document invitation error:', error);
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

    const inviteUrl = `${resolveAppUrl(req)}/invite/${rawToken}`;
    const emailProvider = getEmailProvider();
    const emailData = buildDocumentInvitationEmail(
      inviteUrl,
      inviter?.displayName || 'An operator',
      authCheck.document.title,
      updated.role,
      updated.recipientEmail,
      updated.message || undefined
    );

    let emailSent = false;
    try {
      await emailProvider.send({
        to: updated.recipientEmail,
        ...emailData,
      });
      emailSent = true;
    } catch (mailError: any) {
      console.warn('⚠️ Resend email warning:', mailError?.message || mailError);
    }

    res.json({
      success: true,
      data: {
        invitation: updated,
        emailSent,
        inviteUrl,
        message: emailSent ? 'Invitation resent successfully' : 'Token refreshed. Email dispatch warning.',
      },
    });
  } catch (error) {
    console.error('Resend document invitation error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to resend invitation' },
    });
  }
});

// ─── DELETE /api/documents/:id/invitations/:invitationId (Revoke Doc Invite) ──
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
    console.error('Revoke document invitation error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to revoke invitation' },
    });
  }
});

// ─── PATCH /api/documents/:id/collaborators/:userId (Update Doc Collaborator) ─
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

// ─── DELETE /api/documents/:id/collaborators/:userId (Remove Doc Collaborator) ─
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
      // Ignored
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

// ─── POST /api/documents/:id/share (Public & User Collaborator Share) ─────────
router.post('/:id/share', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const documentId = req.params.id as string;
    const { isPublic = true, permission = 'VIEW', userId: targetUserId, role } = req.body;

    const authCheck = await verifyDocumentPermission(userId, documentId, 'OWNER');
    if (!authCheck.allowed) {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Only document owners can manage sharing' },
      });
      return;
    }

    // Direct collaborator permission assignment
    if (targetUserId) {
      const docRole: DocumentRole = (role || (permission === 'EDIT' ? 'EDITOR' : 'VIEWER')) as DocumentRole;
      const membership = await prisma.documentMembership.upsert({
        where: {
          documentId_userId: {
            documentId,
            userId: targetUserId,
          },
        },
        update: { role: docRole },
        create: {
          documentId,
          userId: targetUserId,
          role: docRole,
        },
      });

      res.status(200).json({
        success: true,
        data: { membership, message: `Collaborator access set to ${docRole}` },
      });
      return;
    }

    let publicLink = await prisma.documentPublicLink.findUnique({
      where: { documentId },
    });

    const publicToken = publicLink?.publicToken || crypto.randomBytes(16).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(publicToken).digest('hex');

    if (!publicLink) {
      publicLink = await prisma.documentPublicLink.create({
        data: {
          documentId,
          publicToken,
          tokenHash,
          permission: permission === 'EDIT' ? 'EDIT' : 'VIEW',
          isEnabled: Boolean(isPublic),
          createdById: userId,
        },
      });
    } else {
      publicLink = await prisma.documentPublicLink.update({
        where: { id: publicLink.id },
        data: {
          isEnabled: Boolean(isPublic),
          permission: permission === 'EDIT' ? 'EDIT' : 'VIEW',
          revokedAt: isPublic ? null : new Date(),
        },
      });
    }

    const share = await prisma.documentShare.upsert({
      where: { shareToken: publicToken },
      update: {
        isPublic: Boolean(isPublic),
        permission: permission === 'EDIT' ? 'EDIT' : 'VIEW',
      },
      create: {
        documentId,
        isPublic: Boolean(isPublic),
        permission: permission === 'EDIT' ? 'EDIT' : 'VIEW',
        shareToken: publicToken,
      },
    });

    res.json({
      success: true,
      data: {
        id: share.id,
        documentId,
        isPublic: Boolean(isPublic),
        permission: publicLink.permission,
        shareToken: publicToken,
        publicUrl: `${resolveAppUrl(req)}/share/${publicToken}`,
      },
    });
  } catch (error) {
    console.error('Share document error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to update sharing settings' },
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

// ─── GET /api/documents/:id/comments (List Threaded Comments with Mentions) ───
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
        author: { select: { id: true, displayName: true, avatarUrl: true, email: true } },
        mentions: {
          include: {
            user: { select: { id: true, displayName: true, email: true } },
          },
        },
        replies: {
          orderBy: { createdAt: 'asc' },
          include: {
            author: { select: { id: true, displayName: true, avatarUrl: true, email: true } },
            mentions: {
              include: {
                user: { select: { id: true, displayName: true, email: true } },
              },
            },
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

// ─── POST /api/documents/:id/comments (Create Threaded Comment with Mentions) ─
router.post('/:id/comments', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const documentId = req.params.id as string;
    const { content, selectedText, parentId, mentionedUserIds = [] } = req.body;

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

    const cleanContent = content.trim();

    // Create the comment and mention relationships transactionally
    const comment = await prisma.$transaction(async (tx) => {
      const created = await tx.documentComment.create({
        data: {
          documentId,
          authorId: userId,
          parentId: parentId || null,
          content: cleanContent,
          selectedText: selectedText || null,
        },
        include: {
          author: { select: { id: true, displayName: true, avatarUrl: true, email: true } },
        },
      });

      // Parse mentions from mentionedUserIds array or regex `user:([a-zA-Z0-9_-]+)`
      const parsedUserIds = new Set<string>();
      if (Array.isArray(mentionedUserIds)) {
        for (const mId of mentionedUserIds) {
          if (typeof mId === 'string' && mId !== userId) {
            parsedUserIds.add(mId);
          }
        }
      }

      // Also parse markdown mention pattern @[name](user:userId)
      const mentionRegex = /user:([a-zA-Z0-9_-]+)/g;
      let match;
      while ((match = mentionRegex.exec(cleanContent)) !== null) {
        if (match[1] !== userId) {
          parsedUserIds.add(match[1]);
        }
      }

      // Validate mentioned users belong to workspace
      for (const mUserId of parsedUserIds) {
        const isMember = await tx.workspaceMember.findUnique({
          where: {
            workspaceId_userId: {
              workspaceId: authCheck.document.workspaceId,
              userId: mUserId,
            },
          },
        });

        if (isMember) {
          await tx.commentMention.create({
            data: {
              commentId: created.id,
              userId: mUserId,
            },
          });

          // Dispatch transactional in-app notification
          await tx.notification.create({
            data: {
              workspaceId: authCheck.document.workspaceId,
              recipientId: mUserId,
              actorId: userId,
              type: 'MENTION',
              title: `Mentioned in ${authCheck.document.title}`,
              message: `${created.author.displayName} mentioned you in a comment: "${cleanContent.slice(0, 80)}${cleanContent.length > 80 ? '...' : ''}"`,
              linkUrl: `/documents?id=${documentId}`,
            },
          });
        }
      }

      return created;
    });

    // Broadcast comment event in real-time
    broadcastCollaborationEvent(
      'COMMENT_ADDED',
      authCheck.document.workspaceId,
      {
        documentId,
        comment,
      },
      { documentId }
    );

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

// ─── PATCH /api/documents/:id/comments/:commentId (Edit Comment) ──────────────
router.patch('/:id/comments/:commentId', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const documentId = req.params.id as string;
    const commentId = req.params.commentId as string;
    const { content } = req.body;

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      res.status(400).json({ success: false, error: { code: 'INVALID_INPUT', message: 'Comment content cannot be empty' } });
      return;
    }

    const comment = await prisma.documentComment.findUnique({
      where: { id: commentId },
    });

    if (!comment || comment.documentId !== documentId) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Comment not found' } });
      return;
    }

    // Only author can edit comment content
    if (comment.authorId !== userId) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'You can only edit your own comments' } });
      return;
    }

    const updated = await prisma.documentComment.update({
      where: { id: commentId },
      data: { content: content.trim() },
      include: {
        author: { select: { id: true, displayName: true, avatarUrl: true, email: true } },
      },
    });

    res.json({ success: true, data: { comment: updated } });
  } catch (error) {
    console.error('Edit comment error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to edit comment' } });
  }
});

// ─── DELETE /api/documents/:id/comments/:commentId (Delete Comment) ───────────
router.delete('/:id/comments/:commentId', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const documentId = req.params.id as string;
    const commentId = req.params.commentId as string;

    const comment = await prisma.documentComment.findUnique({
      where: { id: commentId },
      include: { document: { select: { workspaceId: true, creatorId: true } } },
    });

    if (!comment || comment.documentId !== documentId) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Comment not found' } });
      return;
    }

    const wsAuth = await verifyWorkspaceAuth(userId, comment.document.workspaceId, 'VIEWER');
    const isAuthor = comment.authorId === userId;
    const isDocCreator = comment.document.creatorId === userId;
    const isWsAdmin = wsAuth.allowed && (wsAuth.role === 'OWNER' || wsAuth.role === 'ADMIN');

    if (!isAuthor && !isDocCreator && !isWsAdmin) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Not authorized to delete this comment' } });
      return;
    }

    await prisma.documentComment.delete({
      where: { id: commentId },
    });

    res.json({ success: true, data: { message: 'Comment deleted successfully' } });
  } catch (error) {
    console.error('Delete comment error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete comment' } });
  }
});

// ─── GET /api/documents/:id/activity (Document Audit Timeline) ────────────────
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

    res.json({
      success: true,
      data: { activities },
    });
  } catch (error) {
    console.error('List document activity error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to list activity' },
    });
  }
});

export default router;
