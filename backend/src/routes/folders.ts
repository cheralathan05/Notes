import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';
import { getOrCreateUserWorkspace, verifyWorkspaceMembership } from '../lib/workspace';

const router = Router();
router.use(authMiddleware);

// ─── GET /api/folders (List folders) ─────────────────────────────────────────
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const ws = await getOrCreateUserWorkspace(userId);
    const workspaceId = (req.query.workspaceId as string) || ws.workspaceId;

    const access = await verifyWorkspaceMembership(userId, workspaceId);
    if (!access.allowed) {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Access denied' },
      });
      return;
    }

    const folders = await prisma.folder.findMany({
      where: { workspaceId },
      orderBy: { orderIndex: 'asc' },
      include: {
        _count: {
          select: {
            documents: { where: { isDeleted: false } },
            children: true,
          },
        },
      },
    });

    res.json({
      success: true,
      data: { folders },
    });
  } catch (error) {
    console.error('List folders error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to list folders' },
    });
  }
});

// ─── POST /api/folders (Create folder) ───────────────────────────────────────
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const ws = await getOrCreateUserWorkspace(userId);
    const workspaceId = req.body.workspaceId || ws.workspaceId;

    const access = await verifyWorkspaceMembership(userId, workspaceId);
    if (!access.allowed || access.role === 'VIEWER') {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Insufficient permission to create folders' },
      });
      return;
    }

    const { name = 'New Folder', parentId = null, icon = '📁', color = '#737373' } = req.body;

    const maxFolder = await prisma.folder.findFirst({
      where: { workspaceId, parentId: parentId || null },
      orderBy: { orderIndex: 'desc' },
      select: { orderIndex: true },
    });
    const orderIndex = (maxFolder?.orderIndex ?? 0) + 1;

    const folder = await prisma.folder.create({
      data: {
        workspaceId,
        creatorId: userId,
        name: name.trim() || 'New Folder',
        parentId: parentId || null,
        icon,
        color,
        orderIndex,
      },
      include: {
        _count: {
          select: { documents: true, children: true },
        },
      },
    });

    res.status(201).json({
      success: true,
      data: { folder },
    });
  } catch (error) {
    console.error('Create folder error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to create folder' },
    });
  }
});

// ─── PATCH /api/folders/:id (Update folder) ──────────────────────────────────
router.patch('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const id = req.params.id as string;

    const folder = await prisma.folder.findUnique({
      where: { id },
    });

    if (!folder) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Folder not found' },
      });
      return;
    }

    const access = await verifyWorkspaceMembership(userId, folder.workspaceId);
    if (!access.allowed || access.role === 'VIEWER') {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Insufficient permission to update folder' },
      });
      return;
    }

    const { name, icon, color, parentId, orderIndex } = req.body;
    const updateData: any = {};
    if (name !== undefined) updateData.name = name.trim();
    if (icon !== undefined) updateData.icon = icon;
    if (color !== undefined) updateData.color = color;
    if (parentId !== undefined) updateData.parentId = parentId || null;
    if (orderIndex !== undefined) updateData.orderIndex = orderIndex;

    const updated = await prisma.folder.update({
      where: { id },
      data: updateData,
      include: {
        _count: {
          select: { documents: true, children: true },
        },
      },
    });

    res.json({
      success: true,
      data: { folder: updated },
    });
  } catch (error) {
    console.error('Update folder error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to update folder' },
    });
  }
});

// ─── DELETE /api/folders/:id (Delete folder) ─────────────────────────────────
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const id = req.params.id as string;

    const folder = await prisma.folder.findUnique({
      where: { id },
    });

    if (!folder) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Folder not found' },
      });
      return;
    }

    const access = await verifyWorkspaceMembership(userId, folder.workspaceId);
    if (!access.allowed || access.role === 'VIEWER') {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Insufficient permission to delete folder' },
      });
      return;
    }

    // Unlink documents and subfolders before deleting
    await prisma.$transaction([
      prisma.document.updateMany({
        where: { folderId: id },
        data: { folderId: null },
      }),
      prisma.folder.updateMany({
        where: { parentId: id },
        data: { parentId: null },
      }),
      prisma.folder.delete({
        where: { id },
      }),
    ]);

    res.json({
      success: true,
      data: { message: 'Folder deleted and contents moved to root' },
    });
  } catch (error) {
    console.error('Delete folder error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to delete folder' },
    });
  }
});

export default router;
