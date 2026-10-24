import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';
import { resolveWorkspaceContext } from '../lib/workspace';
import { broadcastCollaborationEvent } from '../lib/realtime';

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

export const DEFAULT_CHANNELS = [
  { name: 'general', description: 'Company-wide announcements and work chatter', topic: 'Company updates & daily sync' },
  { name: 'engineering', description: 'Tech architecture, pull requests, deployments', topic: 'Technical discussion and dev ops' },
  { name: 'design', description: 'UI/UX mockups, prototypes, and design systems', topic: 'Figma review & user experience' },
  { name: 'announcements', description: 'Important milestones, releases, and alerts', topic: 'All-hands announcements' },
  { name: 'random', description: 'Watercooler, pets, music, and casual banter', topic: 'Casual coffee breaks' },
];

/**
 * Ensures default workspace channels are provisioned in the database.
 */
export async function ensureDefaultChannels(workspaceId: string) {
  const existing = await prisma.workspaceChannel.findMany({
    where: { workspaceId },
  });

  if (existing.length === 0) {
    for (const ch of DEFAULT_CHANNELS) {
      await prisma.workspaceChannel.upsert({
        where: {
          workspaceId_name: { workspaceId, name: ch.name },
        },
        create: {
          workspaceId,
          name: ch.name,
          description: ch.description,
          topic: ch.topic,
          isPrivate: false,
        },
        update: {},
      });
    }
  }
}

/**
 * Resolves a channel by ID or name and checks whether the user has access.
 */
export async function resolveAndAuthorizeChannel(
  workspaceId: string,
  channelIdentifier: string,
  userId: string,
  wsRole: string
): Promise<{ channel: any | null; authorized: boolean; reason?: string }> {
  await ensureDefaultChannels(workspaceId);

  let channel = await prisma.workspaceChannel.findFirst({
    where: {
      workspaceId,
      OR: [{ id: channelIdentifier }, { name: channelIdentifier }],
    },
    include: {
      members: { select: { userId: true, role: true } },
    },
  });

  if (!channel) {
    const defaultMeta = DEFAULT_CHANNELS.find((d) => d.name === channelIdentifier.toLowerCase());
    if (defaultMeta) {
      channel = await prisma.workspaceChannel.create({
        data: {
          workspaceId,
          name: defaultMeta.name,
          description: defaultMeta.description,
          topic: defaultMeta.topic,
          isPrivate: false,
        },
        include: { members: { select: { userId: true, role: true } } },
      });
    } else {
      return { channel: null, authorized: false, reason: 'Channel not found' };
    }
  }

  if (!channel.isPrivate) {
    return { channel, authorized: true };
  }

  if (wsRole === 'OWNER' || wsRole === 'ADMIN') {
    return { channel, authorized: true };
  }

  const isMember = channel.members.some((m: any) => m.userId === userId);
  if (!isMember) {
    return { channel, authorized: false, reason: 'Access denied: You are not a member of this private channel' };
  }

  return { channel, authorized: true };
}

/**
 * Basic content sanitizer to strip dangerous scripts or onload vectors while preserving markdown.
 */
function sanitizeMessageContent(content: string): string {
  return content
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '');
}

