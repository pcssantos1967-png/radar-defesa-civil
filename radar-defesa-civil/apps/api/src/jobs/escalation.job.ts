// Alert Escalation Background Job
// Checks for unacknowledged alerts and escalates them

import { Queue, Worker, Job } from 'bullmq';
import { prisma } from '../config/database.js';
import { bullmqRedis } from '../config/redis.js';
import { getWebSocketServer } from '../websocket/gateway.js';
import { sendAlertNotifications } from '../modules/alerts/notifications/index.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('escalation-job');
const QUEUE_NAME = 'alert-escalation';

// Severity order for escalation
const SEVERITY_ORDER = ['observation', 'attention', 'alert', 'max_alert'];

interface EscalationJobData {
  alertId?: string;
  checkAll?: boolean;
}

// Create queue
export const escalationQueue = new Queue<EscalationJobData>(QUEUE_NAME, {
  connection: bullmqRedis,
  defaultJobOptions: {
    removeOnComplete: 50,
    removeOnFail: 200,
    attempts: 2,
  },
});

// Process escalation jobs
export const escalationWorker = new Worker<EscalationJobData>(
  QUEUE_NAME,
  async (job: Job<EscalationJobData>) => {
    const { alertId, checkAll } = job.data;

    if (checkAll) {
      return processAllPendingEscalations();
    }

    if (alertId) {
      return processAlertEscalation(alertId);
    }
  },
  {
    connection: bullmqRedis,
    concurrency: 3,
  }
);

// Process single alert escalation
async function processAlertEscalation(alertId: string): Promise<void> {
  const alert = await prisma.alert.findUnique({
    where: { id: alertId },
    include: {
      rule: { select: { actions: true } },
      municipality: { select: { name: true } },
    },
  });

  if (!alert || alert.status !== 'active') {
    return;
  }

  const actions = alert.rule?.actions as {
    escalate?: boolean;
    escalateAfterMinutes?: number;
    escalateTo?: string[];
  };

  if (!actions?.escalate) {
    return;
  }

  const escalateAfterMs = (actions.escalateAfterMinutes || 30) * 60 * 1000;
  const timeSinceCreation = Date.now() - alert.startedAt.getTime();

  if (timeSinceCreation < escalateAfterMs) {
    // Not yet time to escalate, schedule for later
    const delayMs = escalateAfterMs - timeSinceCreation;
    await escalationQueue.add(
      `escalate-${alertId}`,
      { alertId },
      { delay: delayMs }
    );
    return;
  }

  // Time to escalate
  const currentSeverityIndex = SEVERITY_ORDER.indexOf(alert.severity);

  if (currentSeverityIndex < SEVERITY_ORDER.length - 1) {
    const newSeverity = SEVERITY_ORDER[currentSeverityIndex + 1];

    await prisma.alert.update({
      where: { id: alertId },
      data: {
        severity: newSeverity,
        metadata: {
          ...(alert.metadata as object || {}),
          escalated: true,
          escalatedAt: new Date().toISOString(),
          previousSeverity: alert.severity,
          escalationReason: 'Não reconhecido no prazo',
        },
      },
    });

    logger.info(
      { alertId, previousSeverity: alert.severity, newSeverity },
      'Alert escalated'
    );

    // Broadcast escalation via WebSocket
    const wsServer = getWebSocketServer();
    if (wsServer) {
      wsServer.emit('alert:escalated', {
        alertId,
        previousSeverity: alert.severity,
        newSeverity,
        timestamp: new Date().toISOString(),
      });
    }

    // Send escalation notifications
    try {
      await sendAlertNotifications(alertId);
    } catch (error) {
      logger.error({ error, alertId }, 'Failed to send escalation notifications');
    }

    // Schedule next escalation check if not at max
    if (currentSeverityIndex + 1 < SEVERITY_ORDER.length - 1) {
      await escalationQueue.add(
        `escalate-${alertId}`,
        { alertId },
        { delay: escalateAfterMs }
      );
    }
  }
}

// Process all pending escalations
async function processAllPendingEscalations(): Promise<number> {
  const activeAlerts = await prisma.alert.findMany({
    where: {
      status: 'active',
      acknowledgedAt: null,
    },
    include: {
      rule: { select: { actions: true } },
    },
  });

  let escalatedCount = 0;

  for (const alert of activeAlerts) {
    const actions = alert.rule?.actions as {
      escalate?: boolean;
      escalateAfterMinutes?: number;
    };

    if (!actions?.escalate) {
      continue;
    }

    const escalateAfterMs = (actions.escalateAfterMinutes || 30) * 60 * 1000;
    const timeSinceCreation = Date.now() - alert.startedAt.getTime();

    if (timeSinceCreation >= escalateAfterMs) {
      await processAlertEscalation(alert.id);
      escalatedCount++;
    }
  }

  logger.info({ escalatedCount }, 'Processed pending escalations');
  return escalatedCount;
}

// Schedule escalation check for a new alert
export async function scheduleAlertEscalation(
  alertId: string,
  delayMinutes: number
): Promise<void> {
  await escalationQueue.add(
    `escalate-${alertId}`,
    { alertId },
    { delay: delayMinutes * 60 * 1000 }
  );
}

// Setup periodic escalation check
export async function setupPeriodicEscalationCheck(
  intervalMinutes: number = 10
): Promise<void> {
  // Remove existing repeatable jobs
  const repeatableJobs = await escalationQueue.getRepeatableJobs();
  for (const job of repeatableJobs) {
    await escalationQueue.removeRepeatableByKey(job.key);
  }

  // Add periodic check
  await escalationQueue.add(
    'check-all',
    { checkAll: true },
    {
      repeat: {
        every: intervalMinutes * 60 * 1000,
      },
    }
  );

  logger.info(
    `Periodic escalation check scheduled every ${intervalMinutes} minutes`
  );
}

// Event handlers
escalationWorker.on('completed', (job) => {
  logger.debug({ jobId: job.id }, 'Escalation job completed');
});

escalationWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, error: err.message }, 'Escalation job failed');
});

// Shutdown
export async function shutdownEscalation(): Promise<void> {
  await escalationWorker.close();
  await escalationScheduler.close();
  await escalationQueue.close();
  logger.info('Escalation service shutdown');
}
