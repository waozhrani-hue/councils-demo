import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ClearanceGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      return false;
    }

    // Determine the topic ID from route params or request body
    const topicId: string | undefined =
      request.params?.id ?? request.body?.topicId;

    if (!topicId) {
      // No topic context — clearance check not applicable
      return true;
    }

    const topic = await this.prisma.topic.findUnique({
      where: { id: topicId },
      include: { secrecyLevel: true },
    });

    if (!topic) {
      // Topic not found — let downstream handlers deal with 404
      return true;
    }

    const userClearanceLevel: number = user.clearanceLevel ?? 0;
    const topicSecrecyOrder = topic.secrecyLevel?.sortOrder ?? 0;

    if (userClearanceLevel < topicSecrecyOrder) {
      throw new ForbiddenException(
        'Insufficient clearance level to access this topic',
      );
    }

    return true;
  }
}
