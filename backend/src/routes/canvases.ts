import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';
import { resolveWorkspaceContext } from '../lib/workspace';
import { broadcastCollaborationEvent } from '../lib/realtime';
import * as crypto from 'crypto';

const router = Router();
router.use(authMiddleware);

// Strict multi-tenant workspace isolation guard
router.use(async (req: Request, res: Response, next) => {
  try {
    const requestedWs = (req.headers['x-workspace-id'] as string) || (req.headers['x-atlas-workspace'] as string) || (req.query?.workspaceId as string);
    if (requestedWs && req.userId) {
      const membership = await prisma.workspaceMember.findUnique({
        where: {
          workspaceId_userId: {
            workspaceId: requestedWs,
            userId: req.userId,
          },
        },
      });
      if (!membership) {
        res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Access denied: You are not a member of this workspace' },
        });
        return;
      }
    }
    next();
  } catch (err) {
    next(err);
  }
});

// Verified Architecture Blueprints
export const ARCHITECTURE_BLUEPRINTS: Record<string, any> = {
  monolith: {
    title: 'Monolithic Sovereign Architecture',
    description: 'Single-repo full-stack SaaS with unified API, database, and real-time streaming',
    data: {
      nodes: [
        { id: 'n-fe', type: 'frontend', title: 'Next.js 16 Web Client', description: 'SSR + Client App Router', x: 80, y: 160, color: '#3B82F6', icon: 'Globe' },
        { id: 'n-api', type: 'api', title: 'Express Monolithic Core', description: 'REST APIs & WebSockets on :4000', x: 420, y: 160, color: '#10B981', icon: 'Server' },
        { id: 'n-db', type: 'db', title: 'PostgreSQL Database', description: 'Multi-tenant relational source of truth', x: 780, y: 160, color: '#8B5CF6', icon: 'Database' },
        { id: 'n-rt', type: 'cache', title: 'Realtime SSE Hub', description: 'In-memory presence and event pub/sub', x: 420, y: 340, color: '#EF4444', icon: 'Cpu' },
        { id: 'n-job', type: 'cloud', title: 'Background Mailer & Tasks', description: 'SMTP emailer & async workers', x: 780, y: 340, color: '#F59E0B', icon: 'Cloud' },
      ],
      connections: [
        { from: 'n-fe', to: 'n-api', label: 'HTTP / REST' },
        { from: 'n-api', to: 'n-db', label: 'Prisma Client ORM' },
        { from: 'n-api', to: 'n-rt', label: 'Event Streaming' },
        { from: 'n-api', to: 'n-job', label: 'Async Queue' },
      ],
      notes: [
        { id: 'memo-1', text: 'All modules integrated into one sovereign monolithic repo for zero network latency and maximum developer velocity.', x: 120, y: 380, color: '#10B981' }
      ]
    }
  },
  microservices: {
    title: 'Event-Driven Microservices Architecture',
    description: 'Distributed microservices communicating via an API Gateway and asynchronous message broker',
    data: {
      nodes: [
        { id: 'ms-gw', type: 'api', title: 'API Gateway & Auth', description: 'Rate limiting & route dispatching', x: 100, y: 160, color: '#10B981', icon: 'Server' },
        { id: 'ms-auth', type: 'auth', title: 'Auth Service', description: 'JWT & OAuth2 Identity Provider', x: 400, y: 80, color: '#6366F1', icon: 'Shield' },
        { id: 'ms-core', type: 'api', title: 'Core Workspace API', description: 'Tenants & document service', x: 400, y: 220, color: '#3B82F6', icon: 'Server' },
        { id: 'ms-bus', type: 'queue', title: 'Kafka / Redis Event Bus', description: 'Distributed messaging log', x: 720, y: 160, color: '#F59E0B', icon: 'Cpu' },
        { id: 'ms-db', type: 'db', title: 'Sharded Postgres Cluster', description: 'Isolated tenant data stores', x: 720, y: 340, color: '#8B5CF6', icon: 'Database' },
      ],
      connections: [
        { from: 'ms-gw', to: 'ms-auth', label: 'Token Verification' },
        { from: 'ms-gw', to: 'ms-core', label: 'gRPC / Internal' },
        { from: 'ms-core', to: 'ms-bus', label: 'Publish Events' },
        { from: 'ms-core', to: 'ms-db', label: 'SQL Read/Write' },
      ],
      notes: [
        { id: 'memo-ms', text: 'Decoupled domain boundaries with independent scaling and isolated failure domains.', x: 100, y: 340, color: '#3B82F6' }
      ]
    }
  },
  ai_pipeline: {
    title: 'Modern AI / LLM Streaming Pipeline',
    description: 'High-throughput RAG pipeline with vector search, LLM streaming, and async inference jobs',
    data: {
      nodes: [
        { id: 'ai-client', type: 'frontend', title: 'Prompt Studio UI', description: 'Realtime token streaming UI', x: 80, y: 160, color: '#3B82F6', icon: 'Globe' },
        { id: 'ai-orch', type: 'api', title: 'Agent Orchestrator', description: 'Context window & tool calls', x: 400, y: 160, color: '#10B981', icon: 'Server' },
        { id: 'ai-vec', type: 'db', title: 'pgvector / Embeddings', description: 'Cosine distance semantic index', x: 760, y: 100, color: '#8B5CF6', icon: 'Database' },
        { id: 'ai-llm', type: 'external', title: 'LLM Inference Engine', description: 'Anthropic / OpenAI API cluster', x: 760, y: 260, color: '#EC4899', icon: 'Cpu' },
      ],
      connections: [
        { from: 'ai-client', to: 'ai-orch', label: 'SSE Stream' },
        { from: 'ai-orch', to: 'ai-vec', label: 'Vector Similarity' },
        { from: 'ai-orch', to: 'ai-llm', label: 'Inference Stream' },
      ],
      notes: [
        { id: 'memo-ai', text: 'Embeddings indexed directly in PostgreSQL using pgvector HNSW indexes.', x: 120, y: 340, color: '#8B5CF6' }
      ]
    }
  }
};

