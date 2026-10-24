import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';
import { getOrCreateUserWorkspace, verifyWorkspaceMembership, resolveWorkspaceContext } from '../lib/workspace';
import { verifyDocumentPermission } from '../lib/document-auth';

const router = Router();
router.use(authMiddleware);

// ─── Helper to extract plain text from TipTap JSON ───────────────────────────
function extractPlainText(content: any): string {
  if (!content) return '';
  if (typeof content === 'string') return content;
  let text = '';
  function walk(node: any) {
    if (!node) return;
    if (node.text) text += node.text + ' ';
    if (Array.isArray(node.content)) {
      node.content.forEach(walk);
    }
  }
  walk(content);
  return text.trim();
}

// ─── GET /api/documents (List documents) ─────────────────────────────────────
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const ws = await resolveWorkspaceContext(req);
    const workspaceId = ws.workspaceId;

    const access = await verifyWorkspaceMembership(userId, workspaceId);
    if (!access.allowed) {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'You do not have access to this workspace' },
      });
      return;
    }

    const {
      folderId,
      parentId,
      isFavorite,
      isArchived,
      isTrash,
      search,
      status,
      tag,
      sort = 'updatedAt',
      order = 'desc',
    } = req.query;

    const viewSharedOnly = req.query.shared === 'true';

    // Access scope: either user's current workspace or documents shared with them
    const accessFilter = viewSharedOnly
      ? { memberships: { some: { userId } }, creatorId: { not: userId } }
      : {
          OR: [
            { workspaceId },
            { memberships: { some: { userId } } },
          ],
        };

    const andConditions: any[] = [
      accessFilter,
      { isDeleted: isTrash === 'true' },
    ];

    if (isTrash !== 'true') {
      if (isArchived === 'true') {
        andConditions.push({ isArchived: true });
      } else {
        andConditions.push({ isArchived: false });
      }

      if (isFavorite === 'true') {
        andConditions.push({ isFavorite: true });
      }

      if (folderId !== undefined) {
        andConditions.push({ folderId: folderId === 'root' ? null : (folderId as string) });
      }

      if (parentId !== undefined) {
        andConditions.push({ parentId: parentId === 'root' ? null : (parentId as string) });
      }

      if (status) {
        andConditions.push({ status: status as any });
      }

      if (tag) {
        andConditions.push({
          tags: {
            some: {
              tag: { name: tag as string },
            },
          },
        });
      }
    }

    if (search && typeof search === 'string' && search.trim().length > 0) {
      const q = search.trim();
      andConditions.push({
        OR: [
          { title: { contains: q, mode: 'insensitive' } },
          { plainText: { contains: q, mode: 'insensitive' } },
        ],
      });
    }

    const where: any = { AND: andConditions };

    const orderBy: any = {};
    if (sort === 'title') {
      orderBy.title = order === 'asc' ? 'asc' : 'desc';
    } else if (sort === 'createdAt') {
      orderBy.createdAt = order === 'asc' ? 'asc' : 'desc';
    } else {
      orderBy.updatedAt = order === 'asc' ? 'asc' : 'desc';
    }

    const documents = await prisma.document.findMany({
      where,
      orderBy: [{ isPinned: 'desc' }, orderBy],
      select: {
        id: true,
        workspaceId: true,
        creatorId: true,
        folderId: true,
        parentId: true,
        title: true,
        icon: true,
        coverImage: true,
        status: true,
        version: true,
        orderIndex: true,
        isFullWidth: true,
        isFavorite: true,
        isPinned: true,
        isArchived: true,
        isDeleted: true,
        deletedAt: true,
        createdAt: true,
        updatedAt: true,
        folder: {
          select: { id: true, name: true, icon: true },
        },
        tags: {
          select: {
            tag: { select: { id: true, name: true, color: true } },
          },
        },
        creator: {
          select: { id: true, displayName: true, email: true, avatarUrl: true },
        },
        _count: {
          select: { children: true, comments: true, attachments: true, revisions: true },
        },
      },
    });

    res.json({
      success: true,
      data: {
        documents: documents.map((d) => ({
          ...d,
          tags: d.tags.map((t) => t.tag),
        })),
        workspace: { id: workspaceId, name: ws.workspaceName },
      },
    });
  } catch (error) {
    console.error('List documents error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve documents' },
    });
  }
});

