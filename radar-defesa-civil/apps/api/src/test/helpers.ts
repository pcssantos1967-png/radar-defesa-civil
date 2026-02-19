import Fastify, { FastifyInstance } from 'fastify';
import jwt from '@fastify/jwt';

/**
 * Create a test Fastify instance with common plugins
 */
export async function createTestApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: false,
  });

  await app.register(jwt, {
    secret: process.env.JWT_SECRET || 'test-secret',
  });

  return app;
}

/**
 * Generate a test JWT token
 */
export function generateTestToken(
  app: FastifyInstance,
  payload: { userId: string; role: string }
): string {
  return app.jwt.sign(payload, { expiresIn: '1h' });
}

/**
 * Create a mock user for testing
 */
export function createMockUser(overrides = {}) {
  return {
    id: 'test-user-id',
    email: 'test@example.com',
    name: 'Test User',
    role: 'operator',
    passwordHash: '$2b$10$test-hash',
    consortiumId: 'test-consortium-id',
    municipalityIds: [],
    phone: null,
    avatarUrl: null,
    notificationPreferences: {},
    isActive: true,
    emailVerifiedAt: null,
    lastLoginAt: null,
    failedLoginAttempts: 0,
    lockedUntil: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/**
 * Create a mock alert for testing
 */
export function createMockAlert(overrides = {}) {
  return {
    id: 'test-alert-id',
    type: 'precipitation_1h',
    severity: 'alert',
    status: 'active',
    title: 'Test Alert',
    description: 'Test alert description',
    municipalityId: 'test-municipality-id',
    latitude: -23.5505,
    longitude: -46.6333,
    triggeredAt: new Date(),
    acknowledgedAt: null,
    resolvedAt: null,
    expiresAt: new Date(Date.now() + 3600000),
    ruleId: 'test-rule-id',
    triggeredValue: 50.5,
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/**
 * Create mock request context
 */
export function createMockRequest(overrides = {}) {
  return {
    user: {
      userId: 'test-user-id',
      role: 'operator',
    },
    body: {},
    params: {},
    query: {},
    headers: {},
    ...overrides,
  };
}