/**
 * Validates canvas data structure to ensure valid nodes and connections.
 */
function validateCanvasData(data: any): { valid: boolean; cleanedData: any; error?: string } {
  if (!data || typeof data !== 'object') {
    return {
      valid: true,
      cleanedData: { nodes: [], connections: [], notes: [] },
    };
  }

  const nodes = Array.isArray(data.nodes) ? data.nodes : [];
  const connections = Array.isArray(data.connections) ? data.connections : [];
  const notes = Array.isArray(data.notes) ? data.notes : [];

  // Clean and sanitize nodes
  const validNodeIds = new Set<string>();
  const cleanedNodes = nodes.map((n: any, idx: number) => {
    const id = String(n.id || `node-${idx}-${Date.now()}`);
    validNodeIds.add(id);
    return {
      id,
      type: String(n.type || 'generic'),
      title: String(n.title || 'Component').trim().slice(0, 100),
      description: n.description ? String(n.description).trim().slice(0, 250) : '',
      x: typeof n.x === 'number' && !isNaN(n.x) ? Math.round(n.x) : 100,
      y: typeof n.y === 'number' && !isNaN(n.y) ? Math.round(n.y) : 100,
      color: n.color ? String(n.color).slice(0, 30) : '#3B82F6',
      icon: n.icon ? String(n.icon).slice(0, 50) : 'Globe',
    };
  });

  // Filter out connections with invalid endpoints
  const cleanedConnections = connections
    .filter((c: any) => c && c.from && c.to && validNodeIds.has(String(c.from)) && validNodeIds.has(String(c.to)))
    .map((c: any) => ({
      from: String(c.from),
      to: String(c.to),
      label: c.label ? String(c.label).trim().slice(0, 80) : '',
    }));

  // Clean notes
  const cleanedNotes = notes.map((note: any, idx: number) => ({
    id: String(note.id || `note-${idx}-${Date.now()}`),
    text: String(note.text || '').trim().slice(0, 1000),
    x: typeof note.x === 'number' && !isNaN(note.x) ? Math.round(note.x) : 150,
    y: typeof note.y === 'number' && !isNaN(note.y) ? Math.round(note.y) : 150,
    color: note.color ? String(note.color).slice(0, 30) : '#F59E0B',
  }));

  return {
    valid: true,
    cleanedData: {
      nodes: cleanedNodes,
      connections: cleanedConnections,
      notes: cleanedNotes,
    },
  };
}

