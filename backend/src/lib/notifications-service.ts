import { prisma } from './prisma';
import { realtimeHub } from './realtime';
import { NotificationType } from '@prisma/client';

export interface CreateNotificationParams {
  type?: NotificationType;
  title: string;
  message: string;
  linkUrl?: string;
  actorId?: string;
  metadata?: any;
}

export class NotificationsService {
  async createNotification(
    workspaceId: string,
    recipientId: string,
    params: CreateNotificationParams
  ) {
    const notification = await prisma.notification.create({
      data: {
        workspaceId,
        recipientId,
        actorId: params.actorId || null,
        type: params.type || 'SYSTEM',
        title: params.title,
        message: params.message,
        linkUrl: params.linkUrl || null,
        metadata: params.metadata || null,
      },
      include: {
        actor: {
          select: { id: true, displayName: true, email: true, avatarUrl: true },
        },
      },
    });

    // Broadcast in real-time via SSE Hub to workspace/user
    realtimeHub.broadcast(workspaceId, 'NOTIFICATION_CREATED', {
      notification,
      recipientId,
    });

    return notification;
  }

  async getUserNotifications(
    workspaceId: string,
    userId: string,
    options: { unreadOnly?: boolean; limit?: number; offset?: number } = {}
  ) {
    const limit = Math.min(options.limit || 20, 100);
    const offset = options.offset || 0;

    const where: any = {
      workspaceId,
      recipientId: userId,
    };

    if (options.unreadOnly) {
      where.isRead = false;
    }

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' },
        include: {
          actor: {
            select: { id: true, displayName: true, email: true, avatarUrl: true },
          },
        },
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({
        where: { workspaceId, recipientId: userId, isRead: false },
      }),
    ]);

    return {
      notifications,
      total,
      unreadCount,
    };
  }

  async markAsRead(notificationId: string, userId: string) {
    const notification = await prisma.notification.findFirst({
      where: { id: notificationId, recipientId: userId },
    });

    if (!notification) {
      throw new Error('Notification not found or access denied');
    }

    const updated = await prisma.notification.update({
      where: { id: notificationId },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return updated;
  }

  async markAllAsRead(workspaceId: string, userId: string) {
    const result = await prisma.notification.updateMany({
      where: {
        workspaceId,
        recipientId: userId,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return { count: result.count };
  }

  async getUnreadCount(workspaceId: string, userId: string) {
    return prisma.notification.count({
      where: {
        workspaceId,
        recipientId: userId,
        isRead: false,
      },
    });
  }
}

export const notificationsService = new NotificationsService();
