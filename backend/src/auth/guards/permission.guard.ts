import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DynamicPermissionService } from '../dynamic-permission.service';

export const PERMISSION_KEY = 'required_permission';

export const RequirePermission = (...permissions: string[]) => {
  return (target: any, key?: string, descriptor?: any) => {
    Reflect.defineMetadata(PERMISSION_KEY, permissions, descriptor?.value ?? target);
    return descriptor ?? target;
  };
};

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissionService: DynamicPermissionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // If no permissions required, allow access
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user?.sub) return false;

    const userPermissions = await this.permissionService.getUserPermissions(user.sub);

    // User must have at least one of the required permissions
    return requiredPermissions.some((p) => userPermissions.includes(p));
  }
}
