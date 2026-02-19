// Notification Service
// Orchestrates sending notifications through multiple channels

import { Queue, Worker, Job } from 'bullmq';
import { prisma } from '../../../config/database.js';
import { bullmqRedis, cache } from '../../../config/redis.js';
import { createLogger } from '../../../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';
import {
  initializeEmailProvider,
  sendEmail,
  closeEmailProvider,
} from './providers/email.provider.js';
import { initializeSmsProvider, sendSms } from './providers/sms.provider.js';
import { initializeWhatsAppProvider, sendWhatsApp } from './providers/whatsapp.provider.js';
import {
  getTemplate,
  renderTemplate,
  SEVERITY_LABELS,
} from './templates.js';
import type {
  NotificationPayload,
  NotificationChannel,
  NotificationPriority,
  DeliveryResult,
  NotificationJobData,
  NotificationPreferences,
  EmailOptions,
  SmsOptions,
  WhatsAppOptions,
} from './types.js';
import type { Alert } from '@prisma/client';

const logger = createLogger('notification-service');

const QUEUE_NAME = 'notifications';
const RATE_LIMIT_PREFIX = 'notification:rate:';

// Create queue
export const notificationQueue = new Queue<NotificationJobData>(QUEUE_NAME, {
  connection: bullmqRedis,
  defaultJobOptions: {
    removeOnComplete: 500,
    removeOnFail: 1000,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 10000,
    },
  },
});

// Create worker
export const notificationWorker = new Worker<NotificationJobData>(
  QUEUE_NAME,
  async (job: Job<NotificationJobData>) => {
    const { payload, options, retryCount } = job.data;

    logger.debug(
      {
        notificationId: payload.id,
        channel: payload.channel,
        recipient: payload.recipient,
      },
      'Processing notification'
    );

    let result: DeliveryResult;

    switch (payload.channel) {
      case 'email':
        result = await sendEmail(payload, options as EmailOptions);
        break;
      case 'sms':
        result = await sendSms(payload, options as SmsOptions);
        break;
      case 'whatsapp':
        result = await sendWhatsApp(payload, options as WhatsAppOptions);
        break;
      default:
        result = {
          success: false,
          messageId: payload.id,
          status: 'failed',
          error: `Unsupported channel: ${payload.channel}`,
        };
    }

    // Log result
    await logNotification(payload, result);

    if (!result.success) {
      throw new Error(result.error || 'Notification failed');
    }

    return result;
  },
  {
    connection: bullmqRedis,
    concurrency: 10,
    limiter: {
      max: 50,
      duration: 10000,
    },
  }
);

// Event handlers
notificationWorker.on('completed', (job, result) => {
  logger.info(
    {
      jobId: job.id,
      notificationId: job.data.payload.id,
      channel: job.data.payload.channel,
    },
    'Notification sent successfully'
  );
});

notificationWorker.on('failed', (job, err) => {
  logger.error(
    {
      jobId: job?.id,
      notificationId: job?.data.payload.id,
      error: err.message,
    },
    'Notification failed'
  );
});

// Log notification to database
async function logNotification(
  payload: NotificationPayload,
  result: DeliveryResult
): Promise<void> {
  try {
    // Update alert with notification record
    const alert = await prisma.alert.findUnique({
      where: { id: payload.alertId },
      select: { notificationsSent: true },
    });

    if (alert) {
      const notifications = (alert.notificationsSent as unknown[]) || [];
      notifications.push({
        id: payload.id,
        channel: payload.channel,
        recipient: payload.recipient,
        status: result.status,
        externalId: result.externalId,
        sentAt: new Date().toISOString(),
        error: result.error,
      });

      await prisma.alert.update({
        where: { id: payload.alertId },
        data: { notificationsSent: notifications },
      });
    }
  } catch (error) {
    logger.error({ error, payloadId: payload.id }, 'Failed to log notification');
  }
}

// Check rate limit for recipient
async function checkRateLimit(
  recipient: string,
  channel: NotificationChannel
): Promise<boolean> {
  const key = `${RATE_LIMIT_PREFIX}${channel}:${recipient}`;
  const count = await redis.incr(key);

  if (count === 1) {
    // Set expiry on first increment (1 hour window)
    await redis.expire(key, 3600);
  }

  // Limits per channel per hour
  const limits: Record<NotificationChannel, number> = {
    email: 20,
    sms: 10,
    whatsapp: 10,
    push: 50,
    webhook: 100,
  };

  return count <= limits[channel];
}

// Check if user should receive notification based on preferences
function shouldNotify(
  preferences: NotificationPreferences | undefined,
  channel: NotificationChannel,
  severity: string,
  municipalityId?: string
): boolean {
  if (!preferences) return true;

  // Check channel preference
  if (preferences.channels && !preferences.channels[channel as keyof typeof preferences.channels]) {
    return false;
  }

  // Check quiet hours
  if (preferences.quietHours?.enabled) {
    const now = new Date();
    const [startH, startM] = preferences.quietHours.start.split(':').map(Number);
    const [endH, endM] = preferences.quietHours.end.split(':').map(Number);

    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    const inQuietHours =
      startMinutes < endMinutes
        ? currentMinutes >= startMinutes && currentMinutes < endMinutes
        : currentMinutes >= startMinutes || currentMinutes < endMinutes;

    if (inQuietHours) {
      // Allow critical alerts through
      if (!preferences.quietHours.exceptCritical || severity !== 'max_alert') {
        return false;
      }
    }
  }

  // Check severity filter
  if (preferences.severityFilter?.minSeverity) {
    const severityOrder = ['observation', 'attention', 'alert', 'max_alert'];
    const minIndex = severityOrder.indexOf(preferences.severityFilter.minSeverity);
    const currentIndex = severityOrder.indexOf(severity);

    if (currentIndex < minIndex) {
      return false;
    }
  }

  // Check municipality filter
  if (preferences.municipalityFilter?.length && municipalityId) {
    if (!preferences.municipalityFilter.includes(municipalityId)) {
      return false;
    }
  }

  return true;
}

