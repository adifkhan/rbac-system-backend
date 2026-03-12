import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateUserDto,
  UpdateUserDto,
  UpdateUserPermissionsDto,
} from './dto/user.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  async create(createUserDto: CreateUserDto, creatorId: string) {
    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);

    // Get default role if not provided
    let roleId = createUserDto.roleId;
    if (!roleId) {
      const defaultRole = await this.prisma.role.findFirst({
        where: { name: 'Agent' },
      });
      roleId = defaultRole?.id;
    }

    // Create user - Option 1: Use create with direct field assignments
    const user = await this.prisma.user.create({
      data: {
        email: createUserDto.email,
        password: hashedPassword,
        firstName: createUserDto.firstName,
        lastName: createUserDto.lastName,
        roleId: roleId, // Direct foreign key assignment instead of nested connect
        createdById: creatorId,
      },
      include: {
        role: true,
        creator: true,
      },
    });

    delete user.password;
    return user;
  }

  async findAll() {
    const users = await this.prisma.user.findMany({
      include: {
        role: true,
        permissions: {
          include: { permission: true },
        },
        creator: true,
      },
    });

    return users.map((user) => {
      delete user.password;
      return user;
    });
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        role: {
          include: {
            permissions: {
              include: { permission: true },
            },
          },
        },
        permissions: {
          include: { permission: true },
        },
        creator: true,
        createdUsers: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    delete user.password;
    return user;
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    // Create a clean update object
    const updateData: any = {};

    if (updateUserDto.email) updateData.email = updateUserDto.email;
    if (updateUserDto.firstName) updateData.firstName = updateUserDto.firstName;
    if (updateUserDto.lastName) updateData.lastName = updateUserDto.lastName;
    if (updateUserDto.isActive !== undefined)
      updateData.isActive = updateUserDto.isActive;
    if (updateUserDto.isBanned !== undefined)
      updateData.isBanned = updateUserDto.isBanned;
    if (updateUserDto.roleId) updateData.roleId = updateUserDto.roleId; // Direct assignment

    const user = await this.prisma.user.update({
      where: { id },
      data: updateData,
      include: {
        role: true,
        creator: true,
      },
    });

    delete user.password;
    return user;
  }

  async suspend(id: string) {
    await this.prisma.user.update({
      where: { id },
      data: { isActive: false },
    });

    // Log the suspension
    await this.prisma.auditLog.create({
      data: {
        userId: id,
        action: 'USER_SUSPENDED',
        entityType: 'USER',
        entityId: id,
      },
    });

    return { message: 'User suspended successfully' };
  }

  async ban(id: string) {
    await this.prisma.user.update({
      where: { id },
      data: { isBanned: true, isActive: false },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: id,
        action: 'USER_BANNED',
        entityType: 'USER',
        entityId: id,
      },
    });

    return { message: 'User banned successfully' };
  }

  async activate(id: string) {
    await this.prisma.user.update({
      where: { id },
      data: { isActive: true, isBanned: false },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: id,
        action: 'USER_ACTIVATED',
        entityType: 'USER',
        entityId: id,
      },
    });

    return { message: 'User activated successfully' };
  }

  async updatePermissions(
    id: string,
    updatePermissionsDto: UpdateUserPermissionsDto,
    grantedById: string,
  ) {
    // First, remove all existing direct permissions
    await this.prisma.userPermission.deleteMany({
      where: { userId: id },
    });

    // Then add new permissions
    if (updatePermissionsDto.permissionIds.length > 0) {
      await this.prisma.userPermission.createMany({
        data: updatePermissionsDto.permissionIds.map((permissionId) => ({
          userId: id,
          permissionId: permissionId,
          // If your UserPermission model has grantedById, uncomment this line
          // grantedById: grantedById,
        })),
      });
    }

    // Log the permission update
    await this.prisma.auditLog.create({
      data: {
        userId: grantedById,
        action: 'USER_PERMISSIONS_UPDATED',
        entityType: 'USER',
        entityId: id,
        newValues: { permissions: updatePermissionsDto.permissionIds },
      },
    });

    return this.findOne(id);
  }

  async remove(id: string) {
    try {
      await this.prisma.user.delete({
        where: { id },
      });

      await this.prisma.auditLog.create({
        data: {
          userId: id,
          action: 'USER_DELETED',
          entityType: 'USER',
          entityId: id,
        },
      });

      return { message: 'User deleted successfully' };
    } catch (error) {
      throw new NotFoundException('User not found');
    }
  }

  async getPermissions(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        role: {
          include: {
            permissions: {
              include: { permission: true },
            },
          },
        },
        permissions: {
          include: { permission: true },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Combine role permissions and direct permissions
    const rolePermissions = user.role.permissions.map((rp) => rp.permission);
    const directPermissions = user.permissions.map((up) => up.permission);

    return {
      rolePermissions,
      directPermissions,
      allPermissions: [...rolePermissions, ...directPermissions],
    };
  }
}
