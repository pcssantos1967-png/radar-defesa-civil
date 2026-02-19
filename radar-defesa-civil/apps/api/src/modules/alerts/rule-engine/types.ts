// Rule Engine Types
// Defines the structure of alert rules, conditions, and actions

export type Severity = 'observation' | 'attention' | 'alert' | 'max_alert';

export type ConditionOperator =
  | 'gt'        // greater than
  | 'gte'       // greater than or equal
  | 'lt'        // less than
  | 'lte'       // less than or equal
  | 'eq'        // equal
  | 'neq'       // not equal
  | 'between'   // between two values
  | 'trend_up'  // value increasing
  | 'trend_down'; // value decreasing

export type DataSource =
  | 'precipitation_accumulated'
  | 'precipitation_rate'
  | 'radar_reflectivity'
  | 'station_precipitation'
  | 'station_temperature'
  | 'station_wind'
  | 'convective_cell'
  | 'risk_area_overlap';

export type TimeWindow = '10m' | '30m' | '1h' | '3h' | '6h' | '12h' | '24h';

export type NotificationChannel = 'email' | 'sms' | 'whatsapp' | 'push' | 'webhook';

// Base condition structure
export interface RuleCondition {
  id: string;
  source: DataSource;
  field: string;
  operator: ConditionOperator;
  value: number | [number, number]; // single value or range for 'between'
  timeWindow?: TimeWindow;
  unit?: string;
}

// Compound condition with AND/OR logic
export interface CompoundCondition {
  logic: 'AND' | 'OR';
  conditions: (RuleCondition | CompoundCondition)[];
}

// Severity escalation based on value ranges
export interface SeverityMapping {
  attention: number;
  alert: number;
  maxAlert: number;
}

// Actions to take when rule triggers
export interface RuleActions {
  notify: boolean;
  channels?: NotificationChannel[];
  recipients?: string[];  // user IDs or group names
  escalate?: boolean;
  escalateAfterMinutes?: number;
  escalateTo?: string[];  // user IDs
  webhook?: {
    url: string;
    headers?: Record<string, string>;
    method?: 'POST' | 'PUT';
  };
  customMessage?: string;
}

// Full rule configuration as stored in database
export interface AlertRuleConfig {
  id: string;
  name: string;
  description?: string;
  type: string;
  municipalityId?: string;
  consortiumId?: string;
  conditions: RuleCondition | CompoundCondition;
  severityMapping?: SeverityMapping;
  actions: RuleActions;
  cooldownMinutes: number;
  priority: number;
  isActive: boolean;
}

// Evaluation context passed to evaluators
export interface EvaluationContext {
  municipalityId: string;
  consortiumId?: string;
  timestamp: Date;
  cache: Map<string, unknown>;
}

// Result of condition evaluation
export interface ConditionResult {
  conditionId: string;
  matched: boolean;
  value?: number;
  threshold?: number;
  message?: string;
}

// Result of full rule evaluation
export interface RuleEvaluationResult {
  ruleId: string;
  ruleName: string;
  triggered: boolean;
  severity?: Severity;
  triggerValue?: number;
  thresholdValue?: number;
  conditionResults: ConditionResult[];
  message: string;
  evaluatedAt: Date;
}

// Alert generation data
export interface AlertData {
  ruleId: string;
  consortiumId?: string;
  municipalityId?: string;
  severity: Severity;
  type: string;
  title: string;
  description: string;
  triggerValue: number;
  thresholdValue: number;
  expiresAt?: Date;
  metadata?: Record<string, unknown>;
}

// Notification payload
export interface NotificationPayload {
  alertId: string;
  channel: NotificationChannel;
  recipient: string;
  subject: string;
  body: string;
  priority: 'low' | 'normal' | 'high' | 'critical';
  metadata?: Record<string, unknown>;
}

// Rule evaluation job data
export interface RuleEvaluationJobData {
  municipalityId: string;
  ruleIds?: string[];  // if not provided, evaluate all active rules
}

// Cooldown tracking
export interface CooldownEntry {
  ruleId: string;
  municipalityId: string;
  lastTriggeredAt: Date;
  cooldownUntil: Date;
}
