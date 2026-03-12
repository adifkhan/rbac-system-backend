import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
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
    const currentUser = request.user;

    if (!currentUser) {
      throw new ForbiddenException();
    }

    // Check if user has the required permission
    if (!currentUser.permissions.includes(requiredPermission)) {
      throw new ForbiddenException('Insufficient permissions');
    }

    // For create user operation, check grant ceiling
    if (request.method === 'POST' && request.path.includes('/users')) {
      const { role } = request.body;

      if (role) {
        // Get the role's permissions
        const roleData = await this.prisma.role.findUnique({
          where: { name: role },
          include: {
            permissions: {
              include: { permission: true },
            },
          },
        });

        if (roleData) {
          const rolePermissions = roleData.permissions.map(
            (rp) => rp.permission.name,
          );

          // Check if current user has all permissions of the role they're trying to assign
          const hasAllPermissions = rolePermissions.every((perm) =>
            currentUser.permissions.includes(perm),
          );

          if (!hasAllPermissions) {
            throw new ForbiddenException(
              'Cannot assign a role with permissions you do not have',
            );
          }
        }
      }
    }

    return true;
  }
}
