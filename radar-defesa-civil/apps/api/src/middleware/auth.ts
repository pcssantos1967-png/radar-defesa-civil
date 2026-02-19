import { FastifyRequest, FastifyReply } from 'fastify';
import { UnauthorizedError, ForbiddenError } from '../utils/errors.js';

export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
  consortiumId?: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: JwtPayload;
  }
}

export async function authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    const token = request.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      throw new UnauthorizedError('No token provided');
    }

    const decoded = await request.server.jwt.verify<JwtPayload>(token);
    request.user = decoded;
  } catch (error) {
    throw new UnauthorizedError('Invalid or expired token');
  }
}

export function authorize(...allowedRoles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    await authenticate(request, reply);

    if (!request.user) {
      throw new UnauthorizedError('Authentication required');
    }

    if (!allowedRoles.includes(request.user.role)) {
      throw new ForbiddenError('Insufficient permissions');
    }
  };
}

// Role-based access control helpers
export const Roles = {
  ADMIN: 'admin',
  OPERATOR: 'operator',
  MANAGER: 'manager',
  VIEWER: 'viewer',
  API_USER: 'api_user',
} as const;

export type Role = (typeof Roles)[keyof typeof Roles];

export const RoleHierarchy: Record<Role, number> = {
  admin: 100,
  manager: 75,
  operator: 50,
  viewer: 25,
  api_user: 10,
};

export function hasPermission(userRole: Role, requiredRole: Role): boolean {
  return RoleHierarchy[userRole] >= RoleHierarchy[requiredRole];
}
