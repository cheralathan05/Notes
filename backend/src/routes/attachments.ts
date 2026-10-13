import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';
import { verifyWorkspaceMembership } from '../lib/workspace';

const router = Router();
router.use(authMiddleware);

// Ensure uploads directory exists
const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueKey = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}${ext}`;
    cb(null, uniqueKey);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB max
  },
  fileFilter: (_req, file, cb) => {
    // Disallow dangerous executables
    const disallowedExts = ['.exe', '.bat', '.cmd', '.sh', '.vbs', '.msi'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (disallowedExts.includes(ext)) {
      cb(new Error('Executable and script file uploads are prohibited for security'));
      return;
    }
    cb(null, true);
  },
});

// ─── POST /api/documents/:id/attachments (Upload file/image) ──────────────────
router.post('/:id/attachments', upload.single('file'), async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const documentId = req.params.id as string;
    const file = req.file;

    if (!file) {
      res.status(400).json({
        success: false,
        error: { code: 'NO_FILE', message: 'No file was provided in the upload request' },
      });
      return;
    }

    const document = await prisma.document.findUnique({
      where: { id: documentId },
      select: { id: true, workspaceId: true },
    });

    if (!document) {
      // Clean up orphaned upload
      fs.unlinkSync(file.path);
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Document not found' },
      });
      return;
    }

    const access = await verifyWorkspaceMembership(userId, document.workspaceId);
    if (!access.allowed || access.role === 'VIEWER') {
      fs.unlinkSync(file.path);
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Insufficient permission to upload attachments' },
      });
      return;
    }

    const relativeUrl = `/api/attachments/raw/${file.filename}`;

    const attachment = await prisma.documentAttachment.create({
      data: {
        documentId,
        uploaderId: userId,
        filename: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        storageKey: file.filename,
        url: relativeUrl,
      },
      include: {
        uploader: { select: { id: true, displayName: true, email: true } },
      },
    });

    res.status(201).json({
      success: true,
      data: { attachment },
    });
  } catch (error: any) {
    console.error('Upload attachment error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message || 'Failed to upload attachment' },
    });
  }
});

// ─── GET /api/documents/:id/attachments (List attachments) ───────────────────
router.get('/:id/attachments', async (req: Request, res: Response): Promise<void> => {
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

    const attachments = await prisma.documentAttachment.findMany({
      where: { documentId },
      orderBy: { createdAt: 'desc' },
      include: {
        uploader: { select: { id: true, displayName: true, email: true } },
      },
    });

    res.json({
      success: true,
      data: { attachments },
    });
  } catch (error) {
    console.error('List attachments error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to list attachments' },
    });
  }
});

// ─── GET /api/attachments/:id/download (Authenticated download) ──────────────
router.get('/download/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const id = req.params.id as string;

    const attachment = await prisma.documentAttachment.findUnique({
      where: { id },
      include: {
        document: { select: { workspaceId: true } },
      },
    });

    if (!attachment) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Attachment not found' },
      });
      return;
    }

    const access = await verifyWorkspaceMembership(userId, attachment.document.workspaceId);
    if (!access.allowed) {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Access denied' },
      });
      return;
    }

    const filePath = path.join(UPLOADS_DIR, attachment.storageKey);
    if (!fs.existsSync(filePath)) {
      res.status(404).json({
        success: false,
        error: { code: 'FILE_MISSING', message: 'Underlying file is missing or deleted from storage' },
      });
      return;
    }

    res.download(filePath, attachment.filename);
  } catch (error) {
    console.error('Download attachment error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to download attachment' },
    });
  }
});

// ─── GET /api/attachments/raw/:storageKey (Serve file for previews/images) ───
router.get('/raw/:storageKey', async (req: Request, res: Response): Promise<void> => {
  try {
    const storageKey = req.params.storageKey as string;
    const filePath = path.join(UPLOADS_DIR, storageKey);

    if (!fs.existsSync(filePath)) {
      res.status(404).json({
        success: false,
        error: { code: 'FILE_MISSING', message: 'File not found' },
      });
      return;
    }

    res.sendFile(filePath);
  } catch (error) {
    console.error('Serve raw file error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to serve file' },
    });
  }
});

// ─── DELETE /api/attachments/:id (Delete attachment) ─────────────────────────
router.delete('/:id', async (req: Request, res: Response, next): Promise<void> => {
  if (req.baseUrl.startsWith('/api/documents')) {
    return next();
  }

  try {
    const userId = req.userId!;
    const id = req.params.id as string;

    const attachment = await prisma.documentAttachment.findUnique({
      where: { id },
      include: {
        document: { select: { workspaceId: true } },
      },
    });

    if (!attachment) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Attachment not found' },
      });
      return;
    }

    const access = await verifyWorkspaceMembership(userId, attachment.document.workspaceId);
    if (!access.allowed || access.role === 'VIEWER') {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Insufficient permission to delete attachment' },
      });
      return;
    }

    const filePath = path.join(UPLOADS_DIR, attachment.storageKey);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    await prisma.documentAttachment.delete({ where: { id } });

    res.json({
      success: true,
      data: { message: 'Attachment removed successfully' },
    });
  } catch (error) {
    console.error('Delete attachment error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to delete attachment' },
    });
  }
});

export default router;