// ─── GET /api/canvases/templates ────────────────────────────────────────────
router.get('/templates', async (_req: Request, res: Response): Promise<void> => {
  res.json({
    success: true,
    data: { templates: ARCHITECTURE_BLUEPRINTS },
  });
});

// ─── GET /api/canvases ──────────────────────────────────────────────────────
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const ws = await resolveWorkspaceContext(req);

    const canvases = await prisma.workspaceCanvas.findMany({
      where: { workspaceId: ws.workspaceId },
      orderBy: { updatedAt: 'desc' },
      include: {
        user: { select: { id: true, displayName: true, email: true, avatarUrl: true } },
      },
    });

    res.json({
      success: true,
      data: { canvases },
    });
  } catch (err: any) {
    console.error('Failed to get canvases:', err);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message } });
  }
});

// ─── POST /api/canvases ─────────────────────────────────────────────────────
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const ws = await resolveWorkspaceContext(req);
    const { title = 'New Architecture Diagram', description, data, isPublic = false } = req.body;

    const validation = validateCanvasData(data || ARCHITECTURE_BLUEPRINTS.monolith.data);

    const canvas = await prisma.workspaceCanvas.create({
      data: {
        workspaceId: ws.workspaceId,
        userId,
        title: title?.trim() || 'New Architecture Diagram',
        description: description?.trim() || null,
        data: validation.cleanedData,
        isPublic: Boolean(isPublic),
      },
      include: {
        user: { select: { id: true, displayName: true, email: true, avatarUrl: true } },
      },
    });

    try {
      broadcastCollaborationEvent('canvas:created', ws.workspaceId, { canvas });
    } catch (e) {}

    res.status(201).json({
      success: true,
      data: { canvas },
    });
  } catch (err: any) {
    console.error('Failed to create canvas:', err);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message } });
  }
});

// ─── GET /api/canvases/:id ──────────────────────────────────────────────────
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const ws = await resolveWorkspaceContext(req);
    const id = (Array.isArray(req.params.id) ? req.params.id[0] : req.params.id) as string;

    const canvas = await prisma.workspaceCanvas.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, displayName: true, email: true, avatarUrl: true } },
      },
    });

    if (!canvas || canvas.workspaceId !== ws.workspaceId) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Canvas not found in current workspace' } });
      return;
    }

    res.json({
      success: true,
      data: { canvas },
    });
  } catch (err: any) {
    console.error('Failed to get canvas:', err);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message } });
  }
});

// ─── PUT /api/canvases/:id ──────────────────────────────────────────────────
router.put('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const ws = await resolveWorkspaceContext(req);
    const id = (Array.isArray(req.params.id) ? req.params.id[0] : req.params.id) as string;
    const { title, description, data, isPublic, thumbnail } = req.body;

    const existing = await prisma.workspaceCanvas.findUnique({
      where: { id },
    });

    if (!existing || existing.workspaceId !== ws.workspaceId) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Canvas not found' } });
      return;
    }

    const updateData: any = {};
    if (title !== undefined) updateData.title = String(title).trim();
    if (description !== undefined) updateData.description = description?.trim() || null;
    if (isPublic !== undefined) updateData.isPublic = Boolean(isPublic);
    if (thumbnail !== undefined) updateData.thumbnail = thumbnail;

    if (data !== undefined) {
      const validation = validateCanvasData(data);
      updateData.data = validation.cleanedData;
    }

    const updated = await prisma.workspaceCanvas.update({
      where: { id },
      data: updateData,
      include: {
        user: { select: { id: true, displayName: true, email: true, avatarUrl: true } },
      },
    });

    try {
      broadcastCollaborationEvent('canvas:updated', ws.workspaceId, { canvas: updated });
    } catch (e) {}

    res.json({
      success: true,
      data: { canvas: updated },
    });
  } catch (err: any) {
    console.error('Failed to update canvas:', err);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message } });
  }
});

