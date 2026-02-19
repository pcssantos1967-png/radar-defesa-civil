// Notification Service Types

export type NotificationChannel = 'email' | 'sms' | 'whatsapp' | 'push' | 'webhook';

export type NotificationPriority = 'low' | 'normal' | 'high' | 'critical';

export type NotificationStatus =
  | 'pending'
  | 'sending'
  | 'sent'
  | 'delivered'
  | 'failed'
  | 'bounced';

// Base notification payload
export interface NotificationPayload {
  id: string;
  alertId: string;
  channel: NotificationChannel;
  recipient: string;
  recipientName?: string;
  subject: string;
  body: string;
  htmlBody?: string;
  priority: NotificationPriority;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  scheduledFor?: Date;
  expiresAt?: Date;
}

// Email-specific options
export interface EmailOptions {
  from?: string;
  replyTo?: string;
  cc?: string[];
  bcc?: string[];
  attachments?: Array<{
    filename: string;
    content: string | Buffer;
    contentType?: string;
  }>;
  trackOpens?: boolean;
  trackClicks?: boolean;
}

// SMS-specific options
export interface SmsOptions {
  senderId?: string;
  unicode?: boolean;
  maxParts?: number;
}

// WhatsApp-specific options
export interface WhatsAppOptions {
  templateName?: string;
  templateLanguage?: string;
  templateVariables?: string[];
  mediaUrl?: string;
  mediaType?: 'image' | 'document' | 'audio' | 'video';
}

// Webhook-specific options
export interface WebhookOptions {
  url: string;
  method: 'POST' | 'PUT';
  headers?: Record<string, string>;
  retryCount?: number;
}

// Delivery result
export interface DeliveryResult {
  success: boolean;
  messageId?: string;
  externalId?: string;
  status: NotificationStatus;
  error?: string;
  deliveredAt?: Date;
  metadata?: Record<string, unknown>;
}

// Notification template
export interface NotificationTemplate {
  id: string;
  name: string;
  channel: NotificationChannel;
  subject: string;
  bodyTemplate: string;
  htmlTemplate?: string;
  variables: string[];
  isActive: boolean;
}

// User notification preferences
export interface NotificationPreferences {
  channels: {
    email: boolean;
    sms: boolean;
    whatsapp: boolean;
    push: boolean;
  };
  quietHours?: {
    enabled: boolean;
    start: string; // HH:mm
    end: string;
    timezone: string;
    exceptCritical: boolean;
  };
  severityFilter?: {
    minSeverity: 'observation' | 'attention' | 'alert' | 'max_alert';
  };
  municipalityFilter?: string[];
  alertTypes?: string[];
}

// Rate limit configuration
export interface RateLimitConfig {
  maxPerMinute: number;
  maxPerHour: number;
  maxPerDay: number;
}

// Notification job data
export interface NotificationJobData {
  payload: NotificationPayload;
  options?: EmailOptions | SmsOptions | WhatsAppOptions | WebhookOptions;
  retryCount?: number;
}

// Notification log entry
export interface NotificationLog {
  id: string;
  notificationId: string;
  alertId: string;
  channel: NotificationChannel;
  recipient: string;
  status: NotificationStatus;
  externalId?: string;
  sentAt?: Date;
  deliveredAt?: Date;
  error?: string;
  metadata?: Record<string, unknown>;
}
