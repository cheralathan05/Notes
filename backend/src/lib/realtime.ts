import { Response } from 'express';
import { randomUUID } from 'crypto';

interface SSEClient {
  id: string;
  userId: string;
  workspaceId: string;
  res: Response;
}

class RealtimeHub {
  private clients: Map<string, SSEClient> = new Map();

  addClient(clientId: string, userId: string, workspaceId: string, res: Response) {
    this.clients.set(clientId, { id: clientId, userId, workspaceId, res });

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    // Send connection handshake
    res.write(`data: ${JSON.stringify({ type: 'CONNECTED', clientId, timestamp: new Date().toISOString() })}\n\n`);

    // Clean up on disconnect
    res.on('close', () => {
      this.clients.delete(clientId);
    });
  }

  registerClient(workspaceId: string, userId: string, res: Response) {
    const clientId = randomUUID();
    this.addClient(clientId, userId, workspaceId, res);
  }

  broadcast(workspaceId: string, eventType: string, payload: any) {
    const message = `data: ${JSON.stringify({ type: eventType, data: payload, timestamp: new Date().toISOString() })}\n\n`;
    for (const client of this.clients.values()) {
      if (client.workspaceId === workspaceId) {
        try {
          client.res.write(message);
        } catch {
          this.clients.delete(client.id);
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