// ─── GET /api/chat/channels ─────────────────────────────────────────────────
router.get('/channels', async (req: Request, res: Response): Promise<void> => {
  try {
    const ws = await resolveWorkspaceContext(req);
    const userId = req.userId!;
    await ensureDefaultChannels(ws.workspaceId);

    const allChannels = await prisma.workspaceChannel.findMany({
      where: {
        workspaceId: ws.workspaceId,
        isArchived: false,
      },
      include: {
        members: { select: { userId: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Filter channels based on privacy and user membership
    const accessibleChannels = allChannels.filter((ch) => {
      if (!ch.isPrivate) return true;
      if (ws.role === 'OWNER' || ws.role === 'ADMIN') return true;
      return ch.members.some((m) => m.userId === userId);
    });

    const channelStats = await Promise.all(
      accessibleChannels.map(async (ch) => {
        const lastMsg = await prisma.workspaceChannelMessage.findFirst({
          where: {
            workspaceId: ws.workspaceId,
            OR: [{ channel: ch.name }, { channelId: ch.id }],
          },
          orderBy: { createdAt: 'desc' },
          include: {
            user: { select: { id: true, displayName: true, email: true, avatarUrl: true } },
          },
        });

        const count = await prisma.workspaceChannelMessage.count({
          where: {
            workspaceId: ws.workspaceId,
            OR: [{ channel: ch.name }, { channelId: ch.id }],
          },
        });

        return {
          id: ch.id,
          name: ch.name,
          description: ch.description || '',
          topic: ch.topic || '',
          isPrivate: ch.isPrivate,
          isArchived: ch.isArchived,
          createdById: ch.createdById,
          messageCount: count,
          lastMessage: lastMsg
            ? {
                id: lastMsg.id,
                content: lastMsg.content,
                createdAt: lastMsg.createdAt.toISOString(),
                author: lastMsg.user.displayName,
              }
            : null,
        };
      })
    );

    res.json({
      success: true,
      data: { channels: channelStats },
    });
  } catch (err: any) {
    console.error('Failed to get channels:', err);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message } });
  }
});

// ─── POST /api/chat/channels ────────────────────────────────────────────────
router.post('/channels', async (req: Request, res: Response): Promise<void> => {
  try {
    const ws = await resolveWorkspaceContext(req);
    const userId = req.userId!;
    const { name, description, topic, isPrivate = false } = req.body;

    if (!name || typeof name !== 'string') {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Channel name is required' },
      });
      return;
    }

    const normalizedName = name.toLowerCase().trim().replace(/[^a-z0-9_-]/g, '-').replace(/^-+|-+$/g, '');

    if (normalizedName.length < 2 || normalizedName.length > 50) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Channel name must be between 2 and 50 characters' },
      });
      return;
    }

    // Check duplicate
    const existing = await prisma.workspaceChannel.findUnique({
      where: {
        workspaceId_name: { workspaceId: ws.workspaceId, name: normalizedName },
      },
    });

    if (existing) {
      res.status(409).json({
        success: false,
        error: { code: 'DUPLICATE_CHANNEL', message: `Channel #${normalizedName} already exists` },
      });
      return;
    }

    const channel = await prisma.workspaceChannel.create({
      data: {
        workspaceId: ws.workspaceId,
        name: normalizedName,
        description: description?.trim() || null,
        topic: topic?.trim() || null,
        isPrivate: Boolean(isPrivate),
        createdById: userId,
        members: isPrivate
          ? {
              create: {
                userId,
                role: 'OWNER',
              },
            }
          : undefined,
      },
      include: {
        members: { select: { userId: true, role: true } },
      },
    });

    try {
      broadcastCollaborationEvent('chat:channel_created', ws.workspaceId, { channel });
    } catch (e) {}

    res.status(201).json({
      success: true,
      data: { channel },
    });
  } catch (err: any) {
    console.error('Failed to create channel:', err);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message } });
  }
});

// ─── PATCH /api/chat/channels/:id ───────────────────────────────────────────
router.patch('/channels/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const ws = await resolveWorkspaceContext(req);
    const userId = req.userId!;
    const id = (Array.isArray(req.params.id) ? req.params.id[0] : req.params.id) as string;
    const { topic, description, isArchived, name } = req.body;

    const channel = await prisma.workspaceChannel.findFirst({
      where: {
        workspaceId: ws.workspaceId,
        OR: [{ id }, { name: id }],
      },
      include: { members: true },
    });

    if (!channel) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Channel not found' } });
      return;
    }

    // Check permissions
    const isChannelOwner = channel.createdById === userId || channel.members.some((m) => m.userId === userId && m.role === 'OWNER');
    if (!isChannelOwner && ws.role !== 'OWNER' && ws.role !== 'ADMIN') {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Permission denied to edit channel' } });
      return;
    }

    const updateData: any = {};
    if (topic !== undefined) updateData.topic = topic?.trim() || null;
    if (description !== undefined) updateData.description = description?.trim() || null;
    if (isArchived !== undefined) updateData.isArchived = Boolean(isArchived);
    if (name && typeof name === 'string') {
      const normalized = name.toLowerCase().trim().replace(/[^a-z0-9_-]/g, '-');
      if (normalized.length >= 2) updateData.name = normalized;
    }

    const updated = await prisma.workspaceChannel.update({
      where: { id: channel.id },
      data: updateData,
    });

    try {
      broadcastCollaborationEvent('chat:channel_updated', ws.workspaceId, { channel: updated });
    } catch (e) {}

    res.json({
      success: true,
      data: { channel: updated },
    });
  } catch (err: any) {
    console.error('Failed to update channel:', err);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message } });
  }
});

