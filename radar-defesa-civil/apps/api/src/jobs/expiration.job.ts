// Alert Expiration Background Job
// Automatically expires alerts past their expiresAt timestamp

import { Queue, Worker, Job, QueueScheduler } from 'bullmq';
import { prisma } from '../config/database.js';
import { redis } from '../config/redis.js';
import { getWebSocketServer } from '../websocket/gateway.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('expiration-job');
const QUEUE_NAME = 'alert-expiration';

interface ExpirationJobData {
  alertId?: string;
  checkAll?: boolean;
}

// Create queue
export const expirationQueue = new Queue<ExpirationJobData>(QUEUE_NAME, {
  connection: redis,
  defaultJobOptions: {
    removeOnComplete: 50,
    removeOnFail: 100,
    attempts: 2,
  },
});

// Create scheduler
export const expirationScheduler = new QueueScheduler(QUEUE_NAME, {
  connection: redis,
});

// Process expiration jobs
export const expirationWorker = new Worker<ExpirationJobData>(
  QUEUE_NAME,
  async (job: Job<ExpirationJobData>) => {
    const { alertId, checkAll } = job.data;

    if (checkAll) {
      return processAllExpiredAlerts();
    }

    if (alertId) {
      return expireSingleAlert(alertId);
    }
  },
  {
    connection: redis,
    concurrency: 3,
  }
);

// Expire a single alert
async function expireSingleAlert(alertId: string): Promise<boolean> {
  const alert = await prisma.alert.findUnique({
    where: { id: alertId },
    include: {
      municipality: { select: { id: true, name: true } },
    },
  });

  if (!alert) {
    return false;
  }

  // Only expire active or acknowledged alerts
  if (alert.status !== 'active' && alert.status !== 'acknowledged') {
    return false;
  }

  // Check if alert has expired
  if (!alert.expiresAt || alert.expiresAt > new Date()) {
    return false;
  }

  // Update alert status
  await prisma.alert.update({
    where: { id: alertId },
    data: {
      status: 'expired',
      endedAt: new Date(),
      metadata: {
        ...(alert.metadata as object || {}),
        expiredAt: new Date().toISOString(),
        expirationReason: 'auto_expired',
      },
    },
  });

  logger.info({ alertId, municipalityName: alert.municipality?.name }, 'Alert expired');

  // Broadcast expiration via WebSocket
  const wsServer = getWebSocketServer();
  if (wsServer) {
    wsServer.emit('alert:expired', {
      alertId: alert.id,
      municipalityId: alert.municipalityId,
      consortiumId: alert.consortiumId,
      timestamp: new Date().toISOString(),
    });

    // Also emit to specific rooms
    if (alert.municipalityId) {
      wsServer.to(`municipality:${alert.municipalityId}`).emit('alert:end', {
        id: alert.id,
        reason: 'expired',
      });
    }

    if (alert.consortiumId) {
      wsServer.to(`consortium:${alert.consortiumId}`).emit('alert:end', {
        id: alert.id,
        reason: 'expired',
      });
    }
  }

  // Publish to Redis for other services
  redis.publish('alert:end', JSON.stringify({
    alertId: alert.id,
    municipalityId: alert.municipalityId,
    consortiumId: alert.consortiumId,
    reason: 'expired',
    timestamp: new Date().toISOString(),
  }));

  return true;
}

// Process all expired alerts
async function processAllExpiredAlerts(): Promise<number> {
  const now = new Date();

  // Find all alerts that should be expired
  const expiredAlerts = await prisma.alert.findMany({
    where: {
      status: { in: ['active', 'acknowledged'] },
      expiresAt: { lte: now },
    },
    select: { id: true },
  });

  let expiredCount = 0;

  for (const alert of expiredAlerts) {
    const success = await expireSingleAlert(alert.id);
    if (success) {
      expiredCount++;
    }
  }

  if (expiredCount > 0) {
    logger.info({ expiredCount }, 'Processed expired alerts');
  }

  return expiredCount;
}

// Schedule expiration check for a specific alert
export async function scheduleAlertExpiration(
  alertId: string,
  expiresAt: Date
): Promise<void> {
  const delay = Math.max(0, expiresAt.getTime() - Date.now());

  await expirationQueue.add(
    `expire-${alertId}`,
    { alertId },
    {
      delay,
      jobId: `expire-${alertId}`, // Prevent duplicates
    }
  );
}

// Setup periodic expiration check (fallback for missed individual schedules)
export async function setupPeriodicExpirationCheck(
  intervalMinutes: number = 5
): Promise<void> {
  // Remove existing repeatable jobs
  const repeatableJobs = await expirationQueue.getRepeatableJobs();
  for (const job of repeatableJobs) {
    await expirationQueue.removeRepeatableByKey(job.key);
  }

  // Add periodic check
  await expirationQueue.add(
    'check-all-expirations',
    { checkAll: true },
    {
      repeat: {
        every: intervalMinutes * 60 * 1000,
      },
    }
  );

  logger.info(
    `Periodic expiration check scheduled every ${intervalMinutes} minutes`
  );
}

// Event handlers
expirationWorker.on('completed', (job) => {
  logger.debug({ jobId: job.id }, 'Expiration job completed');
});

expirationWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, error: err.message }, 'Expiration job failed');
});

// Shutdown
export async function shutdownExpiration(): Promise<void> {
  await expirationWorker.close();
  await expirationScheduler.close();
  await expirationQueue.close();
  logger.info('Expiration service shutdown');
}
