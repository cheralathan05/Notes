import { prisma } from './prisma';
import { DocumentRole } from '@prisma/client';

export interface DocumentAccessResult {
  allowed: boolean;
  role: DocumentRole;
  isOwner: boolean;
  document: any;
  error?: {
    code: string;
    message: string;
    status: number;
  };
}

const ROLE_HIERARCHY: Record<DocumentRole, number> = {
  VIEWER: 1,
  COMMENTER: 2,
  EDITOR: 3,
  OWNER: 4,
};

/**
 * Authoritative Document Access Resolution:
 * 1. Verifies document existence and workspace association.
 * 2. Checks explicit DocumentMembership for this user.
 * 3. Checks document creator status and workspace administration rights.
 * 4. Resolves the effective permission against the required minimum role.
 */
export async function verifyDocumentPermission(
  userId: string,
  documentId: string,
  minRole: DocumentRole = 'VIEWER'
): Promise<DocumentAccessResult> {
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    include: {
      creator: { select: { id: true, displayName: true, email: true } },
    },
  });

  if (!document || document.isDeleted) {
    return {
      allowed: false,
      role: 'VIEWER',
      isOwner: false,
      document: null,
      error: { code: 'NOT_FOUND', message: 'Document not found', status: 404 },
    };
  }

  // 1. Check workspace membership
  const wsMember = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId: document.workspaceId,
        userId,
      },
    },
  });

  if (!wsMember) {
    // Check if user has an explicit document membership (e.g. invited collaborator)
    const explicitMembership = await prisma.documentMembership.findUnique({
      where: {
        documentId_userId: {
          documentId,
          userId,
        },
      },
    });

    if (!explicitMembership) {
      return {
        allowed: false,
        role: 'VIEWER',
        isOwner: false,
        document,
        error: { code: 'FORBIDDEN', message: 'Access denied: not authorized for this document', status: 403 },
      };
    }

    const effectiveRole = explicitMembership.role;
    const allowed = ROLE_HIERARCHY[effectiveRole] >= ROLE_HIERARCHY[minRole];
    return {
      allowed,
      role: effectiveRole,
      isOwner: effectiveRole === 'OWNER',
      document,
      error: allowed
        ? undefined
        : { code: 'FORBIDDEN', message: `Requires ${minRole} permission, but current role is ${effectiveRole}`, status: 403 },
    };
  }

  // 2. Creator or Workspace Owner/Admin is automatically document OWNER
  if (document.creatorId === userId || wsMember.role === 'OWNER' || wsMember.role === 'ADMIN') {
    return {
      allowed: true,
      role: 'OWNER',
      isOwner: true,
      document,
    };
  }

  // 3. Check for an explicit DocumentMembership override
  const membership = await prisma.documentMembership.findUnique({
    where: {
      documentId_userId: {
        documentId,
        userId,
      },
    },
  });

  let effectiveRole: DocumentRole = 'EDITOR';

  if (membership) {
    effectiveRole = membership.role;
  } else if (wsMember.role === 'VIEWER') {
    effectiveRole = 'VIEWER';
  } else {
    // Default workspace member has EDITOR rights on workspace docs
    effectiveRole = 'EDITOR';
  }

  const allowed = ROLE_HIERARCHY[effectiveRole] >= ROLE_HIERARCHY[minRole];

  return {
    allowed,
    role: effectiveRole,
    isOwner: effectiveRole === 'OWNER',
    document,
    error: allowed
      ? undefined
      : { code: 'FORBIDDEN', message: `Requires ${minRole} permission, but current role is ${effectiveRole}`, status: 403 },
  };
}