// ─── POST /api/documents (Create document) ───────────────────────────────────
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const ws = await resolveWorkspaceContext(req);
    const workspaceId = req.body.workspaceId || ws.workspaceId;

    const access = await verifyWorkspaceMembership(userId, workspaceId);
    if (!access.allowed || access.role === 'VIEWER') {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Insufficient permission to create documents' },
      });
      return;
    }

    const {
      title = 'Untitled',
      folderId = null,
      parentId = null,
      content,
      icon = '📄',
      coverImage = null,
      status = 'DRAFT',
      tags = [],
    } = req.body;

    const initialContent = content || {
      type: 'doc',
      content: [{ type: 'paragraph' }],
    };

    const plainText = extractPlainText(initialContent);

    // Get max order index for workspace
    const maxDoc = await prisma.document.findFirst({
      where: { workspaceId, folderId, parentId },
      orderBy: { orderIndex: 'desc' },
      select: { orderIndex: true },
    });
    const orderIndex = (maxDoc?.orderIndex ?? 0) + 1;

    const document = await prisma.document.create({
      data: {
        workspaceId,
        creatorId: userId,
        folderId: folderId || null,
        parentId: parentId || null,
        title: title.trim() || 'Untitled',
        icon,
        coverImage,
        content: initialContent,
        plainText,
        status: status === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT',
        orderIndex,
        version: 1,
      },
      include: {
        folder: { select: { id: true, name: true, icon: true } },
        creator: { select: { id: true, displayName: true, email: true, avatarUrl: true } },
      },
    });

    // Create initial revision snapshot
    await prisma.documentRevision.create({
      data: {
        documentId: document.id,
        creatorId: userId,
        version: 1,
        title: document.title,
        content: initialContent,
        description: 'Initial Document Creation',
      },
    });

    // Create initial owner membership
    await prisma.documentMembership.create({
      data: {
        documentId: document.id,
        userId,
        role: 'OWNER',
      },
    });

    // Record activity
    await prisma.documentActivity.create({
      data: {
        documentId: document.id,
        userId,
        action: 'CREATED',
        metadata: { title: document.title },
      },
    });

    res.status(201).json({
      success: true,
      data: { document },
    });
  } catch (error) {
    console.error('Create document error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to create document' },
    });
  }
});

// ─── GET /api/documents/:id (Get single document) ────────────────────────────
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const id = req.params.id as string;

    const document = await prisma.document.findUnique({
      where: { id },
      include: {
        folder: { select: { id: true, name: true, icon: true } },
        parent: { select: { id: true, title: true, icon: true } },
        creator: { select: { id: true, displayName: true, email: true, avatarUrl: true } },
        tags: {
          select: {
            tag: { select: { id: true, name: true, color: true } },
          },
        },
        children: {
          where: { isDeleted: false },
          select: { id: true, title: true, icon: true, updatedAt: true, orderIndex: true },
          orderBy: { orderIndex: 'asc' },
        },
        shares: {
          select: { id: true, isPublic: true, permission: true, shareToken: true },
        },
        _count: {
          select: { revisions: true, comments: true, attachments: true },
        },
      },
    });

    if (!document) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Document not found' },
      });
      return;
    }

    // Authoritative document access check (supports workspace members and explicit collaborators)
    const access = await verifyDocumentPermission(userId, id, 'VIEWER');
    if (!access.allowed) {
      res.status(access.error?.status || 403).json({
        success: false,
        error: access.error || { code: 'FORBIDDEN', message: 'Access denied to this document' },
      });
      return;
    }

    // Build breadcrumbs
    const breadcrumbs: { id: string; title: string; type: 'workspace' | 'folder' | 'document' }[] = [];
    breadcrumbs.push({ id: document.workspaceId, title: 'Workspace', type: 'workspace' });

    if (document.folder) {
      breadcrumbs.push({ id: document.folder.id, title: document.folder.name, type: 'folder' });
    }

    if (document.parent) {
      breadcrumbs.push({ id: document.parent.id, title: document.parent.title, type: 'document' });
    }

    breadcrumbs.push({ id: document.id, title: document.title, type: 'document' });

    res.json({
      success: true,
      data: {
        document: {
          ...document,
          tags: document.tags.map((t) => t.tag),
          breadcrumbs,
          userRole: access.role || 'VIEWER',
        },
      },
    });
  } catch (error) {
    console.error('Get document error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve document' },
    });
  }
});

