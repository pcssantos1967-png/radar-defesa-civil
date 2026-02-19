import bcrypt from 'bcrypt';
import { prisma } from '../../config/database.js';
import { NotFoundError, ConflictError } from '../../utils/errors.js';
import { createLogger } from '../../utils/logger.js';
import type { CreateUserInput, UpdateUserInput, QueryUsersInput } from './users.schema.js';

const logger = createLogger('users-service');

export class UsersService {
  async create(input: CreateUserInput, createdBy?: string) {
    const existingUser = await prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
    });

    if (existingUser) {
      throw new ConflictError('Email already registered');
    }

    const passwordHash = await bcrypt.hash(input.password, 10);

    const user = await prisma.user.create({
      data: {
        email: input.email.toLowerCase(),
        passwordHash,
        name: input.name,
        role: input.role,
        consortiumId: input.consortiumId,
        municipalityIds: input.municipalityIds || [],
        phone: input.phone,
        notificationPreferences: input.notificationPreferences || {},
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        consortiumId: true,
        municipalityIds: true,
        phone: true,
        notificationPreferences: true,
        isActive: true,
        createdAt: true,
      },
    });

    if (createdBy) {
      await prisma.auditLog.create({
        data: {
          userId: createdBy,
          action: 'CREATE_USER',
          entityType: 'user',
          entityId: user.id,
          newValues: { email: user.email, role: user.role },
        },
      });
    }

    logger.info({ userId: user.id }, 'User created');
    return user;
  }

  async findById(id: string) {
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        consortiumId: true,
        municipalityIds: true,
        phone: true,
        avatarUrl: true,
        notificationPreferences: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
        consortium: {
          select: { id: true, name: true, code: true },
        },
      },
    });

    if (!user) {
      throw new NotFoundError('User', id);
    }

    return user;
  }

  async findMany(query: QueryUsersInput) {
    const { page, limit, role, consortiumId, isActive, search } = query;
    const skip = (page - 1) * limit;

    const where: {
      role?: string;
      consortiumId?: string;
      isActive?: boolean;
      OR?: Array<{ email: { contains: string; mode: 'insensitive' } } | { name: { contains: string; mode: 'insensitive' } }>;
    } = {};

    if (role) where.role = role;
    if (consortiumId) where.consortiumId = consortiumId;
    if (isActive !== undefined) where.isActive = isActive;
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          consortiumId: true,
          isActive: true,
          lastLoginAt: true,
          createdAt: true,
        },
      }),
      prisma.user.count({ where }),
    ]);

    return {
      data: users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async update(id: string, input: UpdateUserInput, updatedBy?: string) {
    const existingUser = await prisma.user.findUnique({ where: { id } });

    if (!existingUser) {
      throw new NotFoundError('User', id);
    }

    if (input.email && input.email.toLowerCase() !== existingUser.email) {
      const emailExists = await prisma.user.findUnique({
        where: { email: input.email.toLowerCase() },
      });
      if (emailExists) {
        throw new ConflictError('Email already registered');
      }
    }

    const user = await prisma.user.update({
      where: { id },
      data: {
        ...(input.email && { email: input.email.toLowerCase() }),
        ...(input.name && { name: input.name }),
        ...(input.role && { role: input.role }),
        ...(input.consortiumId !== undefined && { consortiumId: input.consortiumId }),
        ...(input.municipalityIds && { municipalityIds: input.municipalityIds }),
        ...(input.phone !== undefined && { phone: input.phone }),
        ...(input.notificationPreferences && { notificationPreferences: input.notificationPreferences }),
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        consortiumId: true,
        municipalityIds: true,
        phone: true,
        notificationPreferences: true,
        isActive: true,
        updatedAt: true,
      },
    });

    if (updatedBy) {
      await prisma.auditLog.create({
        data: {
          userId: updatedBy,
          action: 'UPDATE_USER',
          entityType: 'user',
          entityId: user.id,
          oldValues: { email: existingUser.email, role: existingUser.role },
          newValues: { email: user.email, role: user.role },
        },
      });
    }

    return user;
  }

  async deactivate(id: string, deactivatedBy?: string) {
    const user = await prisma.user.findUnique({ where: { id } });

    if (!user) {
      throw new NotFoundError('User', id);
    }

    await prisma.user.update({
      where: { id },
      data: { isActive: false },
    });

    // Revoke all refresh tokens
    await prisma.refreshToken.updateMany({
      where: { userId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    if (deactivatedBy) {
      await prisma.auditLog.create({
        data: {
          userId: deactivatedBy,
          action: 'DEACTIVATE_USER',
          entityType: 'user',
          entityId: id,
        },
      });
    }

    logger.info({ userId: id }, 'User deactivated');
  }

  async activate(id: string, activatedBy?: string) {
    const user = await prisma.user.findUnique({ where: { id } });

    if (!user) {
      throw new NotFoundError('User', id);
    }

    await prisma.user.update({
      where: { id },
      data: { isActive: true },
    });

    if (activatedBy) {
      await prisma.auditLog.create({
        data: {
          userId: activatedBy,
          action: 'ACTIVATE_USER',
          entityType: 'user',
          entityId: id,
        },
      });
    }

    logger.info({ userId: id }, 'User activated');
  }
}

export const usersService = new UsersService();
