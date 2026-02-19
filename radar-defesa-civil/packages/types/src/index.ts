// Core entities
export interface Consortium {
  id: string;
  name: string;
  code: string;
  settings: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface Municipality {
  id: string;
  consortiumId: string | null;
  ibgeCode: string;
  name: string;
  stateCode: string;
  population: number | null;
  areaKm2: number | null;
  alertThresholds: AlertThresholds;
  createdAt: Date;
  updatedAt: Date;
}

export interface AlertThresholds {
  precipitation_1h?: {
    attention: number;
    alert: number;
    max_alert: number;
  };
  precipitation_24h?: {
    attention: number;
    alert: number;
    max_alert: number;
  };
}

// Radar
export interface Radar {
  id: string;
  name: string;
  code: string;
  latitude: number;
  longitude: number;
  elevationM: number | null;
  rangeKm: number;
  scanIntervalMinutes: number;
  manufacturer: string | null;
  model: string | null;
  band: string;
  status: RadarStatus;
  lastScanAt: Date | null;
  metadata: Record<string, unknown>;
}

export type RadarStatus = 'operational' | 'maintenance' | 'offline';

export type RadarProductType = 'PPI' | 'CAPPI' | 'MAX-Z' | 'VIL' | 'ECHO-TOP' | 'QPE';

export interface RadarScan {
  id: number;
  radarId: string;
  scanTime: Date;
  elevationAngle: number | null;
  productType: RadarProductType;
  filePath: string | null;
  tilePath: string | null;
  qualityScore: number | null;
  metadata: Record<string, unknown>;
}

// Alerts
export type AlertSeverity = 'observation' | 'attention' | 'alert' | 'max_alert';
export type AlertStatus = 'active' | 'acknowledged' | 'resolved' | 'expired';

export interface Alert {
  id: string;
  consortiumId: string | null;
  municipalityId: string | null;
  ruleId: string | null;
  severity: AlertSeverity;
  type: string;
  title: string;
  description: string | null;
  triggerValue: number | null;
  thresholdValue: number | null;
  status: AlertStatus;
  startedAt: Date;
  endedAt: Date | null;
  expiresAt: Date | null;
  acknowledgedBy: string | null;
  acknowledgedAt: Date | null;
  resolvedBy: string | null;
  resolvedAt: Date | null;
  notificationsSent: NotificationRecord[];
  metadata: Record<string, unknown>;
}

export interface NotificationRecord {
  channel: string;
  sentAt: string;
  recipient?: string;
  status: string;
}

export interface AlertRule {
  id: string;
  consortiumId: string | null;
  municipalityId: string | null;
  name: string;
  description: string | null;
  type: string;
  conditions: AlertRuleConditions;
  actions: AlertRuleActions;
  cooldownMinutes: number;
  isActive: boolean;
  priority: number;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AlertRuleConditions {
  threshold: number;
  periodHours?: number;
  severity: AlertSeverity;
}

export interface AlertRuleActions {
  notify: boolean;
  channels?: string[];
  escalate?: boolean;
}

// Precipitation
export interface PrecipitationObservation {
  id: number;
  municipalityId: string;
  observationTime: Date;
  source: 'radar' | 'gauge' | 'satellite' | 'merged';
  sourceId: string | null;
  precipitationMm: number | null;
  reflectivityDbz: number | null;
  confidence: number | null;
  metadata: Record<string, unknown>;
}

// Nowcasting
export interface ConvectiveCell {
  id: string;
  trackId: string;
  detectionTime: Date;
  centroidLat: number;
  centroidLng: number;
  maxReflectivityDbz: number | null;
  vil: number | null;
  echoTopKm: number | null;
  areaKm2: number | null;
  velocityMs: number | null;
  directionDeg: number | null;
  severity: 'weak' | 'moderate' | 'strong' | 'severe' | null;
  isActive: boolean;
  metadata: Record<string, unknown>;
}

// Users
export type UserRole = 'admin' | 'operator' | 'manager' | 'viewer' | 'api_user';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  consortiumId: string | null;
  municipalityIds: string[];
  phone: string | null;
  avatarUrl: string | null;
  notificationPreferences: NotificationPreferences;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationPreferences {
  email?: boolean;
  sms?: boolean;
  whatsapp?: boolean;
  push?: boolean;
  severities?: AlertSeverity[];
}

// API Responses
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
}

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// WebSocket Events
export interface WsRadarUpdate {
  radarId: string;
  scanTime: string;
  productType: RadarProductType;
  tilePath: string;
}

export interface WsAlertEvent {
  id: string;
  severity: AlertSeverity;
  type: string;
  title: string;
  municipalityId?: string;
  consortiumId?: string;
}

export interface WsPrecipitationUpdate {
  municipalityId: string;
  precipitationMm: number;
  timestamp: string;
}
