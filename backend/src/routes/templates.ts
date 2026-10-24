import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';
import { resolveWorkspaceContext, verifyWorkspaceMembership } from '../lib/workspace';
import { BUILTIN_TEMPLATES } from '../lib/templates-data';

const router = Router();
router.use(authMiddleware);

// ─── Auto-seed / sync 40 System Templates ─────────────────────────────────────
let isTemplatesSeeded = false;

async function ensureSystemTemplatesSeeded() {
  if (isTemplatesSeeded) return;

  try {
    for (const t of BUILTIN_TEMPLATES) {
      await prisma.documentTemplate.upsert({
        where: { slug: t.slug },
        update: {
          name: t.name,
          category: t.category,
          icon: t.icon,
          description: t.description,
          tags: t.tags || null,
          content: t.content as any,
          isSystem: true,
        },
        create: {
          slug: t.slug,
          name: t.name,
          category: t.category,
          icon: t.icon,
          description: t.description,
          tags: t.tags || null,
          content: t.content as any,
          isSystem: true,
        },
      });
    }
    isTemplatesSeeded = true;
  } catch (err) {
    console.error('Template sync error:', err);
  }
}

// ─── GET /api/templates (List templates with categories & search) ────────────
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const ws = await resolveWorkspaceContext(req);
    const workspaceId = ws.workspaceId;

    await ensureSystemTemplatesSeeded();

    const { category, search, filter } = req.query;

    const where: any = {
      OR: [
        { isSystem: true },
        { workspaceId },
      ],
    };

    if (category && typeof category === 'string' && category !== 'All') {
      where.category = { equals: category, mode: 'insensitive' };
    }

    if (search && typeof search === 'string' && search.trim().length > 0) {
      const q = search.trim();
      where.AND = [
        {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } },
            { tags: { contains: q, mode: 'insensitive' } },
            { slug: { contains: q, mode: 'insensitive' } },
          ],
        },
      ];
    }

    if (filter === 'favorites') {
      where.isFavorite = true;
    }

    const orderBy: any[] = [];
    if (filter === 'recent' || filter === 'popular') {
      orderBy.push({ usageCount: 'desc' });
    }
    orderBy.push({ isSystem: 'desc' });
    orderBy.push({ createdAt: 'desc' });

    const templates = await prisma.documentTemplate.findMany({
      where,
      orderBy,
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        category: true,
        icon: true,
        isSystem: true,
        isFavorite: true,
        usageCount: true,
        tags: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.json({
      success: true,
      data: {
        templates,
        total: templates.length,
      },
    });
  } catch (error) {
    console.error('List templates error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to list templates' },
    });
  }
});

// ─── GET /api/templates/:id (Template detail preview) ─────────────────────────
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    await ensureSystemTemplatesSeeded();

    const template = await prisma.documentTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Template not found' },
      });
      return;
    }

    res.json({
      success: true,
      data: { template },
    });
  } catch (error) {
    console.error('Get template error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve template details' },
    });
  }
});

// ─── POST /api/templates/:id/use (Instantiate document from template) ────────
router.post('/:id/use', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const id = req.params.id as string;
    const { folderId = null, title } = req.body;

    await ensureSystemTemplatesSeeded();

    const template = await prisma.documentTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Template not found' },
      });
      return;
    }

    const ws = await resolveWorkspaceContext(req);
    const docTitle = title && typeof title === 'string' && title.trim().length > 0
      ? title.trim()
      : template.name;

    // Execute atomic creation in transaction
    const [document] = await prisma.$transaction([
      prisma.document.create({
        data: {
          workspaceId: ws.workspaceId,
          creatorId: userId,
          folderId: folderId || null,
          title: docTitle,
          icon: template.icon || '📄',
          content: template.content as any,
          status: 'DRAFT',
          version: 1,
        },
      }),
      prisma.documentTemplate.update({
        where: { id: template.id },
        data: { usageCount: { increment: 1 } },
      }),
    ]);

    // Initial revision snapshot
    await prisma.documentRevision.create({
      data: {
        documentId: document.id,
        creatorId: userId,
        version: 1,
        title: document.title,
        content: template.content as any,
        description: `Created from template: ${template.name}`,
      },
    });

    // Create owner membership for creator
    await prisma.documentMembership.create({
      data: {
        documentId: document.id,
        userId,
        role: 'OWNER',
      },
    });

    // Activity audit
    await prisma.documentActivity.create({
      data: {
        documentId: document.id,
        userId,
        action: 'CREATED_FROM_TEMPLATE',
        metadata: { templateId: template.id, templateName: template.name },
      },
    });

    res.status(201).json({
      success: true,
      data: { document },
    });
  } catch (error) {
    console.error('Instantiate template error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to create document from template' },
    });
  }
});

