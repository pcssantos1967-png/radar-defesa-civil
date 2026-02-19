// Alert Rule Engine
// Evaluates rules and triggers alerts based on conditions

import { prisma } from '../../../config/database.js';
import { cache } from '../../../config/redis.js';
import { getEvaluator } from './evaluators.js';
import type {
  AlertRuleConfig,
  RuleCondition,
  CompoundCondition,
  EvaluationContext,
  ConditionResult,
  RuleEvaluationResult,
  AlertData,
  Severity,
  SeverityMapping,
} from './types.js';

// Cooldown cache key prefix
const COOLDOWN_PREFIX = 'alert:cooldown:';

// Check if rule is in cooldown
async function isInCooldown(ruleId: string, municipalityId: string): Promise<boolean> {
  const key = `${COOLDOWN_PREFIX}${ruleId}:${municipalityId}`;
  const exists = await cache.get(key);
  return exists !== null;
}

// Set cooldown for a rule
async function setCooldown(
  ruleId: string,
  municipalityId: string,
  cooldownMinutes: number
): Promise<void> {
  const key = `${COOLDOWN_PREFIX}${ruleId}:${municipalityId}`;
  await cache.set(key, Date.now().toString(), cooldownMinutes * 60);
}

// Determine if a condition is compound
function isCompoundCondition(
  condition: RuleCondition | CompoundCondition
): condition is CompoundCondition {
  return 'logic' in condition && 'conditions' in condition;
}

// Evaluate a single condition
async function evaluateSingleCondition(
  condition: RuleCondition,
  ctx: EvaluationContext
): Promise<ConditionResult> {
  const evaluator = getEvaluator(condition.source);

  if (!evaluator) {
    return {
      conditionId: condition.id,
      matched: false,
      message: `Avaliador não encontrado para fonte: ${condition.source}`,
    };
  }

  return evaluator(condition, ctx);
}

// Recursively evaluate compound conditions
async function evaluateConditions(
  condition: RuleCondition | CompoundCondition,
  ctx: EvaluationContext
): Promise<{ matched: boolean; results: ConditionResult[] }> {
  if (!isCompoundCondition(condition)) {
    const result = await evaluateSingleCondition(condition, ctx);
    return { matched: result.matched, results: [result] };
  }

  const results: ConditionResult[] = [];
  const matchResults: boolean[] = [];

  for (const subCondition of condition.conditions) {
    const { matched, results: subResults } = await evaluateConditions(
      subCondition,
      ctx
    );
    matchResults.push(matched);
    results.push(...subResults);
  }

  const matched =
    condition.logic === 'AND'
      ? matchResults.every((r) => r)
      : matchResults.some((r) => r);

  return { matched, results };
}

// Determine severity based on value and mapping
function determineSeverity(
  value: number,
  mapping?: SeverityMapping
): Severity {
  if (!mapping) {
    return 'attention';
  }

  if (value >= mapping.maxAlert) {
    return 'max_alert';
  }
  if (value >= mapping.alert) {
    return 'alert';
  }
  if (value >= mapping.attention) {
    return 'attention';
  }
  return 'observation';
}

// Evaluate a single rule
export async function evaluateRule(
  rule: AlertRuleConfig,
  ctx: EvaluationContext
): Promise<RuleEvaluationResult> {
  const result: RuleEvaluationResult = {
    ruleId: rule.id,
    ruleName: rule.name,
    triggered: false,
    conditionResults: [],
    message: '',
    evaluatedAt: new Date(),
  };

  // Check if rule is active
  if (!rule.isActive) {
    result.message = 'Regra inativa';
    return result;
  }

  // Check cooldown
  const municipalityId = ctx.municipalityId;
  if (await isInCooldown(rule.id, municipalityId)) {
    result.message = 'Regra em cooldown';
    return result;
  }

  // Evaluate conditions
  const { matched, results } = await evaluateConditions(rule.conditions, ctx);
  result.conditionResults = results;

  if (!matched) {
    result.message = 'Condições não satisfeitas';
    return result;
  }

  // Find the highest value from matched conditions
  const maxResult = results
    .filter((r) => r.matched && r.value !== undefined)
    .sort((a, b) => (b.value || 0) - (a.value || 0))[0];

  result.triggered = true;
  result.triggerValue = maxResult?.value;
  result.thresholdValue = maxResult?.threshold;
  result.severity = determineSeverity(
    maxResult?.value || 0,
    rule.severityMapping
  );
  result.message = maxResult?.message || 'Alerta disparado';

  return result;
}

// Generate alert title based on rule type
function generateAlertTitle(rule: AlertRuleConfig, severity: Severity): string {
  const severityLabels: Record<Severity, string> = {
    observation: 'Observação',
    attention: 'Atenção',
    alert: 'Alerta',
    max_alert: 'Alerta Máximo',
  };

  const typeLabels: Record<string, string> = {
    precipitation_1h: 'Precipitação 1h',
    precipitation_24h: 'Precipitação 24h',
    reflectivity: 'Refletividade Radar',
    wind: 'Vento Forte',
    convective: 'Célula Convectiva',
    flood_risk: 'Risco de Alagamento',
  };

  const typeLabel = typeLabels[rule.type] || rule.type;
  return `${severityLabels[severity]}: ${typeLabel}`;
}