// ─── GET /api/chat/channels/:id/members ─────────────────────────────────────
router.get('/channels/:id/members', async (req: Request, res: Response): Promise<void> => {
  try {
    const ws = await resolveWorkspaceContext(req);
    const userId = req.userId!;
    const id = (Array.isArray(req.params.id) ? req.params.id[0] : req.params.id) as string;

    const access = await resolveAndAuthorizeChannel(ws.workspaceId, id, userId, ws.role);
    if (!access.authorized || !access.channel) {
      res.status(access.channel ? 403 : 404).json({
        success: false,
        error: { code: access.channel ? 'FORBIDDEN' : 'NOT_FOUND', message: access.reason || 'Not authorized' },
      });
      return;
    }

    if (!access.channel.isPrivate) {
      // For public channels, return all workspace members
      const workspaceMembers = await prisma.workspaceMember.findMany({
        where: { workspaceId: ws.workspaceId },
        include: {
          user: { select: { id: true, displayName: true, email: true, avatarUrl: true } },
        },
      });

      res.json({
        success: true,
        data: {
          channelId: access.channel.id,
          isPrivate: false,
          members: workspaceMembers.map((m) => ({
            id: m.id,
            userId: m.userId,
            role: m.role,
            user: m.user,
          })),
        },
      });
      return;
    }

    // For private channels, return explicit channel members
    const members = await prisma.channelMember.findMany({
      where: { channelId: access.channel.id },
      include: {
        user: { select: { id: true, displayName: true, email: true, avatarUrl: true } },
      },
    });

    res.json({
      success: true,
      data: {
        channelId: access.channel.id,
        isPrivate: true,
        members,
      },
    });
  } catch (err: any) {
    console.error('Failed to fetch channel members:', err);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message } });
  }
});

// ─── POST /api/chat/channels/:id/members ────────────────────────────────────
router.post('/channels/:id/members', async (req: Request, res: Response): Promise<void> => {
  try {
    const ws = await resolveWorkspaceContext(req);
    const userId = req.userId!;
    const id = (Array.isArray(req.params.id) ? req.params.id[0] : req.params.id) as string;
    const { targetUserId, role = 'MEMBER' } = req.body;

    if (!targetUserId) {
      res.status(400).json({ success: false, error: { code: 'INVALID_INPUT', message: 'targetUserId is required' } });
      return;
    }

    const access = await resolveAndAuthorizeChannel(ws.workspaceId, id, userId, ws.role);
    if (!access.authorized || !access.channel) {
      res.status(access.channel ? 403 : 404).json({
        success: false,
        error: { code: access.channel ? 'FORBIDDEN' : 'NOT_FOUND', message: access.reason || 'Not authorized' },
      });
      return;
    }

    // Verify target user is in workspace
    const wsMembership = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: { workspaceId: ws.workspaceId, userId: targetUserId },
      },
    });

    if (!wsMembership) {
      res.status(400).json({
        success: false,
        error: { code: 'NOT_WORKSPACE_MEMBER', message: 'Target user is not a member of this workspace' },
      });
      return;
    }

    const membership = await prisma.channelMember.upsert({
      where: {
        channelId_userId: { channelId: access.channel.id, userId: targetUserId },
      },
      create: {
        channelId: access.channel.id,
        userId: targetUserId,
        role: role === 'ADMIN' ? 'ADMIN' : 'MEMBER',
      },
      update: {
        role: role === 'ADMIN' ? 'ADMIN' : 'MEMBER',
      },
      include: {
        user: { select: { id: true, displayName: true, email: true, avatarUrl: true } },
      },
    });

    res.json({
      success: true,
      data: { membership },
    });
  } catch (err: any) {
    console.error('Failed to add channel member:', err);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message } });
  }
});

