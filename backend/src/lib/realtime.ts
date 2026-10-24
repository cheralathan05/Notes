import { Response } from 'express';
import { randomUUID } from 'crypto';

export interface ActiveCollaborator {
  userId: string;
  displayName: string;
  email: string;
  avatarUrl?: string | null;
  workspaceId: string;
  documentId?: string | null;
  joinedAt: string;
  lastSeenAt: string;
}

interface SSEClient {
  id: string;
  userId: string;
  workspaceId: string;
  documentId?: string | null;
  user: {
    id: string;
    displayName: string;
    email: string;
    avatarUrl?: string | null;
  };
  joinedAt: number;
  lastSeenAt: number;
  res: Response;
}

class RealtimeHub {
  private clients: Map<string, SSEClient> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeatAndCleanup();
    }, 20000);
    if (this.heartbeatInterval.unref) {
      this.heartbeatInterval.unref();
    }
  }

  private sendHeartbeatAndCleanup() {
    const now = Date.now();
    for (const [clientId, client] of this.clients.entries()) {
      try {
        client.res.write(': keepalive\n\n');
        // Sweep connections inactive for > 70s
        if (now - client.lastSeenAt > 70000) {
          this.removeClient(clientId);
        }
      } catch {
        this.removeClient(clientId);
      }
    }
  }

  addClient(
    clientId: string,
    userId: string,
    workspaceId: string,
    res: Response,
    userMeta: { id: string; displayName: string; email: string; avatarUrl?: string | null },
    documentId?: string | null
  ) {
    // Set SSE headers if not already sent
    if (!res.headersSent) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      res.flushHeaders?.();
    }

    const now = Date.now();
    const client: SSEClient = {
      id: clientId,
      userId,
      workspaceId,
      documentId: documentId || null,
      user: userMeta,
      joinedAt: now,
      lastSeenAt: now,
      res,
    };

    this.clients.set(clientId, client);

    // Send connection handshake + initial presence state to the joining client
    const currentActive = this.getActiveCollaborators(workspaceId, documentId || undefined);
    try {
      res.write(
        `data: ${JSON.stringify({
          type: 'CONNECTED',
          clientId,
          activeCollaborators: currentActive,
          timestamp: new Date().toISOString(),
        })}\n\n`
      );
    } catch {
      this.removeClient(clientId);
      return;
    }

    // Broadcast updated presence to other collaborators in this workspace
    this.broadcastPresence(workspaceId, documentId || undefined, clientId);

    // Clean up on client disconnect
    res.on('close', () => {
      this.removeClient(clientId);
    });
  }

  registerClient(workspaceId: string, userId: string, res: Response) {
    const clientId = randomUUID();
    this.addClient(clientId, userId, workspaceId, res, {
      id: userId,
      displayName: 'Operator',
      email: '',
      avatarUrl: null,
    });
  }

  removeClient(clientId: string) {
    const client = this.clients.get(clientId);
    if (!client) return;

    const { workspaceId, documentId } = client;
    this.clients.delete(clientId);

    try {
      if (!client.res.writableEnded) {
        client.res.end();
      }
    } catch {
      // Ignored
    }

    // Broadcast updated presence to remaining clients
    this.broadcastPresence(workspaceId, documentId || undefined);
  }

  touchClient(clientId: string) {
    const client = this.clients.get(clientId);
    if (client) {
      client.lastSeenAt = Date.now();
    }
  }

  switchDocumentContext(clientId: string, documentId?: string | null) {
    const client = this.clients.get(clientId);
    if (!client) return;

    const oldDocId = client.documentId;
    client.documentId = documentId || null;
    client.lastSeenAt = Date.now();

    // Broadcast to old document context if changed
    if (oldDocId && oldDocId !== documentId) {
      this.broadcastPresence(client.workspaceId, oldDocId);
    }
    this.broadcastPresence(client.workspaceId, documentId || undefined);
  }

  getActiveCollaborators(workspaceId: string, documentId?: string): ActiveCollaborator[] {
    const userMap = new Map<string, ActiveCollaborator>();

    for (const client of this.clients.values()) {
      if (client.workspaceId === workspaceId) {
        if (documentId && client.documentId !== documentId) {
          continue;
        }

        if (!userMap.has(client.userId)) {
          userMap.set(client.userId, {
            userId: client.userId,
            displayName: client.user.displayName,
            email: client.user.email,
            avatarUrl: client.user.avatarUrl,
            workspaceId: client.workspaceId,
            documentId: client.documentId,
            joinedAt: new Date(client.joinedAt).toISOString(),
            lastSeenAt: new Date(client.lastSeenAt).toISOString(),
          });
        }
      }
    }

    return Array.from(userMap.values());
  }

  private broadcastPresence(workspaceId: string, documentId?: string, excludeClientId?: string) {
    const activeList = this.getActiveCollaborators(workspaceId, documentId);
    const payload = {
      workspaceId,
      documentId: documentId || null,
      activeCollaborators: activeList,
    };

    const message = `data: ${JSON.stringify({
      type: 'PRESENCE_UPDATED',
      data: payload,
      timestamp: new Date().toISOString(),
    })}\n\n`;

    for (const client of this.clients.values()) {
      if (client.workspaceId === workspaceId && client.id !== excludeClientId) {
        if (!documentId || client.documentId === documentId || !client.documentId) {
          try {
            client.res.write(message);
          } catch {
            this.removeClient(client.id);
          }
        }
      }
    }
  }

  broadcast(
    workspaceId: string,
    eventType: string,
    payload: any,
    options?: { documentId?: string; excludeClientId?: string }
  ) {
    const message = `data: ${JSON.stringify({
      type: eventType,
      data: payload,
      timestamp: new Date().toISOString(),
    })}\n\n`;

    for (const client of this.clients.values()) {
      if (client.workspaceId === workspaceId) {
        if (options?.excludeClientId && client.id === options.excludeClientId) {
          continue;
        }
        if (options?.documentId && client.documentId && client.documentId !== options.documentId) {
          continue;
        }

        try {
          client.res.write(message);
        } catch {
          this.removeClient(client.id);
        }
      }
    }
  }

  getClientCount(workspaceId: string): number {
    let count = 0;
    for (const client of this.clients.values()) {
      if (client.workspaceId === workspaceId) count++;
    }
    return count;
  }
}

export const realtimeHub = new RealtimeHub();

export function broadcastTaskEvent(eventType: string, workspaceId: string, payload: any): void {
  realtimeHub.broadcast(workspaceId, eventType, payload);
}

export function broadcastCollaborationEvent(
  eventType: string,
  workspaceId: string,
  payload: any,
  options?: { documentId?: string; excludeClientId?: string }
): void {
  realtimeHub.broadcast(workspaceId, eventType, payload, options);
}
