import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
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
    try {
      const hashedPassword = await bcrypt.hash(createUserDto.password, 10);

      // Get default role if not provided
      let roleId = createUserDto.roleId;
      if (!roleId) {
        const defaultRole = await this.prisma.role.findFirst({
          where: { name: 'Agent' },
        });
        roleId = defaultRole?.id;
      }

      if (!roleId) {
        throw new NotFoundException('Default role not found');
      }

      // Check if user already exists
      const existingUser = await this.prisma.user.findUnique({
        where: { email: createUserDto.email },
      });

      if (existingUser) {
        throw new ConflictException('User with this email already exists');
      }

      // Create user
      const user = await this.prisma.user.create({
        data: {
          email: createUserDto.email,
          password: hashedPassword,
          firstName: createUserDto.firstName,
          lastName: createUserDto.lastName,
          roleId: roleId,
          createdById: creatorId,
          isActive: true,
        },
        include: {
          role: true,
          creator: true,
        },
      });

      // Log the creation
      await this.prisma.auditLog.create({
        data: {
          userId: creatorId,
          action: 'USER_CREATED',
          entityType: 'USER',
          entityId: user.id,
          newValues: {
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role?.name,
          },
        },
      });

      delete user.password;
      return user;
    } catch (error) {
      throw error;
    }
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
    const updateData: any = { ...updateUserDto };

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

  async activate(id: string) {
    await this.prisma.user.update({
      where: { id },
      data: { isActive: true },
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
}
