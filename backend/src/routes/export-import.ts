import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';
import { resolveWorkspaceContext, verifyWorkspaceMembership } from '../lib/workspace';

const router = Router();
router.use(authMiddleware);

// ─── TipTap Converters ───────────────────────────────────────────────────────

function convertToMarkdown(content: any): string {
  if (!content || !content.content) return '';
  let md = '';

  function processNode(node: any): string {
    if (!node) return '';
    if (node.type === 'text') {
      let t = node.text || '';
      if (node.marks) {
        for (const mark of node.marks) {
          if (mark.type === 'bold') t = `**${t}**`;
          if (mark.type === 'italic') t = `*${t}*`;
          if (mark.type === 'code') t = `\`${t}\``;
          if (mark.type === 'strike') t = `~~${t}~~`;
          if (mark.type === 'link') t = `[${t}](${mark.attrs?.href || ''})`;
        }
      }
      return t;
    }

    const children = (node.content || []).map(processNode).join('');

    switch (node.type) {
      case 'heading': {
        const level = node.attrs?.level || 1;
        const prefix = '#'.repeat(level);
        return `${prefix} ${children}\n\n`;
      }
      case 'paragraph':
        return `${children}\n\n`;
      case 'bulletList':
        return `${children}\n`;
      case 'orderedList':
        return `${children}\n`;
      case 'listItem':
        return `- ${children.trim()}\n`;
      case 'taskList':
        return `${children}\n`;
      case 'taskItem':
        return `- [${node.attrs?.checked ? 'x' : ' '}] ${children.trim()}\n`;
      case 'blockquote':
        return `> ${children.trim()}\n\n`;
      case 'codeBlock':
        return `\`\`\`${node.attrs?.language || ''}\n${children}\`\`\`\n\n`;
      case 'horizontalRule':
        return `---\n\n`;
      case 'table':
        return `\n${children}\n`;
      case 'tableRow':
        return `| ${children}\n`;
      case 'tableCell':
      case 'tableHeader':
        return `${children} | `;
      default:
        return children;
    }
  }

  for (const node of content.content) {
    md += processNode(node);
  }

  return md.trim();
}

function convertToHtml(title: string, content: any): string {
  const md = convertToMarkdown(content);
  // Render clean semantic HTML with print-ready monochrome typography
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.6;
      color: #111;
      background: #fff;
      max-width: 800px;
      margin: 40px auto;
      padding: 0 20px;
    }
    h1, h2, h3 { color: #000; font-weight: 600; margin-top: 1.5em; }
    h1 { font-size: 2.2em; border-bottom: 1px solid #ddd; padding-bottom: 0.3em; }
    h2 { font-size: 1.6em; }
    h3 { font-size: 1.25em; }
    code { background: #f4f4f4; padding: 2px 6px; border-radius: 3px; font-family: monospace; font-size: 0.9em; }
    pre { background: #f4f4f4; padding: 16px; border-radius: 4px; overflow-x: auto; }
    blockquote { border-left: 3px solid #666; margin: 0; padding-left: 16px; color: #444; }
    table { border-collapse: collapse; width: 100%; margin: 16px 0; }
    th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }
    th { background: #f9f9f9; }
    @media print {
      body { max-width: 100%; margin: 0; padding: 15mm; }
    }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <div class="content">
    ${md.replace(/\n\n/g, '<br><br>').replace(/### (.*)/g, '<h3>$1</h3>').replace(/## (.*)/g, '<h2>$1</h2>').replace(/# (.*)/g, '<h1>$1</h1>')}
  </div>
</body>
</html>`;
}

// ─── GET /api/documents/:id/export (Export document) ─────────────────────────
router.get('/:id/export', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const documentId = req.params.id as string;
    const format = (req.query.format as string) || 'markdown';

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

    const access = await verifyWorkspaceMembership(userId, doc.workspaceId);
    if (!access.allowed) {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Access denied' },
      });
      return;
    }

    const safeTitle = doc.title.replace(/[^a-z0-9_-]/gi, '_');

    if (format === 'markdown' || format === 'md') {
      const markdown = convertToMarkdown(doc.content);
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${safeTitle}.md"`);
      res.send(markdown);
      return;
    }

    if (format === 'html') {
      const html = convertToHtml(doc.title, doc.content);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${safeTitle}.html"`);
      res.send(html);
      return;
    }

    if (format === 'txt' || format === 'plain') {
      const plain = doc.plainText || convertToMarkdown(doc.content);
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${safeTitle}.txt"`);
      res.send(plain);
      return;
    }

    if (format === 'docx' || format === 'pdf') {
      // Return structured printable HTML which browsers save or print directly to PDF/Docx
      const html = convertToHtml(doc.title, doc.content);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${safeTitle}.html"`);
      res.send(html);
      return;
    }

    res.status(400).json({
      success: false,
      error: { code: 'UNSUPPORTED_FORMAT', message: `Format '${format}' is not supported` },
    });
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to export document' },
    });
  }
});