// ─── POST /api/canvases/:id/duplicate ───────────────────────────────────────
router.post('/:id/duplicate', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const ws = await resolveWorkspaceContext(req);
    const id = (Array.isArray(req.params.id) ? req.params.id[0] : req.params.id) as string;

    const existing = await prisma.workspaceCanvas.findUnique({
      where: { id },
    });

    if (!existing || existing.workspaceId !== ws.workspaceId) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Canvas not found' } });
      return;
    }

    const origData = existing.data as any;
    const origNodes = Array.isArray(origData?.nodes) ? origData.nodes : [];
    const origConns = Array.isArray(origData?.connections) ? origData.connections : [];
    const origNotes = Array.isArray(origData?.notes) ? origData.notes : [];

    // Map old node IDs to new independent IDs
    const idMap = new Map<string, string>();
    const newNodes = origNodes.map((n: any) => {
      const newId = `node-${crypto.randomBytes(4).toString('hex')}`;
      idMap.set(String(n.id), newId);
      return {
        ...n,
        id: newId,
        x: n.x + 20,
        y: n.y + 20,
      };
    });

    // Re-map connections to new node IDs
    const newConnections = origConns
      .filter((c: any) => idMap.has(String(c.from)) && idMap.has(String(c.to)))
      .map((c: any) => ({
        ...c,
        from: idMap.get(String(c.from))!,
        to: idMap.get(String(c.to))!,
      }));

    // Generate new note IDs
    const newNotes = origNotes.map((note: any) => ({
      ...note,
      id: `note-${crypto.randomBytes(4).toString('hex')}`,
      x: note.x + 20,
      y: note.y + 20,
    }));

    const duplicated = await prisma.workspaceCanvas.create({
      data: {
        workspaceId: ws.workspaceId,
        userId,
        title: `${existing.title} (Copy)`,
        description: existing.description,
        data: {
          nodes: newNodes,
          connections: newConnections,
          notes: newNotes,
        },
        isPublic: existing.isPublic,
      },
      include: {
        user: { select: { id: true, displayName: true, email: true, avatarUrl: true } },
      },
    });

    res.status(201).json({
      success: true,
      data: { canvas: duplicated },
    });
  } catch (err: any) {
    console.error('Failed to duplicate canvas:', err);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message } });
  }
});

// ─── DELETE /api/canvases/:id ───────────────────────────────────────────────
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const ws = await resolveWorkspaceContext(req);
    const id = (Array.isArray(req.params.id) ? req.params.id[0] : req.params.id) as string;

    const existing = await prisma.workspaceCanvas.findUnique({
      where: { id },
    });

    if (!existing || existing.workspaceId !== ws.workspaceId) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Canvas not found' } });
      return;
    }

    if (existing.userId !== userId && ws.role !== 'OWNER' && ws.role !== 'ADMIN') {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Permission denied to delete canvas' } });
      return;
    }

    await prisma.workspaceCanvas.delete({
      where: { id },
    });

    try {
      broadcastCollaborationEvent('canvas:deleted', ws.workspaceId, { canvasId: id });
    } catch (e) {}

    res.json({
      success: true,
      data: { deleted: true, canvasId: id },
    });
  } catch (err: any) {
    console.error('Failed to delete canvas:', err);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message } });
  }
});

export default router;