// ─── POST /api/templates/:id/apply-to-document (Apply template to existing doc) 
router.post('/:id/apply-to-document', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const templateId = req.params.id as string;
    const { documentId } = req.body;

    if (!documentId) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'documentId is required' },
      });
      return;
    }

    const template = await prisma.documentTemplate.findUnique({
      where: { id: templateId },
    });

    if (!template) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Template not found' },
      });
      return;
    }

    const doc = await prisma.document.findUnique({
      where: { id: documentId },
    });

    if (!doc) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Document not found' },
      });
      return;
    }

    // Verify user can edit document
    const access = await verifyWorkspaceMembership(userId, doc.workspaceId);
    if (!access.allowed || access.role === 'VIEWER') {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Insufficient permission to edit document' },
      });
      return;
    }

    const nextVersion = doc.version + 1;

    const [updatedDoc] = await prisma.$transaction([
      prisma.document.update({
        where: { id: documentId },
        data: {
          content: template.content as any,
          icon: template.icon || doc.icon,
          version: nextVersion,
        },
      }),
      prisma.documentTemplate.update({
        where: { id: templateId },
        data: { usageCount: { increment: 1 } },
      }),
      prisma.documentRevision.create({
        data: {
          documentId,
          creatorId: userId,
          version: nextVersion,
          title: doc.title,
          content: template.content as any,
          description: `Applied template blueprint: ${template.name}`,
        },
      }),
      prisma.documentActivity.create({
        data: {
          documentId,
          userId,
          action: 'APPLIED_TEMPLATE',
          metadata: { templateId: template.id, templateName: template.name },
        },
      }),
    ]);

    res.json({
      success: true,
      data: { document: updatedDoc },
    });
  } catch (error) {
    console.error('Apply template error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to apply template to document' },
    });
  }
});

// ─── POST /api/templates/:id/favorite (Toggle template favorite) ──────────────
router.post('/:id/favorite', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const template = await prisma.documentTemplate.findUnique({ where: { id } });

    if (!template) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Template not found' },
      });
      return;
    }

    const updated = await prisma.documentTemplate.update({
      where: { id },
      data: { isFavorite: !template.isFavorite },
    });

    res.json({
      success: true,
      data: { template: updated },
    });
  } catch (error) {
    console.error('Toggle template favorite error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to update favorite status' },
    });
  }
});

// ─── POST /api/templates/:id/duplicate (Duplicate template) ───────────────────
router.post('/:id/duplicate', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const id = req.params.id as string;
    const ws = await resolveWorkspaceContext(req);

    const source = await prisma.documentTemplate.findUnique({ where: { id } });
    if (!source) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Source template not found' },
      });
      return;
    }

    const cloned = await prisma.documentTemplate.create({
      data: {
        workspaceId: ws.workspaceId,
        creatorId: userId,
        name: `${source.name} (Copy)`,
        description: source.description,
        category: source.category,
        icon: source.icon,
        content: source.content as any,
        tags: source.tags,
        isSystem: false,
      },
    });

    res.status(201).json({
      success: true,
      data: { template: cloned },
    });
  } catch (error) {
    console.error('Duplicate template error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to duplicate template' },
    });
  }
});

// ─── POST /api/templates/save-document (Save existing doc as template) ───────
router.post('/save-document', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { documentId, name, description, category = 'General' } = req.body;

    const doc = await prisma.document.findUnique({
      where: { id: documentId },
    });

    if (!doc) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Document not found' },
      });
      return;
    }

    const template = await prisma.documentTemplate.create({
      data: {
        workspaceId: doc.workspaceId,
        creatorId: userId,
        name: name?.trim() || `${doc.title} Template`,
        description: description?.trim() || `Saved blueprint from ${doc.title}`,
        category,
        icon: doc.icon || '📋',
        content: doc.content as any,
        isSystem: false,
      },
    });

    res.status(201).json({
      success: true,
      data: { template },
    });
  } catch (error) {
    console.error('Save document as template error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to save document as template' },
    });
  }
});

// ─── DELETE /api/templates/:id (Delete user-owned custom template) ────────────
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const id = req.params.id as string;

    const template = await prisma.documentTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Template not found' },
      });
      return;
    }

    if (template.isSystem) {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'System built-in templates cannot be deleted' },
      });
      return;
    }

    if (template.creatorId !== userId) {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Only the template creator can delete this custom template' },
      });
      return;
    }

    await prisma.documentTemplate.delete({ where: { id } });

    res.json({
      success: true,
      data: { message: 'Custom template deleted successfully' },
    });
  } catch (error) {
    console.error('Delete template error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to delete template' },
    });
  }
});

export default router;
