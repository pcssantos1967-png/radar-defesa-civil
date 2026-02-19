import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { AuthService } from './auth.service.js';
import {
  loginSchema,
  refreshTokenSchema,
  changePasswordSchema,
  type LoginInput,
  type RefreshTokenInput,
  type ChangePasswordInput,
} from './auth.schema.js';
import { authenticate } from '../../middleware/auth.js';

export async function authRoutes(app: FastifyInstance): Promise<void> {
  const authService = new AuthService(app);

  // Login
  app.post<{ Body: LoginInput }>(
    '/login',
    {
      schema: {
        description: 'User login',
        tags: ['auth'],
        body: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  user: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      email: { type: 'string' },
                      name: { type: 'string' },
                      role: { type: 'string' },
                      consortiumId: { type: 'string' },
                    },
                  },
                  tokens: {
                    type: 'object',
                    properties: {
                      accessToken: { type: 'string' },
                      refreshToken: { type: 'string' },
                      expiresIn: { type: 'number' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const input = loginSchema.parse(request.body);
      const result = await authService.login(input);
      return { success: true, data: result };
    }
  );

  // Refresh token
  app.post<{ Body: RefreshTokenInput }>(
    '/refresh',
    {
      schema: {
        description: 'Refresh access token',
        tags: ['auth'],
        body: {
          type: 'object',
          required: ['refreshToken'],
          properties: {
            refreshToken: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const input = refreshTokenSchema.parse(request.body);
      const tokens = await authService.refresh(input.refreshToken);
      return { success: true, data: { tokens } };
    }
  );

  // Logout
  app.post(
    '/logout',
    {
      preHandler: [authenticate],
      schema: {
        description: 'User logout',
        tags: ['auth'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const refreshToken = request.body && typeof request.body === 'object' && 'refreshToken' in request.body
        ? (request.body as { refreshToken?: string }).refreshToken
        : undefined;

      await authService.logout(request.user!.userId, refreshToken);
      return { success: true, message: 'Logged out successfully' };
    }
  );

  // Change password
  app.post<{ Body: ChangePasswordInput }>(
    '/change-password',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Change user password',
        tags: ['auth'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['currentPassword', 'newPassword'],
          properties: {
            currentPassword: { type: 'string' },
            newPassword: { type: 'string', minLength: 8 },
          },
        },
      },
    },
    async (request, reply) => {
      const input = changePasswordSchema.parse(request.body);
      await authService.changePassword(request.user!.userId, input);
      return { success: true, message: 'Password changed successfully' };
    }
  );

  // Get current user
  app.get(
    '/me',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Get current user info',
        tags: ['auth'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const { prisma } = await import('../../config/database.js');

      const user = await prisma.user.findUnique({
        where: { id: request.user!.userId },
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
          lastLoginAt: true,
        },
      });

      return { success: true, data: { user } };
    }
  );
}
