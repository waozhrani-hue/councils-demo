import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateNotificationDto } from './dto/create-notification.dto';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Public service method used by other modules to create notifications.
   */
  async createNotification(data: CreateNotificationDto) {
    return this.prisma.notification.create({
      data: {
        type: data.type,
        recipientId: data.recipientId,
        recipientOrgId: data.recipientOrgId,
        decisionId: data.decisionId,
        title: data.title,
        body: data.body,
        status: 'NOTIF_PENDING',
      },
      include: {
        decision: true,
        recipient: {
          select: { id: true, displayName: true, email: true },
        },
      },
    });
  }

  async findMyNotifications(recipientId: string) {
    return this.prisma.notification.findMany({
      where: { recipientId },
      orderBy: { createdAt: 'desc' },
      include: {
        decision: {
          select: {
            id: true,
            refNumber: true,
            summary: true,
            status: true,
          },
        },
      },
    });
  }

  async markAsRead(id: string, userId: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    if (notification.recipientId !== userId) {
      throw new BadRequestException(
        'You can only mark your own notifications as read',
      );
    }

    return this.prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    });
  }

  async deliver(id: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    if (notification.status !== 'NOTIF_PENDING') {
      throw new BadRequestException(
        'Only NOTIF_PENDING notifications can be delivered',
      );
    }

    const attemptNumber = notification.retryCount + 1;

    // Simulate delivery attempt — in production this would call
    // an external service (email, SMS, push, etc.)
    let deliveryResult: 'SUCCESS' | 'FAIL' = 'SUCCESS';
    let errorDetail: string | undefined;

    try {
      // Placeholder for actual delivery logic
      // e.g. await this.emailService.send(notification);
      deliveryResult = 'SUCCESS';
    } catch (err) {
      deliveryResult = 'FAIL';
      errorDetail = err instanceof Error ? err.message : 'Unknown error';
    }

    const newStatus =
      deliveryResult === 'SUCCESS' ? 'NOTIF_DONE' : 'NOTIF_FAIL';

    const [updated] = await this.prisma.$transaction([
      this.prisma.notification.update({
        where: { id },
        data: {
          status: newStatus,
          retryCount: attemptNumber,
          nextRetryAt:
            deliveryResult === 'FAIL'
              ? new Date(Date.now() + 60 * 60 * 1000) // retry in 1h
              : null,
        },
      }),
      this.prisma.notificationDeliveryAttempt.create({
        data: {
          notificationId: id,
          attemptNumber,
          result: deliveryResult,
          errorDetail,
        },
      }),
    ]);

    return updated;
  }

  async manualResolve(id: string, reason: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    return this.prisma.$transaction([
      this.prisma.notification.update({
        where: { id },
        data: { status: 'NOTIF_DONE' },
      }),
      this.prisma.notificationDeliveryAttempt.create({
        data: {
          notificationId: id,
          attemptNumber: notification.retryCount + 1,
          result: 'SUCCESS',
          errorDetail: `Manual resolve: ${reason}`,
        },
      }),
    ]).then(([updated]) => updated);
  }
}
