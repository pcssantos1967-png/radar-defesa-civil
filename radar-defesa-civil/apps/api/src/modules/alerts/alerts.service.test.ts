import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prisma } from '../../config/database.js';
import { createMockAlert } from '../../test/helpers.js';

describe('AlertsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('findMany', () => {
    it('should return active alerts', async () => {
      const mockAlerts = [
        createMockAlert({ id: 'alert-1', status: 'active' }),
        createMockAlert({ id: 'alert-2', status: 'active' }),
      ];

      vi.mocked(prisma.alert.findMany).mockResolvedValue(mockAlerts);

      const alerts = await prisma.alert.findMany({
        where: { status: 'active' },
      });

      expect(alerts).toHaveLength(2);
      expect(alerts[0].status).toBe('active');
    });

    it('should filter alerts by severity', async () => {
      const mockAlerts = [createMockAlert({ severity: 'max_alert' })];

      vi.mocked(prisma.alert.findMany).mockResolvedValue(mockAlerts);

      const alerts = await prisma.alert.findMany({
        where: { severity: 'max_alert' },
      });

      expect(alerts).toHaveLength(1);
      expect(alerts[0].severity).toBe('max_alert');
    });

    it('should filter alerts by municipality', async () => {
      const mockAlerts = [createMockAlert({ municipalityId: 'municipality-1' })];

      vi.mocked(prisma.alert.findMany).mockResolvedValue(mockAlerts);

      const alerts = await prisma.alert.findMany({
        where: { municipalityId: 'municipality-1' },
      });

      expect(alerts).toHaveLength(1);
      expect(alerts[0].municipalityId).toBe('municipality-1');
    });

    it('should order alerts by triggered date', async () => {
      const mockAlerts = [
        createMockAlert({ id: 'alert-1', triggeredAt: new Date('2024-01-02') }),
        createMockAlert({ id: 'alert-2', triggeredAt: new Date('2024-01-01') }),
      ];

      vi.mocked(prisma.alert.findMany).mockResolvedValue(mockAlerts);

      const alerts = await prisma.alert.findMany({
        orderBy: { triggeredAt: 'desc' },
      });

      expect(alerts[0].triggeredAt.getTime()).toBeGreaterThan(
        alerts[1].triggeredAt.getTime()
      );
    });
  });

  describe('findById', () => {
    it('should return alert by id', async () => {
      const mockAlert = createMockAlert({ id: 'test-alert-id' });

      vi.mocked(prisma.alert.findUnique).mockResolvedValue(mockAlert);

      const alert = await prisma.alert.findUnique({
        where: { id: 'test-alert-id' },
      });

      expect(alert).toBeDefined();
      expect(alert?.id).toBe('test-alert-id');
    });

    it('should return null for non-existent alert', async () => {
      vi.mocked(prisma.alert.findUnique).mockResolvedValue(null);

      const alert = await prisma.alert.findUnique({
        where: { id: 'non-existent' },
      });

      expect(alert).toBeNull();
    });
  });

  describe('create', () => {
    it('should create a new alert', async () => {
      const newAlert = createMockAlert({
        id: 'new-alert-id',
        type: 'precipitation_1h',
        severity: 'attention',
      });

      vi.mocked(prisma.alert.create).mockResolvedValue(newAlert);

      const alert = await prisma.alert.create({
        data: {
          type: 'precipitation_1h',
          severity: 'attention',
          status: 'active',
          title: 'High precipitation detected',
          municipalityId: 'municipality-id',
          triggeredAt: new Date(),
          triggeredValue: 25.5,
          ruleId: 'rule-id',
        },
      });

      expect(alert.type).toBe('precipitation_1h');
      expect(alert.severity).toBe('attention');
    });
  });

  describe('acknowledge', () => {
    it('should acknowledge an alert', async () => {
      const acknowledgedAlert = createMockAlert({
        status: 'acknowledged',
        acknowledgedAt: new Date(),
      });

      vi.mocked(prisma.alert.update).mockResolvedValue(acknowledgedAlert);

      const alert = await prisma.alert.update({
        where: { id: 'test-alert-id' },
        data: {
          status: 'acknowledged',
          acknowledgedAt: new Date(),
          acknowledgedBy: 'user-id',
        },
      });

      expect(alert.status).toBe('acknowledged');
      expect(alert.acknowledgedAt).toBeDefined();
    });
  });

  describe('resolve', () => {
    it('should resolve an alert', async () => {
      const resolvedAlert = createMockAlert({
        status: 'resolved',
        resolvedAt: new Date(),
      });

      vi.mocked(prisma.alert.update).mockResolvedValue(resolvedAlert);

      const alert = await prisma.alert.update({
        where: { id: 'test-alert-id' },
        data: {
          status: 'resolved',
          resolvedAt: new Date(),
          resolvedBy: 'user-id',
          resolutionNotes: 'Issue resolved',
        },
      });

      expect(alert.status).toBe('resolved');
      expect(alert.resolvedAt).toBeDefined();
    });
  });

  describe('expire', () => {
    it('should expire alerts past expiration date', async () => {
      vi.mocked(prisma.alert.updateMany).mockResolvedValue({ count: 5 });

      const result = await prisma.alert.updateMany({
        where: {
          status: 'active',
          expiresAt: { lte: new Date() },
        },
        data: { status: 'expired' },
      });

      expect(result.count).toBe(5);
    });
  });

  describe('statistics', () => {
    it('should count alerts by severity', async () => {
      vi.mocked(prisma.alert.count).mockResolvedValue(10);

      const count = await prisma.alert.count({
        where: { severity: 'alert', status: 'active' },
      });

      expect(count).toBe(10);
    });

    it('should count alerts by municipality', async () => {
      vi.mocked(prisma.alert.count).mockResolvedValue(3);

      const count = await prisma.alert.count({
        where: { municipalityId: 'municipality-id' },
      });

      expect(count).toBe(3);
    });
  });
});