// ─── DELETE /api/chat/channels/:id/members/:userId ──────────────────────────
router.delete('/channels/:id/members/:targetUserId', async (req: Request, res: Response): Promise<void> => {
  try {
    const ws = await resolveWorkspaceContext(req);
    const userId = req.userId!;
    const id = (Array.isArray(req.params.id) ? req.params.id[0] : req.params.id) as string;
    const targetUserId = (Array.isArray(req.params.targetUserId) ? req.params.targetUserId[0] : req.params.targetUserId) as string;

    const access = await resolveAndAuthorizeChannel(ws.workspaceId, id, userId, ws.role);
    if (!access.authorized || !access.channel) {
      res.status(access.channel ? 403 : 404).json({
        success: false,
        error: { code: access.channel ? 'FORBIDDEN' : 'NOT_FOUND', message: access.reason || 'Not authorized' },
      });
      return;
    }

    if (userId !== targetUserId && ws.role !== 'OWNER' && ws.role !== 'ADMIN') {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Permission denied to remove member' } });
      return;
    }

    await prisma.channelMember.deleteMany({
      where: {
        channelId: access.channel.id,
        userId: targetUserId,
      },
    });

    res.json({
      success: true,
      data: { removed: true, userId: targetUserId },
    });
  } catch (err: any) {
    console.error('Failed to remove channel member:', err);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message } });
  }
});

// ─── GET /api/chat/messages ─────────────────────────────────────────────────
router.get('/messages', async (req: Request, res: Response): Promise<void> => {
  try {
    const ws = await resolveWorkspaceContext(req);
    const userId = req.userId!;
    const channelIdentifier = (req.query.channel as string) || 'general';
    const limit = Math.min(parseInt((req.query.limit as string) || '50', 10), 100);
    const before = req.query.before as string | undefined;

    // Check authorization for channel
    const access = await resolveAndAuthorizeChannel(ws.workspaceId, channelIdentifier, userId, ws.role);
    if (!access.authorized || !access.channel) {
      res.status(access.channel ? 403 : 404).json({
        success: false,
        error: { code: access.channel ? 'FORBIDDEN' : 'NOT_FOUND', message: access.reason || 'Channel access denied' },
      });
      return;
    }

    const whereClause: any = {
      workspaceId: ws.workspaceId,
      OR: [
        { channel: access.channel.name },
        { channelId: access.channel.id },
      ],
    };

    if (before) {
      whereClause.createdAt = { lt: new Date(before) };
    }

    const messages = await prisma.workspaceChannelMessage.findMany({
      where: whereClause,
      orderBy: { createdAt: 'asc' },
      take: limit,
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            email: true,
            avatarUrl: true,
          },
        },
        replyTo: {
          select: {
            id: true,
            content: true,
            user: { select: { displayName: true } },
          },
        },
      },
    });

    res.json({
      success: true,
      data: {
        channel: {
          id: access.channel.id,
          name: access.channel.name,
          topic: access.channel.topic,
          isPrivate: access.channel.isPrivate,
        },
        messages,
      },
    });
  } catch (err: any) {
    console.error('Failed to fetch chat messages:', err);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message } });
  }
});

// ─── POST /api/chat/messages ────────────────────────────────────────────────
router.post('/messages', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const ws = await resolveWorkspaceContext(req);
    const { channel: channelIdentifier = 'general', content, attachments, replyToId } = req.body;

    if (!content || typeof content !== 'string' || !content.trim()) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Message content cannot be empty' },
      });
      return;
    }

    // Verify channel access
    const access = await resolveAndAuthorizeChannel(ws.workspaceId, channelIdentifier, userId, ws.role);
    if (!access.authorized || !access.channel) {
      res.status(access.channel ? 403 : 404).json({
        success: false,
        error: { code: access.channel ? 'FORBIDDEN' : 'NOT_FOUND', message: access.reason || 'Channel access denied' },
      });
      return;
    }

    const cleanContent = sanitizeMessageContent(content.trim());

    // Idempotency check: prevent duplicate submits in the last 2 seconds
    const recentDuplicate = await prisma.workspaceChannelMessage.findFirst({
      where: {
        workspaceId: ws.workspaceId,
        userId,
        channel: access.channel.name,
        content: cleanContent,
        createdAt: { gte: new Date(Date.now() - 2000) },
      },
    });

    if (recentDuplicate) {
      res.status(200).json({
        success: true,
        data: { message: recentDuplicate, deduplicated: true },
      });
      return;
    }

    const message = await prisma.workspaceChannelMessage.create({
      data: {
        workspaceId: ws.workspaceId,
        userId,
        channel: access.channel.name,
        channelId: access.channel.id,
        content: cleanContent,
        attachments: attachments || null,
        replyToId: replyToId || null,
        reactions: {},
      },
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            email: true,
            avatarUrl: true,
          },
        },
        replyTo: {
          select: {
            id: true,
            content: true,
            user: { select: { displayName: true } },
          },
        },
      },
    });

    // Broadcast message via realtime SSE
    try {
      broadcastCollaborationEvent('chat:message', ws.workspaceId, {
        message,
        channel: access.channel.name,
        channelId: access.channel.id,
      });
    } catch (e) {
      // Non-fatal broadcast failure
    }

    res.status(201).json({
      success: true,
      data: { message },
    });
  } catch (err: any) {
    console.error('Failed to post chat message:', err);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message } });
  }
});

