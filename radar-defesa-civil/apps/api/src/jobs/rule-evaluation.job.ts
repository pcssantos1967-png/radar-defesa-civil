// Rule Evaluation Background Job
// Periodically evaluates alert rules for all municipalities

import { Queue, Worker, Job, QueueScheduler } from 'bullmq';
import { prisma } from '../config/database.js';
import { redis } from '../config/redis.js';
import { ruleEngine } from '../modules/alerts/rule-engine/index.js';
import { getWebSocketServer } from '../websocket/gateway.js';
import { sendAlertNotifications } from '../modules/alerts/notifications/index.js';
import type { RuleEvaluationJobData } from '../modules/alerts/rule-engine/types.js';

const QUEUE_NAME = 'rule-evaluation';

// Create queue
export const ruleEvaluationQueue = new Queue<RuleEvaluationJobData>(QUEUE_NAME, {
  connection: redis,
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 500,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
  },
});

// Create scheduler for repeated jobs
export const ruleEvaluationScheduler = new QueueScheduler(QUEUE_NAME, {
  connection: redis,
});

// Process jobs
export const ruleEvaluationWorker = new Worker<RuleEvaluationJobData>(
  QUEUE_NAME,
  async (job: Job<RuleEvaluationJobData>) => {
    const { municipalityId, ruleIds } = job.data;

    console.log(`[RuleEvaluation] Processing municipality: ${municipalityId}`);

    try {
      // Evaluate rules
      const { results, alerts } = await ruleEngine.evaluateRulesForMunicipality(
        municipalityId,
        ruleIds
      );

      // Persist new alerts
      if (alerts.length > 0) {
        const alertIds = await ruleEngine.persistAlerts(alerts);

        // Get full alert data for broadcast
        const createdAlerts = await prisma.alert.findMany({
          where: { id: { in: alertIds } },
          include: {
            municipality: {
              select: { id: true, name: true, ibgeCode: true },
            },
          },
        });

        // Broadcast via WebSocket
        const wsServer = getWebSocketServer();
        if (wsServer) {
          for (const alert of createdAlerts) {
            wsServer.to(`municipality:${municipalityId}`).emit('alert:new', {
              alert,
              timestamp: new Date().toISOString(),
            });

            // Also broadcast to consortium room
            if (alert.consortiumId) {
              wsServer.to(`consortium:${alert.consortiumId}`).emit('alert:new', {
                alert,
                timestamp: new Date().toISOString(),
              });
            }

            // Broadcast critical alerts to all
            if (alert.severity === 'max_alert' || alert.severity === 'alert') {
              wsServer.emit('alert:critical', {
                alert,
                timestamp: new Date().toISOString(),
              });
            }
          }
        }

        // Send notifications for each alert
        for (const alertId of alertIds) {
          try {
            await sendAlertNotifications(alertId);
          } catch (notifyError) {
            console.error(`[RuleEvaluation] Failed to send notifications for alert ${alertId}:`, notifyError);
          }
        }

        console.log(`[RuleEvaluation] Created ${alertIds.length} new alerts`);
      }

      // Log evaluation stats
      const triggered = results.filter((r) => r.triggered).length;
      console.log(
        `[RuleEvaluation] Municipality ${municipalityId}: ${results.length} rules evaluated, ${triggered} triggered`
      );

      return {
        municipalityId,
        rulesEvaluated: results.length,
        alertsCreated: alerts.length,
      };
    } catch (error) {
      console.error(`[RuleEvaluation] Error processing ${municipalityId}:`, error);
      throw error;
    }
  },
  {
    connection: redis,
    concurrency: 5,
    limiter: {
      max: 50,
      duration: 10000,
    },
  }
);

// Schedule evaluation for all municipalities
export async function scheduleAllMunicipalityEvaluations(): Promise<void> {
  const municipalities = await prisma.municipality.findMany({
    where: {
      consortiumId: { not: null },
    },
    select: { id: true },
  });

  console.log(
    `[RuleEvaluation] Scheduling evaluation for ${municipalities.length} municipalities`
  );

  const jobs = municipalities.map((m) => ({
    name: `evaluate-${m.id}`,
    data: { municipalityId: m.id },
  }));

  await ruleEvaluationQueue.addBulk(jobs);
}

// Schedule single municipality evaluation
export async function scheduleMunicipalityEvaluation(
  municipalityId: string,
  ruleIds?: string[]
): Promise<void> {
  await ruleEvaluationQueue.add(
    `evaluate-${municipalityId}`,
    { municipalityId, ruleIds },
    { priority: ruleIds ? 1 : 5 } // Higher priority for targeted evaluations
  );
}

// Add repeatable job for periodic evaluation
export async function setupPeriodicEvaluation(
  intervalMinutes: number = 5
): Promise<void> {
  // Remove existing repeatable jobs
  const repeatableJobs = await ruleEvaluationQueue.getRepeatableJobs();
  for (const job of repeatableJobs) {
    await ruleEvaluationQueue.removeRepeatableByKey(job.key);
  }

  // Add new repeatable job
  await ruleEvaluationQueue.add(
    'periodic-evaluation',
    {},
    {
      repeat: {
        every: intervalMinutes * 60 * 1000,
      },
    }
  );

  console.log(
    `[RuleEvaluation] Periodic evaluation scheduled every ${intervalMinutes} minutes`
  );
}

// Handle periodic evaluation trigger
ruleEvaluationWorker.on('completed', async (job) => {
  if (job.name === 'periodic-evaluation') {
    // This job triggers evaluation for all municipalities
    await scheduleAllMunicipalityEvaluations();
  }
});

// Event handlers
ruleEvaluationWorker.on('failed', (job, err) => {
  console.error(
    `[RuleEvaluation] Job ${job?.id} failed:`,
    err.message
  );
});

ruleEvaluationWorker.on('error', (err) => {
  console.error('[RuleEvaluation] Worker error:', err);
});

// Graceful shutdown
export async function shutdownRuleEvaluation(): Promise<void> {
  await ruleEvaluationWorker.close();
  await ruleEvaluationScheduler.close();
  await ruleEvaluationQueue.close();
  console.log('[RuleEvaluation] Shutdown complete');
}