// ─── PATCH / PUT /api/documents/:id (Update document with OCC) ───────────────
const handleUpdateDocument = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const id = req.params.id as string;

    const existing = await prisma.document.findUnique({
      where: { id },
      select: {
        id: true,
        workspaceId: true,
        version: true,
        title: true,
        content: true,
        status: true,
        isDeleted: true,
      },
    });

    if (!existing || existing.isDeleted) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Document not found or moved to trash' },
      });
      return;
    }

    // Authoritative check: Requires EDITOR rights minimum
    const access = await verifyDocumentPermission(userId, id, 'EDITOR');
    if (!access.allowed) {
      res.status(access.error?.status || 403).json({
        success: false,
        error: access.error || { code: 'FORBIDDEN', message: 'Insufficient permission to edit this document' },
      });
      return;
    }

    const {
      clientVersion,
      title,
      content,
      icon,
      coverImage,
      status,
      isFullWidth,
      isFavorite,
      isPinned,
      isArchived,
      folderId,
      parentId,
      orderIndex,
      createSnapshot,
    } = req.body;

    // Concurrency Check (Optimistic Concurrency Control)
    if (clientVersion !== undefined && clientVersion !== existing.version) {
      res.status(409).json({
        success: false,
        error: {
          code: 'CONCURRENCY_CONFLICT',
          message: 'Document has been updated by another session. Please reload to sync changes.',
          serverVersion: existing.version,
          clientVersion,
        },
      });
      return;
    }

    const updateData: any = {
      version: { increment: 1 },
    };

    if (title !== undefined) updateData.title = title.trim() || 'Untitled';
    if (content !== undefined) {
      updateData.content = content;
      updateData.plainText = extractPlainText(content);
    }
    if (icon !== undefined) updateData.icon = icon;
    if (coverImage !== undefined) updateData.coverImage = coverImage;
    if (status !== undefined) updateData.status = status;
    if (isFullWidth !== undefined) updateData.isFullWidth = isFullWidth;
    if (isFavorite !== undefined) updateData.isFavorite = isFavorite;
    if (isPinned !== undefined) updateData.isPinned = isPinned;
    if (isArchived !== undefined) updateData.isArchived = isArchived;
    if (folderId !== undefined) updateData.folderId = folderId || null;
    if (parentId !== undefined) updateData.parentId = parentId || null;
    if (orderIndex !== undefined) updateData.orderIndex = orderIndex;

    const updated = await prisma.document.update({
      where: { id },
      data: updateData,
      include: {
        folder: { select: { id: true, name: true, icon: true } },
        tags: { select: { tag: { select: { id: true, name: true, color: true } } } },
      },
    });

    // Create revision snapshot if content changed significantly or requested
    if (createSnapshot || (content !== undefined && updated.version % 5 === 0)) {
      await prisma.documentRevision.create({
        data: {
          documentId: id,
          creatorId: userId,
          version: updated.version,
          title: updated.title,
          content: updated.content as any,
          description: createSnapshot ? 'Manual Snapshot' : `Autosave v${updated.version}`,
        },
      });
    }

    // Activity log
    await prisma.documentActivity.create({
      data: {
        documentId: id,
        userId,
        action: 'UPDATED',
        metadata: { version: updated.version, title: updated.title },
      },
    });

    res.json({
      success: true,
      data: {
        document: {
          ...updated,
          tags: updated.tags.map((t) => t.tag),
        },
      },
    });
  } catch (error) {
    console.error('Update document error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to update document' },
    });
  }
};

router.patch('/:id', handleUpdateDocument);
router.put('/:id', handleUpdateDocument);

// ─── DELETE /api/documents/:id (Soft delete to trash) ────────────────────────
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const id = req.params.id as string;

    const doc = await prisma.document.findUnique({
      where: { id },
      select: { id: true, workspaceId: true, isDeleted: true },
    });

    if (!doc) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Document not found' },
      });
      return;
    }

    // Authoritative check: Only OWNER can delete/trash a document
    const access = await verifyDocumentPermission(userId, id, 'OWNER');
    if (!access.allowed) {
      res.status(access.error?.status || 403).json({
        success: false,
        error: access.error || { code: 'FORBIDDEN', message: 'Only document owners can delete this document' },
      });
      return;
    }

    await prisma.document.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });

    await prisma.documentActivity.create({
      data: {
        documentId: id,
        userId,
        action: 'TRASHED',
      },
    });

    res.json({
      success: true,
      data: { message: 'Document moved to trash' },
    });
  } catch (error) {
    console.error('Trash document error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to delete document' },
    });
  }
});

// ─── POST /api/documents/:id/restore (Restore from trash) ─────────────────────
router.post('/:id/restore', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const id = req.params.id as string;

    const doc = await prisma.document.findUnique({
      where: { id },
      select: { id: true, workspaceId: true },
    });

    if (!doc) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Document not found' },
      });
      return;
    }

    const access = await verifyWorkspaceMembership(userId, doc.workspaceId);
    if (!access.allowed || access.role === 'VIEWER') {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Insufficient permission' },
      });
      return;
    }

    const restored = await prisma.document.update({
      where: { id },
      data: {
        isDeleted: false,
        deletedAt: null,
      },
    });

    await prisma.documentActivity.create({
      data: {
        documentId: id,
        userId,
        action: 'RESTORED',
      },
    });

    res.json({
      success: true,
      data: { document: restored },
    });
  } catch (error) {
    console.error('Restore document error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to restore document' },
    });
  }
});

