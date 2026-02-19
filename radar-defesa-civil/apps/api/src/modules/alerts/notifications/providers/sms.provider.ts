// SMS Notification Provider
// Uses Twilio for sending SMS messages

import Twilio from 'twilio';
import type { DeliveryResult, SmsOptions, NotificationPayload } from '../types.js';
import { env } from '../../../../config/env.js';
import { createLogger } from '../../../../utils/logger.js';

const logger = createLogger('sms-provider');

let twilioClient: ReturnType<typeof Twilio> | null = null;

// Initialize Twilio client
export function initializeSmsProvider(): void {
  if (twilioClient) return;

  const accountSid = env.TWILIO_ACCOUNT_SID;
  const authToken = env.TWILIO_AUTH_TOKEN;

  if (!accountSid || !authToken) {
    logger.warn('Twilio credentials not configured, SMS provider disabled');
    return;
  }

  twilioClient = Twilio(accountSid, authToken);
  logger.info('SMS provider (Twilio) initialized');
}

// Format phone number to E.164 format
function formatPhoneNumber(phone: string): string {
  // Remove all non-numeric characters
  let cleaned = phone.replace(/\D/g, '');

  // Add Brazil country code if not present
  if (!cleaned.startsWith('55')) {
    cleaned = '55' + cleaned;
  }

  // Ensure 9-digit mobile format for Brazilian numbers
  // Format: +55 DDD NNNNN-NNNN (13 digits total)
  if (cleaned.length === 12 && cleaned.charAt(4) !== '9') {
    // Add 9 prefix for mobile numbers if missing
    cleaned = cleaned.slice(0, 4) + '9' + cleaned.slice(4);
  }

  return '+' + cleaned;
}

// Truncate message to SMS limits
function truncateMessage(message: string, maxLength: number = 160): string {
  if (message.length <= maxLength) {
    return message;
  }

  // Reserve space for truncation indicator
  return message.slice(0, maxLength - 3) + '...';
}

// Send SMS notification
export async function sendSms(
  payload: NotificationPayload,
  options?: SmsOptions
): Promise<DeliveryResult> {
  if (!twilioClient) {
    initializeSmsProvider();
  }

  if (!twilioClient) {
    return {
      success: false,
      messageId: payload.id,
      status: 'failed',
      error: 'SMS provider not configured',
    };
  }

  const fromNumber = options?.senderId || env.TWILIO_PHONE_NUMBER;

  if (!fromNumber) {
    return {
      success: false,
      messageId: payload.id,
      status: 'failed',
      error: 'Twilio phone number not configured',
    };
  }

  try {
    const toNumber = formatPhoneNumber(payload.recipient);
    const maxLength = options?.maxParts ? options.maxParts * 160 : 320;
    const body = truncateMessage(payload.body, maxLength);

    const message = await twilioClient.messages.create({
      body,
      from: fromNumber,
      to: toNumber,
      statusCallback: env.TWILIO_STATUS_CALLBACK_URL,
    });

    logger.info(
      {
        messageSid: message.sid,
        recipient: toNumber,
        alertId: payload.alertId,
        status: message.status,
      },
      'SMS sent successfully'
    );

    return {
      success: true,
      messageId: payload.id,
      externalId: message.sid,
      status: message.status === 'queued' || message.status === 'sent' ? 'sent' : 'pending',
      metadata: {
        numSegments: message.numSegments,
        price: message.price,
        priceUnit: message.priceUnit,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const twilioError = error as { code?: number };

    logger.error(
      {
        error: errorMessage,
        errorCode: twilioError.code,
        recipient: payload.recipient,
        alertId: payload.alertId,
      },
      'SMS send failed'
    );

    return {
      success: false,
      messageId: payload.id,
      status: 'failed',
      error: errorMessage,
      metadata: { errorCode: twilioError.code },
    };
  }
}

// Get SMS delivery status
export async function getSmsStatus(messageSid: string): Promise<string | null> {
  if (!twilioClient) return null;

  try {
    const message = await twilioClient.messages(messageSid).fetch();
    return message.status;
  } catch (error) {
    logger.error({ error, messageSid }, 'Failed to get SMS status');
    return null;
  }
}

// Batch send SMS
export async function sendSmsBatch(
  payloads: NotificationPayload[],
  options?: SmsOptions
): Promise<DeliveryResult[]> {
  const results: DeliveryResult[] = [];

  // Send sequentially to respect rate limits
  for (const payload of payloads) {
    const result = await sendSms(payload, options);
    results.push(result);

    // Small delay between messages to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return results;
}
