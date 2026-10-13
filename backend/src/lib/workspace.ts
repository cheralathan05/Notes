import { prisma } from './prisma';
import { WorkspaceRole } from '@prisma/client';

export interface UserWorkspaceContext {
  workspaceId: string;
  role: WorkspaceRole;
  workspaceName: string;
}

/**
 * Get or automatically initialize a primary workspace for a user.
 * Ensures the user always has an active workspace context without artificial friction.
 */
export async function getOrCreateUserWorkspace(userId: string): Promise<UserWorkspaceContext> {
  // Check if user has an existing workspace membership
  const membership = await prisma.workspaceMember.findFirst({
    where: { userId },
    include: { workspace: true },
    orderBy: { joinedAt: 'asc' },
  });

  if (membership) {
    return {
      workspaceId: membership.workspaceId,
      role: membership.role,
      workspaceName: membership.workspace.name,
    };
  }

  // Create a default workspace for the user
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
