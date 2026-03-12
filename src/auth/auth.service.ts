import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { LoginDto, RegisterDto, RefreshTokenDto } from './dto/auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async login(loginDto: LoginDto, ipAddress?: string, userAgent?: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: loginDto.email },
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

    if (!user || !user.isActive || user.isBanned) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordValid = await bcrypt.compare(
      loginDto.password,
      user.password,
    );
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Get all permissions (role + direct)
    const permissions = [
      ...user.role.permissions.map((rp) => rp.permission.name),
      ...user.permissions.map((up) => up.permission.name),
    ];

    const accessToken = this.jwtService.sign({
      sub: user.id,
      email: user.email,
      permissions: permissions,
    });

    const refreshToken = this.jwtService.sign(
      { sub: user.id },
      {
        secret: process.env.JWT_REFRESH_SECRET,
        expiresIn: '7d',
      },
    );

    // Store refresh token
    await this.prisma.session.create({
      data: {
        userId: user.id,
        refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    // Log login
    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'LOGIN',
        entityType: 'USER',
        entityId: user.id,
        ipAddress,
        userAgent,
      },
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role.name,
        permissions: permissions,
      },
    };
  }

  async register(registerDto: RegisterDto) {
    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: registerDto.email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Get default role (Agent) if no role specified
    let roleId = registerDto.roleId;
    if (!roleId) {
      const defaultRole = await this.prisma.role.findFirst({
        where: { name: 'Agent' },
      });
      roleId = defaultRole?.id;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(registerDto.password, 10);

    // Create user
    const user = await this.prisma.user.create({
      data: {
        email: registerDto.email,
        password: hashedPassword,
        firstName: registerDto.firstName,
        lastName: registerDto.lastName,
        roleId: roleId,
        isActive: true,
      },
      include: {
        role: true,
      },
    });

    // Log registration
    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'REGISTER',
        entityType: 'USER',
        entityId: user.id,
      },
    });

    // Remove password from response
    delete user.password;
    return user;
  }

  async refreshToken(refreshTokenDto: RefreshTokenDto) {
    try {
      const payload = this.jwtService.verify(refreshTokenDto.refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      });

      const session = await this.prisma.session.findFirst({
        where: {
          refreshToken: refreshTokenDto.refreshToken,
          blacklisted: false,
          expiresAt: { gt: new Date() },
        },
        include: {
          user: {
            include: {
              role: {
                include: {
                  permissions: { include: { permission: true } },
                },
              },
              permissions: { include: { permission: true } },
            },
          },
        },
      });

      if (!session) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const permissions = [
        ...session.user.role.permissions.map((rp) => rp.permission.name),
        ...session.user.permissions.map((up) => up.permission.name),
      ];

      const accessToken = this.jwtService.sign({
        sub: session.user.id,
        email: session.user.email,
        permissions: permissions,
      });

      return { accessToken };
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logout(userId: string, refreshToken: string) {
    await this.prisma.session.updateMany({
      where: {
        refreshToken: refreshToken,
        userId: userId,
      },
      data: { blacklisted: true },
    });

    // Log logout
    await this.prisma.auditLog.create({
      data: {
        userId: userId,
        action: 'LOGOUT',
        entityType: 'USER',
        entityId: userId,
      },
    });

    return { success: true };
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
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

    const permissions = [
      ...user.role.permissions.map((rp) => rp.permission.name),
      ...user.permissions.map((up) => up.permission.name),
    ];

    delete user.password;

    return {
      ...user,
      permissions,
    };
  }

  async validateUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
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

    if (!user || !user.isActive || user.isBanned) {
      return null;
    }

    const permissions = [
      ...user.role.permissions.map((rp) => rp.permission.name),
      ...user.permissions.map((up) => up.permission.name),
    ];

    delete user.password;

    return {
      ...user,
      permissions,
    };
  }
}
