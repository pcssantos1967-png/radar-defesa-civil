import { FastifyInstance } from 'fastify';
import { usersService } from './users.service.js';
import {
  createUserSchema,
  updateUserSchema,
  queryUsersSchema,
  type CreateUserInput,
  type UpdateUserInput,
} from './users.schema.js';
import { authorize, Roles } from '../../middleware/auth.js';

export async function usersRoutes(app: FastifyInstance): Promise<void> {
  // List users
  app.get(
    '/',
    {
      preHandler: [authorize(Roles.ADMIN, Roles.MANAGER)],
      schema: {
        description: 'List users',
        tags: ['users'],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'number' },
            limit: { type: 'number' },
            role: { type: 'string' },
            consortiumId: { type: 'string' },
            isActive: { type: 'boolean' },
            search: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const query = queryUsersSchema.parse(request.query);
      const result = await usersService.findMany(query);
      return { success: true, ...result };
    }
  );

  // Get user by ID
  app.get<{ Params: { id: string } }>(
    '/:id',
    {
      preHandler: [authorize(Roles.ADMIN, Roles.MANAGER)],
      schema: {
        description: 'Get user by ID',
        tags: ['users'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
      },
    },
    async (request, reply) => {
      const user = await usersService.findById(request.params.id);
      return { success: true, data: { user } };
    }
  );

  // Create user
  app.post<{ Body: CreateUserInput }>(
    '/',
    {
      preHandler: [authorize(Roles.ADMIN)],
      schema: {
        description: 'Create user',
        tags: ['users'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['email', 'password', 'name', 'role'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string', minLength: 8 },
            name: { type: 'string', minLength: 2 },
            role: { type: 'string', enum: ['admin', 'operator', 'manager', 'viewer', 'api_user'] },
            consortiumId: { type: 'string', format: 'uuid' },
            municipalityIds: { type: 'array', items: { type: 'string', format: 'uuid' } },
            phone: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const input = createUserSchema.parse(request.body);
      const user = await usersService.create(input, request.user!.userId);
      return reply.status(201).send({ success: true, data: { user } });
    }
  );

  // Update user
  app.put<{ Params: { id: string }; Body: UpdateUserInput }>(
    '/:id',
    {
      preHandler: [authorize(Roles.ADMIN)],
      schema: {
        description: 'Update user',
        tags: ['users'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
      },
    },
    async (request, reply) => {
      const input = updateUserSchema.parse(request.body);
      const user = await usersService.update(request.params.id, input, request.user!.userId);
      return { success: true, data: { user } };
    }
  );

  // Deactivate user
  app.delete<{ Params: { id: string } }>(
    '/:id',
    {
      preHandler: [authorize(Roles.ADMIN)],
      schema: {
        description: 'Deactivate user',
        tags: ['users'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
      },
    },
    async (request, reply) => {
      await usersService.deactivate(request.params.id, request.user!.userId);
      return { success: true, message: 'User deactivated' };
    }
  );

  // Activate user
  app.post<{ Params: { id: string } }>(
    '/:id/activate',
    {
      preHandler: [authorize(Roles.ADMIN)],
      schema: {
        description: 'Activate user',
        tags: ['users'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
      },
    },
    async (request, reply) => {
      await usersService.activate(request.params.id, request.user!.userId);
      return { success: true, message: 'User activated' };
    }
  );
}
