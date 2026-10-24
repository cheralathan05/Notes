import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';
import { resolveWorkspaceContext, verifyWorkspaceMembership } from '../lib/workspace';

const router = Router();
router.use(authMiddleware);

// ─── GET /api/search (Workspace search with snippet extraction) ──────────────
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const ws = await resolveWorkspaceContext(req);
    const workspaceId = ws.workspaceId;

    const access = await verifyWorkspaceMembership(userId, workspaceId);
    if (!access.allowed) {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Access denied' },
      });
      return;
    }

    const { q, tag, folderId, status } = req.query;
    const query = typeof q === 'string' ? q.trim() : '';

    if (!query) {
      res.json({
        success: true,
        data: { results: [] },
      });
      return;
    }

    const where: any = {
      workspaceId,
      isDeleted: false,
      OR: [
        { title: { contains: query, mode: 'insensitive' } },
        { plainText: { contains: query, mode: 'insensitive' } },
      ],
    };

    if (folderId && typeof folderId === 'string') {
      where.folderId = folderId;
    }

    if (status && typeof status === 'string') {
      where.status = status as any;
    }

    if (tag && typeof tag === 'string') {
      where.tags = {
        some: { tag: { name: tag } },
      };
    }

    const documents = await prisma.document.findMany({
      where,
      take: 25,
      select: {
        id: true,
        title: true,
        icon: true,
        plainText: true,
        status: true,
        updatedAt: true,
        folder: { select: { id: true, name: true, icon: true } },
      },
    });

    // Score and generate snippet
    const results = documents.map((doc) => {
      const titleLower = doc.title.toLowerCase();
      const contentLower = (doc.plainText || '').toLowerCase();
      const queryLower = query.toLowerCase();

      let score = 0;
      if (titleLower === queryLower) score += 100;
      else if (titleLower.includes(queryLower)) score += 50;

      let snippet = '';
      const matchIndex = contentLower.indexOf(queryLower);
      if (matchIndex !== -1) {
        score += 20;
        const start = Math.max(0, matchIndex - 40);
        const end = Math.min(contentLower.length, matchIndex + queryLower.length + 60);
        snippet = (start > 0 ? '...' : '') + (doc.plainText || '').slice(start, end).trim() + (end < contentLower.length ? '...' : '');
      } else {
        snippet = (doc.plainText || '').slice(0, 100).trim();
      }

      return {
        id: doc.id,
        title: doc.title,
        icon: doc.icon || '📄',
        folder: doc.folder,
        snippet,
        score,
        updatedAt: doc.updatedAt,
      };
    });

    results.sort((a, b) => b.score - a.score);

    res.json({
      success: true,
      data: { results },
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to execute search' },
    });
  }
});

// ─── GET /api/search/recent (Recent and frequently accessed) ─────────────────
router.get('/recent', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const ws = await resolveWorkspaceContext(req);
    const workspaceId = ws.workspaceId;

    const documents = await prisma.document.findMany({
      where: {
        workspaceId,
        isDeleted: false,
      },
      orderBy: { updatedAt: 'desc' },
      take: 8,
      select: {
        id: true,
        title: true,
        icon: true,
        status: true,
        updatedAt: true,
        folder: { select: { id: true, name: true, icon: true } },
      },
    });

    res.json({
      success: true,
      data: { documents },
    });
  } catch (error) {
    console.error('Recent documents error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve recent documents' },
    });
  }
});

export default router;