// ─── PATCH /api/chat/messages/:id ───────────────────────────────────────────
router.patch('/messages/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const ws = await resolveWorkspaceContext(req);
    const id = (Array.isArray(req.params.id) ? req.params.id[0] : req.params.id) as string;
    const { content } = req.body;

    if (!content || typeof content !== 'string' || !content.trim()) {
      res.status(400).json({ success: false, error: { code: 'INVALID_INPUT', message: 'Message content cannot be empty' } });
      return;
    }

    const message = await prisma.workspaceChannelMessage.findUnique({
      where: { id },
    });

    if (!message || message.workspaceId !== ws.workspaceId) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Message not found' } });
      return;
    }

    // Permission: Only author or workspace owner/admin
    if (message.userId !== userId && ws.role !== 'OWNER' && ws.role !== 'ADMIN') {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Permission denied to edit message' } });
      return;
    }

    const cleanContent = sanitizeMessageContent(content.trim());

    const updated = await prisma.workspaceChannelMessage.update({
      where: { id },
      data: {
        content: cleanContent,
        isEdited: true,
      },
      include: {
        user: { select: { id: true, displayName: true, email: true, avatarUrl: true } },
        replyTo: {
          select: {
            id: true,
            content: true,
            user: { select: { displayName: true } },
          },
        },
      },
    });

    try {
      broadcastCollaborationEvent('chat:edited', ws.workspaceId, {
        message: updated,
        channel: message.channel,
      });
    } catch (e) {}

    res.json({
      success: true,
      data: { message: updated },
    });
  } catch (err: any) {
    console.error('Failed to edit message:', err);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message } });
  }
});

// ─── POST /api/chat/messages/:id/reactions ──────────────────────────────────
router.post('/messages/:id/reactions', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const ws = await resolveWorkspaceContext(req);
    const id = (Array.isArray(req.params.id) ? req.params.id[0] : req.params.id) as string;
    const { emoji } = req.body;

    if (!emoji || typeof emoji !== 'string') {
      res.status(400).json({ success: false, error: { code: 'INVALID_INPUT', message: 'Emoji is required' } });
      return;
    }

    const message = await prisma.workspaceChannelMessage.findUnique({
      where: { id },
    });

    if (!message || message.workspaceId !== ws.workspaceId) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Message not found' } });
      return;
    }

    const currentReactions = (message.reactions as Record<string, string[]>) || {};
    const usersForEmoji = currentReactions[emoji] || [];

    let updatedUsers: string[];
    if (usersForEmoji.includes(userId)) {
      updatedUsers = usersForEmoji.filter((u) => u !== userId);
    } else {
      updatedUsers = [...usersForEmoji, userId];
    }

    const newReactions = { ...currentReactions };
    if (updatedUsers.length > 0) {
      newReactions[emoji] = updatedUsers;
    } else {
      delete newReactions[emoji];
    }

    const updated = await prisma.workspaceChannelMessage.update({
      where: { id },
      data: { reactions: newReactions },
      include: {
        user: { select: { id: true, displayName: true, email: true, avatarUrl: true } },
      },
    });

    try {
      broadcastCollaborationEvent('chat:reaction', ws.workspaceId, {
        messageId: id,
        reactions: newReactions,
        channel: message.channel,
      });
    } catch (e) {}

    res.json({
      success: true,
      data: { message: updated },
    });
  } catch (err: any) {
    console.error('Failed to toggle reaction:', err);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message } });
  }
});

