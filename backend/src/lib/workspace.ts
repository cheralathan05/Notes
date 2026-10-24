import { Request } from 'express';
import '../middleware/auth';
import { prisma } from './prisma';
import { WorkspaceRole } from '@prisma/client';

export interface UserWorkspaceContext {
  workspaceId: string;
  role: WorkspaceRole;
  workspaceName: string;
}

/**
 * Extract requested workspace ID from HTTP headers, query parameters, or request body.
 */
export function extractRequestedWorkspaceId(req: Request): string | undefined {
  const header = (req.headers['x-workspace-id'] as string) || (req.headers['x-atlas-workspace'] as string);
  const query = req.query?.workspaceId as string | undefined;
  const body = req.body?.workspaceId as string | undefined;
  const raw = header || query || body || req.workspaceId;
  return typeof raw === 'string' && raw.trim().length > 0 ? raw.trim() : undefined;
}

/**
 * Get or automatically initialize a primary workspace for a user.
 * Supports explicit requestedWorkspaceId; falls back to the user's latest joined workspace (descending order).
 */
export async function getOrCreateUserWorkspace(
  userId: string,
  requestedWorkspaceId?: string | null
): Promise<UserWorkspaceContext> {
  // 1. If explicit workspaceId was requested, verify membership
  if (requestedWorkspaceId) {
    const requested = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: requestedWorkspaceId,
          userId,
        },
      },
      include: { workspace: true },
    });

    if (requested) {
      return {
        workspaceId: requested.workspaceId,
        role: requested.role,
        workspaceName: requested.workspace.name,
      };
    }
  }

  // 2. Otherwise find the most recently joined / active workspace membership for this user
  const latestMembership = await prisma.workspaceMember.findFirst({
    where: { userId },
    include: { workspace: true },
    orderBy: { joinedAt: 'desc' },
  });

  if (latestMembership) {
    return {
      workspaceId: latestMembership.workspaceId,
      role: latestMembership.role,
      workspaceName: latestMembership.workspace.name,
    };
  }

  // 3. User has no workspaces yet -> create default sovereign workspace
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { displayName: true },
  });

  const name = user?.displayName ? `${user.displayName}'s Workspace` : 'Primary Workspace';
  const slug = `ws-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;

  const workspace = await prisma.workspace.create({
    data: {
      name,
      slug,
      members: {
        create: {
          userId,
          role: 'OWNER',
        },
      },
    },
  });

  return {
    workspaceId: workspace.id,
    role: 'OWNER',
    workspaceName: workspace.name,
  };
}

/**
 * Resolve workspace context from incoming request.
 */
export async function resolveWorkspaceContext(req: Request): Promise<UserWorkspaceContext> {
  const userId = req.userId;
  if (!userId) {
    throw new Error('resolveWorkspaceContext requires authenticated req.userId');
  }
  const requestedWorkspaceId = extractRequestedWorkspaceId(req);
  const context = await getOrCreateUserWorkspace(userId, requestedWorkspaceId);
  req.workspaceId = context.workspaceId;
  return context;
}

/**
 * Verify that a user has valid membership in the given workspace.
 */
export async function verifyWorkspaceMembership(
  userId: string,
  workspaceId: string
): Promise<{ allowed: boolean; role?: WorkspaceRole }> {
  const member = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId,
        userId,
      },
    },
  });

  if (!member) {
    return { allowed: false };
  }

  return { allowed: true, role: member.role };
}
