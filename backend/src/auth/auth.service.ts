import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from './strategies/jwt.strategy';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        maxClearance: true,
        roles: {
          include: {
            role: true,
            council: true,
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }

    const passwordValid = await bcrypt.compare(password, user.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const roles = user.roles.map((ur) => ({
      code: ur.role.code,
      councilId: ur.councilId,
    }));

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      displayName: user.displayName,
      roles,
      clearanceLevel: user.maxClearance?.sortOrder ?? 0,
    };

    const accessToken = this.jwtService.sign(payload);

    const refreshExpiry =
      this.configService.get<string>('JWT_REFRESH_EXPIRY') ?? '7d';
    const refreshToken = this.jwtService.sign(
      { sub: user.id, type: 'refresh' },
      { expiresIn: refreshExpiry as any },
    );

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        isActive: user.isActive,
        organizationId: user.organizationId,
        roles,
      },
    };
  }

  async refreshToken(token: string) {
    try {
      const decoded = this.jwtService.verify<{ sub: string; type?: string }>(
        token,
      );

      if (decoded.type !== 'refresh') {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const user = await this.prisma.user.findUnique({
        where: { id: decoded.sub },
        include: {
          maxClearance: true,
          roles: {
            include: {
              role: true,
              council: true,
            },
          },
        },
      });

      if (!user || !user.isActive) {
        throw new UnauthorizedException('User not found or deactivated');
      }

      const roles = user.roles.map((ur) => ({
        code: ur.role.code,
        councilId: ur.councilId,
      }));

      const payload: JwtPayload = {
        sub: user.id,
        email: user.email,
        displayName: user.displayName,
        roles,
        clearanceLevel: user.maxClearance?.sortOrder ?? 0,
      };

      const accessToken = this.jwtService.sign(payload);

      const refreshExpiry =
        this.configService.get<string>('JWT_REFRESH_EXPIRY') ?? '7d';
      const refreshToken = this.jwtService.sign(
        { sub: user.id, type: 'refresh' },
        { expiresIn: refreshExpiry as any },
      );

      return {
        accessToken,
        refreshToken,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }
}
