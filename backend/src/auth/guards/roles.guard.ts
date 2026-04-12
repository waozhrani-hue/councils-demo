import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      return false;
    }

    // Check user's own roles from JWT payload
    const userRoleCodes: string[] = (user.roles ?? []).map(
      (r: { code: string }) => r.code,
    );

    const hasOwnRole = requiredRoles.some((role) =>
      userRoleCodes.includes(role),
    );

    if (hasOwnRole) {
      return true;
    }

    // Fallback: check active delegations granting the required roles
    const now = new Date();

    const activeDelegations = await this.prisma.delegation.findMany({
      where: {
        toUserId: user.sub,
        state: 'ACTIVE',
        validFrom: { lte: now },
        validUntil: { gte: now },
      },
    });

    for (const delegation of activeDelegations) {
      let scope: { roleCode?: string; roleCodes?: string[] };
      try {
        scope = JSON.parse(delegation.scopeJson);
      } catch {
        continue;
      }

      const delegatedCodes: string[] = [];
      if (scope.roleCode) {
        delegatedCodes.push(scope.roleCode);
      }
      if (Array.isArray(scope.roleCodes)) {
        delegatedCodes.push(...scope.roleCodes);
      }

      const hasDelegatedRole = requiredRoles.some((role) =>
        delegatedCodes.includes(role),
      );

      if (hasDelegatedRole) {
        return true;
      }
    }

    return false;
  }
}
