// WhatsApp Notification Provider
// Uses Twilio WhatsApp API or Meta Cloud API

import Twilio from 'twilio';
import type { DeliveryResult, WhatsAppOptions, NotificationPayload } from '../types.js';
import { env } from '../../../../config/env.js';
import { createLogger } from '../../../../utils/logger.js';

const logger = createLogger('whatsapp-provider');

let twilioClient: ReturnType<typeof Twilio> | null = null;
let metaAccessToken: string | null = null;
let metaPhoneNumberId: string | null = null;

// Initialize WhatsApp provider
export function initializeWhatsAppProvider(): void {
  // Try Twilio first
  const twilioSid = env.TWILIO_ACCOUNT_SID;
  const twilioToken = env.TWILIO_AUTH_TOKEN;

  if (twilioSid && twilioToken) {
    twilioClient = Twilio(twilioSid, twilioToken);
    logger.info('WhatsApp provider (Twilio) initialized');
    return;
  }

  // Try Meta Cloud API
  metaAccessToken = env.META_WHATSAPP_ACCESS_TOKEN || null;
  metaPhoneNumberId = env.META_WHATSAPP_PHONE_NUMBER_ID || null;

  if (metaAccessToken && metaPhoneNumberId) {
    logger.info('WhatsApp provider (Meta Cloud API) initialized');
    return;
  }

  logger.warn('WhatsApp credentials not configured, provider disabled');
}

// Format phone number for WhatsApp
function formatWhatsAppNumber(phone: string, useTwilio: boolean): string {
  let cleaned = phone.replace(/\D/g, '');

  if (!cleaned.startsWith('55')) {
    cleaned = '55' + cleaned;
  }

  if (cleaned.length === 12 && cleaned.charAt(4) !== '9') {
    cleaned = cleaned.slice(0, 4) + '9' + cleaned.slice(4);
  }

  // Twilio uses whatsapp: prefix
  if (useTwilio) {
    return 'whatsapp:+' + cleaned;
  }

  return cleaned;
}

// Send via Twilio WhatsApp
async function sendViaTwilio(
  payload: NotificationPayload,
  options?: WhatsAppOptions
): Promise<DeliveryResult> {
  if (!twilioClient) {
    return {
      success: false,
      messageId: payload.id,
      status: 'failed',
      error: 'Twilio client not initialized',
    };
  }

  const fromNumber = env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886';

  try {
    const toNumber = formatWhatsAppNumber(payload.recipient, true);

    const messageOptions: {
      body: string;
      from: string;
      to: string;
      mediaUrl?: string[];
    } = {
      body: payload.body,
      from: fromNumber,
      to: toNumber,
    };

    if (options?.mediaUrl) {
      messageOptions.mediaUrl = [options.mediaUrl];
    }

    const message = await twilioClient.messages.create(messageOptions);

    logger.info(
      {
        messageSid: message.sid,
        recipient: toNumber,
        alertId: payload.alertId,
      },
      'WhatsApp message sent via Twilio'
    );

    return {
      success: true,
      messageId: payload.id,
      externalId: message.sid,
      status: 'sent',
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    logger.error(
      {
        error: errorMessage,
        recipient: payload.recipient,
        alertId: payload.alertId,
      },
      'WhatsApp send failed (Twilio)'
    );

    return {
      success: false,
      messageId: payload.id,
      status: 'failed',
      error: errorMessage,
    };
  }
}

// Send via Meta Cloud API
async function sendViaMeta(
  payload: NotificationPayload,
  options?: WhatsAppOptions
): Promise<DeliveryResult> {
  if (!metaAccessToken || !metaPhoneNumberId) {
    return {
      success: false,
      messageId: payload.id,
      status: 'failed',
      error: 'Meta Cloud API not configured',
    };
  }

  const toNumber = formatWhatsAppNumber(payload.recipient, false);

  try {
    const url = `https://graph.facebook.com/v18.0/${metaPhoneNumberId}/messages`;

    let bodyContent: object;

    if (options?.templateName) {
      // Send template message
      bodyContent = {
        messaging_product: 'whatsapp',
        to: toNumber,
        type: 'template',
        template: {
          name: options.templateName,
          language: {
            code: options.templateLanguage || 'pt_BR',
          },
          components: options.templateVariables
            ? [
                {
                  type: 'body',
                  parameters: options.templateVariables.map((v) => ({
                    type: 'text',
                    text: v,
                  })),
                },
              ]
            : undefined,
        },
      };
    } else {
      // Send regular text message
      bodyContent = {
        messaging_product: 'whatsapp',
        to: toNumber,
        type: 'text',
        text: {
          body: payload.body,
          preview_url: true,
        },
      };
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${metaAccessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(bodyContent),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'Meta API error');
    }

    const data = await response.json();

    logger.info(
      {
        messageId: data.messages?.[0]?.id,
        recipient: toNumber,
        alertId: payload.alertId,
      },
      'WhatsApp message sent via Meta'
    );

    return {
      success: true,
      messageId: payload.id,
      externalId: data.messages?.[0]?.id,
      status: 'sent',
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    logger.error(
      {
        error: errorMessage,
        recipient: payload.recipient,
        alertId: payload.alertId,
      },
      'WhatsApp send failed (Meta)'
    );

    return {
      success: false,
      messageId: payload.id,
      status: 'failed',
      error: errorMessage,
    };
  }
}

// Send WhatsApp notification (auto-selects provider)
export async function sendWhatsApp(
  payload: NotificationPayload,
  options?: WhatsAppOptions
): Promise<DeliveryResult> {
  if (twilioClient) {
    return sendViaTwilio(payload, options);
  }

  if (metaAccessToken && metaPhoneNumberId) {
    return sendViaMeta(payload, options);
  }

  initializeWhatsAppProvider();

  if (twilioClient) {
    return sendViaTwilio(payload, options);
  }

  if (metaAccessToken && metaPhoneNumberId) {
    return sendViaMeta(payload, options);
  }

  return {
    success: false,
    messageId: payload.id,
    status: 'failed',
    error: 'WhatsApp provider not configured',
  };
}

// Batch send WhatsApp messages
export async function sendWhatsAppBatch(
  payloads: NotificationPayload[],
  options?: WhatsAppOptions
): Promise<DeliveryResult[]> {
  const results: DeliveryResult[] = [];

  // Send sequentially to respect rate limits
  for (const payload of payloads) {
    const result = await sendWhatsApp(payload, options);
    results.push(result);

    // Delay between messages (WhatsApp has strict rate limits)
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  return results;
}