// ─── DELETE /api/documents/:id/permanent (Permanent purge) ───────────────────
router.delete('/:id/permanent', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const id = req.params.id as string;

    const doc = await prisma.document.findUnique({
      where: { id },
      select: { id: true, workspaceId: true },
    });

    if (!doc) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Document not found' },
      });
      return;
    }

    const access = await verifyWorkspaceMembership(userId, doc.workspaceId);
    if (!access.allowed || (access.role !== 'OWNER' && access.role !== 'ADMIN')) {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Only workspace owners or admins can permanently delete documents' },
      });
      return;
    }

    await prisma.document.delete({ where: { id } });

    res.json({
      success: true,
      data: { message: 'Document permanently deleted' },
    });
  } catch (error) {
    console.error('Permanent delete error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to permanently delete document' },
    });
  }
});

// ─── POST /api/documents/:id/duplicate (Duplicate document) ───────────────────
router.post('/:id/duplicate', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const id = req.params.id as string;

    const original = await prisma.document.findUnique({
      where: { id },
      include: {
        tags: true,
      },
    });

    if (!original) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Document not found' },
      });
      return;
    }

    const access = await verifyWorkspaceMembership(userId, original.workspaceId);
    if (!access.allowed || access.role === 'VIEWER') {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Insufficient permission to duplicate document' },
      });
      return;
    }

    const duplicated = await prisma.document.create({
      data: {
        workspaceId: original.workspaceId,
        creatorId: userId,
        folderId: original.folderId,
        parentId: original.parentId,
        title: `${original.title} (Copy)`,
        icon: original.icon,
        coverImage: original.coverImage,
        content: original.content as any,
        plainText: original.plainText,
        status: 'DRAFT',
        version: 1,
        orderIndex: original.orderIndex + 0.1,
        tags: {
          create: original.tags.map((t) => ({
            tagId: t.tagId,
          })),
        },
      },
      include: {
        folder: { select: { id: true, name: true, icon: true } },
        tags: { select: { tag: { select: { id: true, name: true, color: true } } } },
      },
    });

    await prisma.documentActivity.create({
      data: {
        documentId: duplicated.id,
        userId,
        action: 'DUPLICATED',
        metadata: { originalId: original.id },
      },
    });

    res.status(201).json({
      success: true,
      data: {
        document: {
          ...duplicated,
          tags: duplicated.tags.map((t) => t.tag),
        },
      },
    });
  } catch (error) {
    console.error('Duplicate document error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to duplicate document' },
    });
  }
});

// ─── POST /api/documents/bulk (Bulk Actions) ──────────────────────────────────
router.post('/bulk', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { action, documentIds, targetFolderId } = req.body;

    if (!Array.isArray(documentIds) || documentIds.length === 0) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'documentIds array is required' },
      });
      return;
    }

    const ws = await resolveWorkspaceContext(req);
    const workspaceId = ws.workspaceId;

    if (action === 'trash') {
      await prisma.document.updateMany({
        where: { id: { in: documentIds }, workspaceId },
        data: { isDeleted: true, deletedAt: new Date() },
      });
    } else if (action === 'restore') {
      await prisma.document.updateMany({
        where: { id: { in: documentIds }, workspaceId },
        data: { isDeleted: false, deletedAt: null },
      });
    } else if (action === 'archive') {
      await prisma.document.updateMany({
        where: { id: { in: documentIds }, workspaceId },
        data: { isArchived: true },
      });
    } else if (action === 'unarchive') {
      await prisma.document.updateMany({
        where: { id: { in: documentIds }, workspaceId },
        data: { isArchived: false },
      });
    } else if (action === 'move') {
      await prisma.document.updateMany({
        where: { id: { in: documentIds }, workspaceId },
        data: { folderId: targetFolderId || null },
      });
    } else if (action === 'favorite') {
      await prisma.document.updateMany({
        where: { id: { in: documentIds }, workspaceId },
        data: { isFavorite: true },
      });
    } else if (action === 'delete_permanent') {
      await prisma.document.deleteMany({
        where: { id: { in: documentIds }, workspaceId },
      });
    }

    res.json({
      success: true,
      data: { message: `Bulk action '${action}' applied to ${documentIds.length} document(s)` },
    });
  } catch (error) {
    console.error('Bulk documents error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to perform bulk action' },
    });
  }
});

export default router;