// Build notification payload from alert
function buildPayload(
  alert: Alert & { municipality?: { name: string } | null },
  recipient: { id: string; email?: string; phone?: string; name: string },
  channel: NotificationChannel,
  templateType: string
): NotificationPayload | null {
  const template = getTemplate(
    channel as 'email' | 'sms' | 'whatsapp',
    templateType
  );

  if (!template) {
    logger.warn({ channel, templateType }, 'Template not found');
    return null;
  }

  const dashboardUrl = `${process.env.APP_URL || 'https://radar.defesacivil.gov.br'}/alertas/${alert.id}`;

  const variables = {
    alertTitle: alert.title,
    alertDescription: alert.description || '',
    municipalityName: alert.municipality?.name || 'N/A',
    severity: alert.severity,
    severityLabel: SEVERITY_LABELS[alert.severity] || alert.severity,
    triggerValue: String(alert.triggerValue || 0),
    thresholdValue: String(alert.thresholdValue || 0),
    unit: 'mm',
    alertTime: alert.startedAt.toLocaleString('pt-BR'),
    alertId: alert.id,
    recipientName: recipient.name,
    dashboardUrl,
  };

  const rendered = renderTemplate(template, variables);

  let recipientAddress: string;
  switch (channel) {
    case 'email':
      recipientAddress = recipient.email || '';
      break;
    case 'sms':
    case 'whatsapp':
      recipientAddress = recipient.phone || '';
      break;
    default:
      recipientAddress = recipient.id;
  }

  if (!recipientAddress) {
    return null;
  }

  const priority: NotificationPriority =
    alert.severity === 'max_alert'
      ? 'critical'
      : alert.severity === 'alert'
      ? 'high'
      : 'normal';

  return {
    id: uuidv4(),
    alertId: alert.id,
    channel,
    recipient: recipientAddress,
    recipientName: recipient.name,
    subject: rendered.subject,
    body: rendered.body,
    htmlBody: rendered.html,
    priority,
    metadata: {
      severity: alert.severity,
      municipalityId: alert.municipalityId,
    },
    createdAt: new Date(),
  };
}

// Send notifications for an alert
export async function sendAlertNotifications(alertId: string): Promise<number> {
  const alert = await prisma.alert.findUnique({
    where: { id: alertId },
    include: {
      municipality: { select: { id: true, name: true } },
      rule: { select: { actions: true } },
    },
  });

  if (!alert) {
    logger.warn({ alertId }, 'Alert not found');
    return 0;
  }

  const actions = alert.rule?.actions as {
    notify?: boolean;
    channels?: NotificationChannel[];
    recipients?: string[];
  };

  if (!actions?.notify) {
    return 0;
  }

  const channels = actions.channels || ['email'];

  // Get recipients
  const where: { isActive: boolean; consortiumId?: string; id?: { in: string[] } } = {
    isActive: true,
  };

  if (actions.recipients?.length) {
    where.id = { in: actions.recipients };
  } else if (alert.consortiumId) {
    where.consortiumId = alert.consortiumId;
  }

  const users = await prisma.user.findMany({
    where,
    select: {
      id: true,
      email: true,
      phone: true,
      name: true,
      notificationPreferences: true,
    },
  });

  let notificationCount = 0;
  const templateType = 'alert_new';

  for (const user of users) {
    const preferences = user.notificationPreferences as NotificationPreferences | undefined;

    for (const channel of channels) {
      // Check if user should receive this notification
      if (!shouldNotify(preferences, channel, alert.severity, alert.municipalityId || undefined)) {
        continue;
      }

      // Check rate limit
      const recipientKey = channel === 'email' ? user.email! : user.phone || user.id;
      if (!(await checkRateLimit(recipientKey, channel))) {
        logger.warn(
          { userId: user.id, channel },
          'Rate limit exceeded, skipping notification'
        );
        continue;
      }

      // Build payload
      const payload = buildPayload(alert, user, channel, templateType);

      if (!payload) {
        continue;
      }

      // Queue notification
      await notificationQueue.add(
        `${channel}-${alert.id}-${user.id}`,
        { payload },
        {
          priority: payload.priority === 'critical' ? 1 : payload.priority === 'high' ? 2 : 5,
        }
      );

      notificationCount++;
    }
  }

  logger.info(
    { alertId, notificationCount },
    'Alert notifications queued'
  );

  return notificationCount;
}

// Initialize all providers
export function initializeNotificationProviders(): void {
  initializeEmailProvider();
  initializeSmsProvider();
  initializeWhatsAppProvider();
  logger.info('Notification providers initialized');
}

// Shutdown
export async function shutdownNotificationService(): Promise<void> {
  await notificationWorker.close();
  await notificationScheduler.close();
  await notificationQueue.close();
  await closeEmailProvider();
  logger.info('Notification service shutdown');
}

// Export service
export const notificationService = {
  sendAlertNotifications,
  initializeNotificationProviders,
  shutdownNotificationService,
  checkRateLimit,
};