// ─── PATCH /api/chat/messages/:id/pin ────────────────────────────────────────
router.patch('/messages/:id/pin', async (req: Request, res: Response): Promise<void> => {
  try {
    const ws = await resolveWorkspaceContext(req);
    const id = (Array.isArray(req.params.id) ? req.params.id[0] : req.params.id) as string;

    const message = await prisma.workspaceChannelMessage.findUnique({
      where: { id },
    });

    if (!message || message.workspaceId !== ws.workspaceId) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Message not found' } });
      return;
    }

    const updated = await prisma.workspaceChannelMessage.update({
      where: { id },
      data: { pinned: !message.pinned },
      include: {
        user: { select: { id: true, displayName: true, email: true, avatarUrl: true } },
      },
    });

    try {
      broadcastCollaborationEvent('chat:pin', ws.workspaceId, {
        messageId: id,
        pinned: updated.pinned,
        channel: message.channel,
      });
    } catch (e) {}

    res.json({
      success: true,
      data: { message: updated },
    });
  } catch (err: any) {
    console.error('Failed to toggle pin:', err);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message } });
  }
});

// ─── DELETE /api/chat/messages/:id ──────────────────────────────────────────
router.delete('/messages/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const ws = await resolveWorkspaceContext(req);
    const id = (Array.isArray(req.params.id) ? req.params.id[0] : req.params.id) as string;

    const message = await prisma.workspaceChannelMessage.findUnique({
      where: { id },
    });

    if (!message || message.workspaceId !== ws.workspaceId) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Message not found' } });
      return;
    }

    if (message.userId !== userId && ws.role !== 'OWNER' && ws.role !== 'ADMIN') {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Permission denied to delete message' } });
      return;
    }

    await prisma.workspaceChannelMessage.delete({
      where: { id },
    });

    try {
      broadcastCollaborationEvent('chat:deleted', ws.workspaceId, {
        messageId: id,
        channel: message.channel,
      });
    } catch (e) {}

    res.json({
      success: true,
      data: { deleted: true, messageId: id },
    });
  } catch (err: any) {
    console.error('Failed to delete message:', err);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message } });
  }
});

// ─── GET /api/chat/search ───────────────────────────────────────────────────
router.get('/search', async (req: Request, res: Response): Promise<void> => {
  try {
    const ws = await resolveWorkspaceContext(req);
    const userId = req.userId!;
    const q = (req.query.q as string) || '';
    const channelFilter = req.query.channel as string | undefined;

    if (!q.trim()) {
      res.json({ success: true, data: { results: [] } });
      return;
    }

    // Get all channels in workspace and filter by access
    const channels = await prisma.workspaceChannel.findMany({
      where: { workspaceId: ws.workspaceId },
      include: { members: { select: { userId: true } } },
    });

    const accessibleChannelNames = new Set<string>();
    for (const ch of channels) {
      if (!ch.isPrivate || ws.role === 'OWNER' || ws.role === 'ADMIN' || ch.members.some((m) => m.userId === userId)) {
        accessibleChannelNames.add(ch.name);
        accessibleChannelNames.add(ch.id);
      }
    }

    const whereClause: any = {
      workspaceId: ws.workspaceId,
      content: { contains: q.trim(), mode: 'insensitive' },
    };

    if (channelFilter) {
      if (!accessibleChannelNames.has(channelFilter)) {
        res.json({ success: true, data: { results: [] } });
        return;
      }
      whereClause.channel = channelFilter;
    } else {
      whereClause.OR = [
        { channel: { in: Array.from(accessibleChannelNames) } },
        { channelId: { in: Array.from(accessibleChannelNames) } },
      ];
    }

    const results = await prisma.workspaceChannelMessage.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: 30,
      include: {
        user: { select: { id: true, displayName: true, email: true, avatarUrl: true } },
      },
    });

    res.json({
      success: true,
      data: {
        query: q,
        results,
      },
    });
  } catch (err: any) {
    console.error('Failed to search chat:', err);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message } });
  }
});

export default router;
