import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';
import { verifyWorkspaceMembership } from '../lib/workspace';

const router = Router();
router.use(authMiddleware);

// ─── GET /api/documents/:id/revisions (List revisions) ───────────────────────
router.get('/:id/revisions', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const documentId = req.params.id as string;

    const document = await prisma.document.findUnique({
      where: { id: documentId },
      select: { id: true, workspaceId: true },
    });

    if (!document) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Document not found' },
      });
      return;
    }

    const access = await verifyWorkspaceMembership(userId, document.workspaceId);
    if (!access.allowed) {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Access denied' },
      });
      return;
    }

    const revisions = await prisma.documentRevision.findMany({
      where: { documentId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        version: true,
        title: true,
        description: true,
        createdAt: true,
        creator: {
          select: { id: true, displayName: true, email: true },
        },
      },
    });

    res.json({
      success: true,
      data: { revisions },
    });
  } catch (error) {
    console.error('List revisions error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to list revisions' },
    });
  }
});

// ─── POST /api/documents/:id/revisions (Create manual snapshot) ──────────────
router.post('/:id/revisions', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const documentId = req.params.id as string;
    const { description = 'Manual Snapshot' } = req.body;

    const document = await prisma.document.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Document not found' },
      });
      return;
    }

    const access = await verifyWorkspaceMembership(userId, document.workspaceId);
    if (!access.allowed || access.role === 'VIEWER') {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Insufficient permission' },
      });
      return;
    }

    const revision = await prisma.documentRevision.create({
      data: {
        documentId,
        creatorId: userId,
        version: document.version,
        title: document.title,
        content: document.content as any,
        description,
      },
      include: {
        creator: { select: { id: true, displayName: true, email: true } },
      },
    });

    res.status(201).json({
      success: true,
      data: { revision },
    });
  } catch (error) {
    console.error('Create snapshot error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to create revision snapshot' },
    });
  }
});

// ─── GET /api/documents/:id/revisions/:revId (Get revision content) ──────────
router.get('/:id/revisions/:revId', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const documentId = req.params.id as string;
    const revId = req.params.revId as string;

    const revision: any = await prisma.documentRevision.findUnique({
      where: { id: revId },
      include: {
        document: { select: { workspaceId: true } },
        creator: { select: { id: true, displayName: true, email: true } },
      },
    });

    if (!revision || revision.documentId !== documentId) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Revision not found' },
      });
      return;
    }

    const access = await verifyWorkspaceMembership(userId, revision.document.workspaceId);
    if (!access.allowed) {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Access denied' },
      });
      return;
    }

    res.json({
      success: true,
      data: { revision },
    });
  } catch (error) {
    console.error('Get revision error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve revision' },
    });
  }
});

// ─── POST /api/documents/:id/revisions/:revId/restore (Restore revision) ──────
router.post('/:id/revisions/:revId/restore', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const documentId = req.params.id as string;
    const revId = req.params.revId as string;

    const revision: any = await prisma.documentRevision.findUnique({
      where: { id: revId },
      include: { document: true },
    });

    if (!revision || revision.documentId !== documentId) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Revision not found' },
      });
      return;
    }

    const access = await verifyWorkspaceMembership(userId, revision.document.workspaceId);

    if (!access.allowed || access.role === 'VIEWER') {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Insufficient permission to restore revision' },
      });
      return;
    }

    // Restore content and increment version
    const updated = await prisma.document.update({
      where: { id: documentId },
      data: {
        title: revision.title,
        content: revision.content as any,
        version: { increment: 1 },
      },
    });

    // Record activity
    await prisma.documentActivity.create({
      data: {
        documentId,
        userId,
        action: 'RESTORED_REVISION',
        metadata: { restoredVersion: revision.version, newVersion: updated.version },
      },
    });

    // Create a new snapshot reflecting the restoration
    await prisma.documentRevision.create({
      data: {
        documentId,
        creatorId: userId,
        version: updated.version,
        title: updated.title,
        content: updated.content as any,
        description: `Restored from revision v${revision.version}`,
      },
    });

    res.json({
      success: true,
      data: { document: updated, message: `Restored to version ${revision.version}` },
    });
  } catch (error) {
    console.error('Restore revision error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to restore revision' },
    });
  }
});

export default router;
