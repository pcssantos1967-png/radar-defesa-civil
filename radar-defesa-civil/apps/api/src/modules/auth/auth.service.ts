import bcrypt from 'bcrypt';
import { nanoid } from 'nanoid';
import { prisma } from '../../config/database.js';
import { redis } from '../../config/redis.js';
import { env } from '../../config/env.js';
import { UnauthorizedError, NotFoundError, ValidationError } from '../../utils/errors.js';
import { createLogger } from '../../utils/logger.js';
import type { LoginInput, AuthResponse, AuthTokens, ChangePasswordInput } from './auth.schema.js';
import type { FastifyInstance } from 'fastify';

const logger = createLogger('auth-service');

const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 15;

export class AuthService {
  constructor(private app: FastifyInstance) {}

  async login(input: LoginInput): Promise<AuthResponse> {
    const { email, password } = input;

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { consortium: true },
    });

    if (!user) {
      throw new UnauthorizedError('Invalid credentials');
    }

    if (!user.isActive) {
      throw new UnauthorizedError('Account is disabled');
    }

    // Check if account is locked
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const remainingMinutes = Math.ceil(
        (user.lockedUntil.getTime() - Date.now()) / (1000 * 60)
      );
      throw new UnauthorizedError(
        `Account locked. Try again in ${remainingMinutes} minutes`
      );
    }

    const isValidPassword = await bcrypt.compare(password, user.passwordHash);

    if (!isValidPassword) {
      // Increment failed attempts
      const failedAttempts = user.failedLoginAttempts + 1;
      const updateData: { failedLoginAttempts: number; lockedUntil?: Date } = {
        failedLoginAttempts: failedAttempts,
      };

      if (failedAttempts >= MAX_LOGIN_ATTEMPTS) {
        updateData.lockedUntil = new Date(
          Date.now() + LOCKOUT_DURATION_MINUTES * 60 * 1000
        );
        logger.warn({ email }, 'Account locked due to too many failed attempts');
      }

      await prisma.user.update({
        where: { id: user.id },
        data: updateData,
      });

      throw new UnauthorizedError('Invalid credentials');
    }

    // Reset failed attempts on successful login
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
      },
    });

    const tokens = await this.generateTokens(user);

    // Log audit event
    await this.logAudit(user.id, 'LOGIN', 'user', user.id);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        consortiumId: user.consortiumId || undefined,
      },
      tokens,
    };
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    const tokenHash = await this.hashToken(refreshToken);

    const storedToken = await prisma.refreshToken.findFirst({
      where: {
        tokenHash,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    });

    if (!storedToken) {
      throw new UnauthorizedError('Invalid refresh token');
    }

    if (!storedToken.user.isActive) {
      throw new UnauthorizedError('Account is disabled');
    }

    // Revoke old refresh token
    await prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { revokedAt: new Date() },
    });

    return this.generateTokens(storedToken.user);
  }

  async logout(userId: string, refreshToken?: string): Promise<void> {
    if (refreshToken) {
      const tokenHash = await this.hashToken(refreshToken);
      await prisma.refreshToken.updateMany({
        where: { userId, tokenHash },
        data: { revokedAt: new Date() },
      });
    } else {
      // Revoke all refresh tokens for user
      await prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    await this.logAudit(userId, 'LOGOUT', 'user', userId);
  }

  async changePassword(userId: string, input: ChangePasswordInput): Promise<void> {
    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new NotFoundError('User', userId);
    }

    const isValidPassword = await bcrypt.compare(input.currentPassword, user.passwordHash);

    if (!isValidPassword) {
      throw new ValidationError('Current password is incorrect');
    }

    const newPasswordHash = await bcrypt.hash(input.newPassword, 10);

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newPasswordHash },
    });

    // Revoke all refresh tokens
    await prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await this.logAudit(userId, 'PASSWORD_CHANGE', 'user', userId);
  }

  private async generateTokens(user: {
    id: string;
    email: string;
    role: string;
    consortiumId: string | null;
  }): Promise<AuthTokens> {
    const payload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      consortiumId: user.consortiumId,
    };

    const accessToken = this.app.jwt.sign(payload, {
      expiresIn: env.JWT_EXPIRES_IN,
    });

    const refreshToken = nanoid(64);
    const refreshTokenHash = await this.hashToken(refreshToken);

    // Parse JWT_REFRESH_EXPIRES_IN to get milliseconds
    const refreshExpiresMs = this.parseExpiration(env.JWT_REFRESH_EXPIRES_IN);

    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: refreshTokenHash,
        expiresAt: new Date(Date.now() + refreshExpiresMs),
      },
    });

    // Parse JWT_EXPIRES_IN to get seconds for response
    const expiresIn = Math.floor(this.parseExpiration(env.JWT_EXPIRES_IN) / 1000);

    return {
      accessToken,
      refreshToken,
      expiresIn,
    };
  }

  private async hashToken(token: string): Promise<string> {
    return bcrypt.hash(token, 10);
  }

  private parseExpiration(expiration: string): number {
    const match = expiration.match(/^(\d+)([smhd])$/);
    if (!match) {
      throw new Error(`Invalid expiration format: ${expiration}`);
    }

    const [, value, unit] = match;
    const multipliers: Record<string, number> = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
    };

    return parseInt(value, 10) * multipliers[unit];
  }

  private async logAudit(
    userId: string,
    action: string,
    entityType: string,
    entityId: string
  ): Promise<void> {
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        entityType,
        entityId,
      },
    });
  }
}
