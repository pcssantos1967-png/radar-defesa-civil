import { beforeAll, afterAll } from 'vitest';

// Integration test setup - uses real database
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://test:test@localhost:5432/radar_test';
process.env.REDIS_URL = process.env.TEST_REDIS_URL || 'redis://localhost:6379/1';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-integration-testing';

beforeAll(async () => {
  console.log('Starting integration tests...');
  // Database migrations would run here in a real setup
});

afterAll(async () => {
  console.log('Integration tests completed.');
  // Cleanup database here
});
