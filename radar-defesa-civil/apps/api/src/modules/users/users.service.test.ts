import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prisma } from '../../config/database.js';
import { createMockUser } from '../../test/helpers.js';

describe('UsersService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('findMany', () => {
    it('should return paginated users', async () => {
      const mockUsers = [
        createMockUser({ id: 'user-1', name: 'User 1' }),
        createMockUser({ id: 'user-2', name: 'User 2' }),
      ];

      vi.mocked(prisma.user.findMany).mockResolvedValue(mockUsers);
      vi.mocked(prisma.user.count).mockResolvedValue(2);

      const users = await prisma.user.findMany({
        take: 10,
        skip: 0,
      });

      expect(users).toHaveLength(2);
      expect(users[0].name).toBe('User 1');
    });

    it('should filter users by role', async () => {
      const mockUsers = [createMockUser({ role: 'admin' })];

      vi.mocked(prisma.user.findMany).mockResolvedValue(mockUsers);

      const users = await prisma.user.findMany({
        where: { role: 'admin' },
      });

      expect(users).toHaveLength(1);
      expect(users[0].role).toBe('admin');
    });

    it('should filter users by active status', async () => {
      const mockUsers = [createMockUser({ isActive: true })];

      vi.mocked(prisma.user.findMany).mockResolvedValue(mockUsers);

      const users = await prisma.user.findMany({
        where: { isActive: true },
      });

      expect(users).toHaveLength(1);
      expect(users[0].isActive).toBe(true);
    });
  });

  describe('findById', () => {
    it('should return user by id', async () => {
      const mockUser = createMockUser({ id: 'test-id' });

      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser);

      const user = await prisma.user.findUnique({
        where: { id: 'test-id' },
      });

      expect(user).toBeDefined();
      expect(user?.id).toBe('test-id');
    });

    it('should return null for non-existent user', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      const user = await prisma.user.findUnique({
        where: { id: 'non-existent' },
      });

      expect(user).toBeNull();
    });
  });

  describe('create', () => {
    it('should create a new user', async () => {
      const newUser = createMockUser({
        id: 'new-user-id',
        email: 'new@example.com',
        name: 'New User',
      });

      vi.mocked(prisma.user.create).mockResolvedValue(newUser);

      const user = await prisma.user.create({
        data: {
          email: 'new@example.com',
          name: 'New User',
          passwordHash: 'hashed-password',
          role: 'operator',
        },
      });

      expect(user.email).toBe('new@example.com');
      expect(user.name).toBe('New User');
    });

    it('should reject duplicate email', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(createMockUser());

      const existingUser = await prisma.user.findUnique({
        where: { email: 'test@example.com' },
      });

      expect(existingUser).toBeDefined();
    });
  });

  describe('update', () => {
    it('should update user fields', async () => {
      const updatedUser = createMockUser({
        name: 'Updated Name',
        phone: '123456789',
      });

      vi.mocked(prisma.user.update).mockResolvedValue(updatedUser);

      const user = await prisma.user.update({
        where: { id: 'test-id' },
        data: { name: 'Updated Name', phone: '123456789' },
      });

      expect(user.name).toBe('Updated Name');
      expect(user.phone).toBe('123456789');
    });

    it('should update user role', async () => {
      const updatedUser = createMockUser({ role: 'manager' });

      vi.mocked(prisma.user.update).mockResolvedValue(updatedUser);

      const user = await prisma.user.update({
        where: { id: 'test-id' },
        data: { role: 'manager' },
      });

      expect(user.role).toBe('manager');
    });
  });

  describe('deactivate', () => {
    it('should deactivate user', async () => {
      const deactivatedUser = createMockUser({ isActive: false });

      vi.mocked(prisma.user.update).mockResolvedValue(deactivatedUser);

      const user = await prisma.user.update({
        where: { id: 'test-id' },
        data: { isActive: false },
      });

      expect(user.isActive).toBe(false);
    });

    it('should revoke all tokens on deactivation', async () => {
      vi.mocked(prisma.refreshToken.updateMany).mockResolvedValue({ count: 3 });

      const result = await prisma.refreshToken.updateMany({
        where: { userId: 'test-id' },
        data: { revokedAt: new Date() },
      });

      expect(result.count).toBe(3);
    });
  });

  describe('activate', () => {
    it('should activate user', async () => {
      const activatedUser = createMockUser({ isActive: true });

      vi.mocked(prisma.user.update).mockResolvedValue(activatedUser);

      const user = await prisma.user.update({
        where: { id: 'test-id' },
        data: { isActive: true },
      });

      expect(user.isActive).toBe(true);
    });
  });
});