// Create alert from evaluation result
export async function createAlertFromResult(
  rule: AlertRuleConfig,
  result: RuleEvaluationResult,
  ctx: EvaluationContext
): Promise<AlertData | null> {
  if (!result.triggered || !result.severity) {
    return null;
  }

  // Check for existing active alert for this rule and municipality
  const existingAlert = await prisma.alert.findFirst({
    where: {
      ruleId: rule.id,
      municipalityId: ctx.municipalityId,
      status: { in: ['active', 'acknowledged'] },
    },
  });

  if (existingAlert) {
    // Update severity if it increased
    const severityOrder: Severity[] = [
      'observation',
      'attention',
      'alert',
      'max_alert',
    ];
    const existingSeverityIndex = severityOrder.indexOf(
      existingAlert.severity as Severity
    );
    const newSeverityIndex = severityOrder.indexOf(result.severity);

    if (newSeverityIndex > existingSeverityIndex) {
      await prisma.alert.update({
        where: { id: existingAlert.id },
        data: {
          severity: result.severity,
          triggerValue: result.triggerValue,
          metadata: {
            ...(existingAlert.metadata as object || {}),
            severityEscalated: true,
            escalatedAt: new Date().toISOString(),
            previousSeverity: existingAlert.severity,
          },
        },
      });
    }

    return null; // Don't create duplicate alert
  }

  const title = generateAlertTitle(rule, result.severity);

  return {
    ruleId: rule.id,
    consortiumId: ctx.consortiumId,
    municipalityId: ctx.municipalityId,
    severity: result.severity,
    type: rule.type,
    title,
    description: result.message,
    triggerValue: result.triggerValue || 0,
    thresholdValue: result.thresholdValue || 0,
    expiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000), // 6 hours default
    metadata: {
      conditions: result.conditionResults,
      evaluatedAt: result.evaluatedAt.toISOString(),
    },
  };
}

// Main evaluation function - evaluates all rules for a municipality
export async function evaluateRulesForMunicipality(
  municipalityId: string,
  ruleIds?: string[]
): Promise<{
  results: RuleEvaluationResult[];
  alerts: AlertData[];
}> {
  // Get municipality info
  const municipality = await prisma.municipality.findUnique({
    where: { id: municipalityId },
    select: { id: true, consortiumId: true },
  });

  if (!municipality) {
    return { results: [], alerts: [] };
  }

  // Build query for rules
  const where: {
    isActive: boolean;
    id?: { in: string[] };
    OR?: Array<{
      municipalityId?: string | null;
      consortiumId?: string | null;
    }>;
  } = {
    isActive: true,
  };

  if (ruleIds?.length) {
    where.id = { in: ruleIds };
  }

  // Get rules that apply to this municipality (specific or consortium-wide)
  where.OR = [
    { municipalityId: municipality.id },
    { municipalityId: null, consortiumId: municipality.consortiumId },
  ];

  const rules = await prisma.alertRule.findMany({
    where,
    orderBy: { priority: 'asc' },
  });

  // Create evaluation context
  const ctx: EvaluationContext = {
    municipalityId: municipality.id,
    consortiumId: municipality.consortiumId || undefined,
    timestamp: new Date(),
    cache: new Map(),
  };

  const results: RuleEvaluationResult[] = [];
  const alerts: AlertData[] = [];

  // Evaluate each rule
  for (const rule of rules) {
    const ruleConfig: AlertRuleConfig = {
      id: rule.id,
      name: rule.name,
      description: rule.description || undefined,
      type: rule.type,
      municipalityId: rule.municipalityId || undefined,
      consortiumId: rule.consortiumId || undefined,
      conditions: rule.conditions as RuleCondition | CompoundCondition,
      severityMapping: (rule.conditions as { severityMapping?: SeverityMapping })
        .severityMapping,
      actions: rule.actions as AlertRuleConfig['actions'],
      cooldownMinutes: rule.cooldownMinutes,
      priority: rule.priority,
      isActive: rule.isActive,
    };

    const result = await evaluateRule(ruleConfig, ctx);
    results.push(result);

    if (result.triggered) {
      const alert = await createAlertFromResult(ruleConfig, result, ctx);
      if (alert) {
        alerts.push(alert);

        // Set cooldown
        await setCooldown(
          rule.id,
          municipality.id,
          rule.cooldownMinutes
        );
      }
    }
  }

  return { results, alerts };
}

// Persist alerts to database
export async function persistAlerts(alerts: AlertData[]): Promise<string[]> {
  const createdIds: string[] = [];

  for (const alert of alerts) {
    const created = await prisma.alert.create({
      data: {
        ruleId: alert.ruleId,
        consortiumId: alert.consortiumId,
        municipalityId: alert.municipalityId,
        severity: alert.severity,
        type: alert.type,
        title: alert.title,
        description: alert.description,
        triggerValue: alert.triggerValue,
        thresholdValue: alert.thresholdValue,
        expiresAt: alert.expiresAt,
        metadata: alert.metadata || {},
        status: 'active',
      },
    });

    createdIds.push(created.id);
  }

  return createdIds;
}

// Export engine as singleton
export const ruleEngine = {
  evaluateRule,
  evaluateRulesForMunicipality,
  createAlertFromResult,
  persistAlerts,
  setCooldown,
  isInCooldown,
};
