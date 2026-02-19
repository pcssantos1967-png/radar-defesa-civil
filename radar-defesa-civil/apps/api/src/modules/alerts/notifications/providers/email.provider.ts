// Email Notification Provider
// Uses nodemailer for sending emails

import nodemailer, { Transporter } from 'nodemailer';
import type { DeliveryResult, EmailOptions, NotificationPayload } from '../types.js';
import { env } from '../../../../config/env.js';
import { createLogger } from '../../../../utils/logger.js';

const logger = createLogger('email-provider');

let transporter: Transporter | null = null;

// Initialize email transporter
export function initializeEmailProvider(): void {
  if (transporter) return;

  // Support different email providers via environment config
  const smtpConfig = {
    host: env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(env.SMTP_PORT) || 587,
    secure: env.SMTP_SECURE === 'true',
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },
  };

  transporter = nodemailer.createTransport(smtpConfig);

  // Verify connection
  transporter.verify((error) => {
    if (error) {
      logger.error({ error }, 'Email provider connection failed');
    } else {
      logger.info('Email provider connected successfully');
    }
  });
}

// Send email notification
export async function sendEmail(
  payload: NotificationPayload,
  options?: EmailOptions
): Promise<DeliveryResult> {
  if (!transporter) {
    initializeEmailProvider();
  }

  const from = options?.from || env.SMTP_FROM || 'alertas@defesacivil.gov.br';

  try {
    const mailOptions = {
      from,
      to: payload.recipient,
      subject: payload.subject,
      text: payload.body,
      html: payload.htmlBody,
      replyTo: options?.replyTo,
      cc: options?.cc?.join(', '),
      bcc: options?.bcc?.join(', '),
      attachments: options?.attachments,
      headers: {
        'X-Alert-ID': payload.alertId,
        'X-Priority': payload.priority === 'critical' ? '1' : '3',
      },
    };

    const result = await transporter!.sendMail(mailOptions);

    logger.info(
      {
        messageId: result.messageId,
        recipient: payload.recipient,
        alertId: payload.alertId,
      },
      'Email sent successfully'
    );

    return {
      success: true,
      messageId: payload.id,
      externalId: result.messageId,
      status: 'sent',
      deliveredAt: new Date(),
      metadata: {
        accepted: result.accepted,
        rejected: result.rejected,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    logger.error(
      {
        error: errorMessage,
        recipient: payload.recipient,
        alertId: payload.alertId,
      },
      'Email send failed'
    );

    return {
      success: false,
      messageId: payload.id,
      status: 'failed',
      error: errorMessage,
    };
  }
}

// Batch send emails
export async function sendEmailBatch(
  payloads: NotificationPayload[],
  options?: EmailOptions
): Promise<DeliveryResult[]> {
  const results: DeliveryResult[] = [];

  // Send in parallel with concurrency limit
  const batchSize = 10;
  for (let i = 0; i < payloads.length; i += batchSize) {
    const batch = payloads.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map((p) => sendEmail(p, options))
    );
    results.push(...batchResults);
  }

  return results;
}

// Close transporter
export async function closeEmailProvider(): Promise<void> {
  if (transporter) {
    transporter.close();
    transporter = null;
  }
}
