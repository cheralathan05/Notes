import { prisma } from './prisma';
import { WorkspaceRole, Prisma } from '@prisma/client';

export interface WorkspaceAuthResult {
  allowed: boolean;
  role?: WorkspaceRole;
  membership?: {
    id: string;
    workspaceId: string;
    userId: string;
    role: WorkspaceRole;
    joinedAt: Date;
  };
  workspace?: {
    id: string;
    name: string;
    slug: string;
  };
  error?: {
    status: number;
    code: string;
    message: string;
  };
}

export const WORKSPACE_ROLE_WEIGHT: Record<WorkspaceRole, number> = {
  VIEWER: 1,
  MEMBER: 2,
  ADMIN: 3,
  OWNER: 4,
};

/**
 * Verify workspace membership and role hierarchy authorization.
 */
export async function verifyWorkspaceAuth(
  userId: string,
  workspaceId: string,
  minRole: WorkspaceRole = 'VIEWER'
): Promise<WorkspaceAuthResult> {
  const member = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId,
        userId,
      },
    },
    include: {
      workspace: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
  });

  if (!member) {
    return {
      allowed: false,
      error: {
        status: 403,
        code: 'FORBIDDEN',
        message: 'Access denied: You are not a member of this workspace',
      },
    };
  }

  const userWeight = WORKSPACE_ROLE_WEIGHT[member.role];
  const requiredWeight = WORKSPACE_ROLE_WEIGHT[minRole];

  if (userWeight < requiredWeight) {
    return {
      allowed: false,
      role: member.role,
      membership: member,
      workspace: member.workspace,
      error: {
        status: 403,
        code: 'INSUFFICIENT_PERMISSIONS',
        message: `Requires ${minRole} role or higher, but your current workspace role is ${member.role}`,
      },
    };
  }

  return {
    allowed: true,
    role: member.role,
    membership: member,
    workspace: member.workspace,
  };
}

/**
 * Validates whether an inviter can invite a user with the specified role.
 * - OWNER can invite any role (OWNER, ADMIN, MEMBER, VIEWER).
 * - ADMIN can invite MEMBER and VIEWER only.
 * - MEMBER and VIEWER cannot invite users.
 */
export function canInviteRole(inviterRole: WorkspaceRole, roleToInvite: WorkspaceRole): boolean {
  if (inviterRole === 'OWNER') return true;
  if (inviterRole === 'ADMIN') {
    return roleToInvite === 'MEMBER' || roleToInvite === 'VIEWER';
  }
  return false;
}

/**
 * Validates whether an actor can modify a target member's role.
 * - Only OWNER can promote to or demote from OWNER or ADMIN.
 * - ADMIN can toggle between MEMBER and VIEWER only.
 * - Users cannot alter their own role.
 */
export function canUpdateRole(
  actorRole: WorkspaceRole,
  currentRole: WorkspaceRole,
  newRole: WorkspaceRole,
  isSelf: boolean
): boolean {
  if (isSelf) return false;
  if (actorRole === 'OWNER') {
    return true;
  }
  if (actorRole === 'ADMIN') {
    const isTargetManageable = currentRole === 'MEMBER' || currentRole === 'VIEWER';
    const isNewRolePermitted = newRole === 'MEMBER' || newRole === 'VIEWER';
    return isTargetManageable && isNewRolePermitted;
  }
  return false;
}

/**
 * Validates whether an actor can remove a member from a workspace.
 * - Cannot remove the sole OWNER.
 * - OWNER can remove anyone (except self if sole owner).
 * - ADMIN can remove MEMBER and VIEWER only.
 */
export function canRemoveMember(
  actorRole: WorkspaceRole,
  targetRole: WorkspaceRole,
  isTargetSoleOwner: boolean,
  isSelf: boolean
): boolean {
  if (isTargetSoleOwner) return false;
  if (isSelf) return true; // Voluntary leave
  if (actorRole === 'OWNER') return true;
  if (actorRole === 'ADMIN') {
    return targetRole === 'MEMBER' || targetRole === 'VIEWER';
  }
  return false;
}

/**
 * Log transactional workspace activity for audit history.
 */
export async function logWorkspaceActivity(params: {
  workspaceId: string;
  userId?: string | null;
  action: string;
  entityType?: string;
  entityId?: string | null;
  metadata?: Prisma.InputJsonValue;
  tx?: any;
}): Promise<void> {
  const client: any = params.tx || prisma;
  try {
    await client.workspaceActivity.create({
      data: {
        workspaceId: params.workspaceId,
        userId: params.userId || null,
        action: params.action,
        entityType: params.entityType || 'WORKSPACE',
        entityId: params.entityId || null,
        metadata: params.metadata || Prisma.JsonNull,
      },
    });
  } catch (err) {
    console.error('Failed to log workspace activity audit record:', err);
  }
}
