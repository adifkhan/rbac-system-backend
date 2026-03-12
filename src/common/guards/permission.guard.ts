import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermission = this.reflector.get<string>(
      'permission',
      context.getHandler(),
    );

    if (!requiredPermission) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException();
    }

    // Check if user has the required permission
    if (!user.permissions.includes(requiredPermission)) {
      throw new ForbiddenException('Insufficient permissions');
    }

    // For grant operations, check grant ceiling
    if (request.method === 'POST' && request.body.permissionIds) {
      const permissionsToGrant = request.body.permissionIds;
      const hasAllPermissions = permissionsToGrant.every(p => 
        user.permissions.includes(p)
      );
      
      if (!hasAllPermissions) {
        throw new ForbiddenException('Cannot grant permissions you do not hold');
      }
    }

    return true;
  }
}