// ─── POST /api/documents/import (Import text/markdown file) ───────────────────
router.post('/import', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const ws = await resolveWorkspaceContext(req);
    const { title = 'Imported Document', contentText, format = 'markdown', folderId = null } = req.body;

    if (!contentText || typeof contentText !== 'string') {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'contentText string is required' },
      });
      return;
    }

    // Convert raw text/markdown into structured TipTap nodes
    const lines = contentText.split('\n');
    const nodes: any[] = [];

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;

      if (line.startsWith('# ')) {
        nodes.push({ type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: line.replace('# ', '') }] });
      } else if (line.startsWith('## ')) {
        nodes.push({ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: line.replace('## ', '') }] });
      } else if (line.startsWith('### ')) {
        nodes.push({ type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: line.replace('### ', '') }] });
      } else if (line.startsWith('- [ ] ') || line.startsWith('- [x] ')) {
        nodes.push({
          type: 'taskList',
          content: [{
            type: 'taskItem',
            attrs: { checked: line.startsWith('- [x] ') },
            content: [{ type: 'paragraph', content: [{ type: 'text', text: line.replace(/- \[[ x]\] /, '') }] }],
          }],
        });
      } else if (line.startsWith('- ') || line.startsWith('* ')) {
        nodes.push({
          type: 'bulletList',
          content: [{
            type: 'listItem',
            content: [{ type: 'paragraph', content: [{ type: 'text', text: line.replace(/^[\-\*]\s+/, '') }] }],
          }],
        });
      } else if (line.startsWith('> ')) {
        nodes.push({
          type: 'blockquote',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: line.replace(/^>\s*/, '') }] }],
        });
      } else {
        nodes.push({
          type: 'paragraph',
          content: [{ type: 'text', text: line }],
        });
      }
    }

    const documentContent = {
      type: 'doc',
      content: nodes.length > 0 ? nodes : [{ type: 'paragraph', content: [{ type: 'text', text: contentText }] }],
    };

    const document = await prisma.document.create({
      data: {
        workspaceId: ws.workspaceId,
        creatorId: userId,
        folderId: folderId || null,
        title: title.trim(),
        content: documentContent,
        plainText: contentText,
        status: 'DRAFT',
        version: 1,
      },
    });

    await prisma.documentRevision.create({
      data: {
        documentId: document.id,
        creatorId: userId,
        version: 1,
        title: document.title,
        content: documentContent,
        description: `Imported via ${format.toUpperCase()}`,
      },
    });

    res.status(201).json({
      success: true,
      data: { document },
    });
  } catch (error) {
    console.error('Import error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to import document' },
    });
  }
});

// ─── GET /api/documents/export-all (Bulk export) ──────────────────────────────
router.get('/export-all', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const ws = await resolveWorkspaceContext(req);

    const documents = await prisma.document.findMany({
      where: { workspaceId: ws.workspaceId, isDeleted: false },
      select: {
        id: true,
        title: true,
        content: true,
        plainText: true,
        createdAt: true,
        updatedAt: true,
        folder: { select: { name: true } },
      },
    });

    const exportBundle = {
      workspace: ws.workspaceName,
      exportedAt: new Date().toISOString(),
      documentsCount: documents.length,
      documents: documents.map((d) => ({
        id: d.id,
        title: d.title,
        folder: d.folder?.name || 'Root',
        markdown: convertToMarkdown(d.content),
        plainText: d.plainText,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
      })),
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="kronos-workspace-export-${Date.now()}.json"`);
    res.send(JSON.stringify(exportBundle, null, 2));
  } catch (error) {
    console.error('Bulk export error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to perform bulk export' },
    });
  }
});

// ─── POST /api/documents/restore-backup (Restore workspace from backup) ──────
router.post('/restore-backup', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const ws = await resolveWorkspaceContext(req);
    const { documents } = req.body;

    if (!Array.isArray(documents) || documents.length === 0) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Array of documents required for backup restoration' },
      });
      return;
    }

    const restoredDocs = [];
    for (const doc of documents) {
      if (!doc.title) continue;
      const created = await prisma.document.create({
        data: {
          workspaceId: ws.workspaceId,
          creatorId: userId,
          title: doc.title,
          content: doc.content || {
            type: 'doc',
            content: [{ type: 'paragraph', content: [{ type: 'text', text: doc.plainText || doc.markdown || '' }] }],
          },
          plainText: doc.plainText || doc.markdown || '',
          status: 'DRAFT',
          version: 1,
        },
      });
      restoredDocs.push(created);
    }

    res.status(200).json({
      success: true,
      data: {
        restoredCount: restoredDocs.length,
        documents: restoredDocs,
      },
    });
  } catch (error) {
    console.error('Backup recovery error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to restore backup' },
    });
  }
});

export default router;
