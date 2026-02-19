// Condition Evaluators
// Fetch data and evaluate conditions for different data sources

import { prisma } from '../../../config/database.js';
import { cache } from '../../../config/redis.js';
import type {
  RuleCondition,
  EvaluationContext,
  ConditionResult,
  ConditionOperator,
  TimeWindow,
} from './types.js';

// Convert time window to milliseconds
function timeWindowToMs(window: TimeWindow): number {
  const map: Record<TimeWindow, number> = {
    '10m': 10 * 60 * 1000,
    '30m': 30 * 60 * 1000,
    '1h': 60 * 60 * 1000,
    '3h': 3 * 60 * 60 * 1000,
    '6h': 6 * 60 * 60 * 1000,
    '12h': 12 * 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000,
  };
  return map[window] || 60 * 60 * 1000;
}

// Compare value against condition
function evaluateOperator(
  value: number,
  operator: ConditionOperator,
  threshold: number | [number, number],
  previousValue?: number
): boolean {
  switch (operator) {
    case 'gt':
      return value > (threshold as number);
    case 'gte':
      return value >= (threshold as number);
    case 'lt':
      return value < (threshold as number);
    case 'lte':
      return value <= (threshold as number);
    case 'eq':
      return value === (threshold as number);
    case 'neq':
      return value !== (threshold as number);
    case 'between': {
      const [min, max] = threshold as [number, number];
      return value >= min && value <= max;
    }
    case 'trend_up':
      return previousValue !== undefined && value > previousValue;
    case 'trend_down':
      return previousValue !== undefined && value < previousValue;
    default:
      return false;
  }
}

// Base evaluator interface
type ConditionEvaluator = (
  condition: RuleCondition,
  ctx: EvaluationContext
) => Promise<ConditionResult>;

// Evaluate precipitation accumulated (1h, 3h, 6h, etc.)
export const evaluatePrecipitationAccumulated: ConditionEvaluator = async (
  condition,
  ctx
) => {
  const cacheKey = `precip_acc:${ctx.municipalityId}:${condition.timeWindow || '1h'}`;

  let value: number;
  const cached = ctx.cache.get(cacheKey);

  if (cached !== undefined) {
    value = cached as number;
  } else {
    const windowMs = timeWindowToMs((condition.timeWindow || '1h') as TimeWindow);
    const since = new Date(ctx.timestamp.getTime() - windowMs);

    const result = await prisma.precipitationObservation.aggregate({
      where: {
        municipalityId: ctx.municipalityId,
        observationTime: { gte: since, lte: ctx.timestamp },
      },
      _sum: { precipitationMm: true },
    });

    value = Number(result._sum.precipitationMm) || 0;
    ctx.cache.set(cacheKey, value);
  }

  const matched = evaluateOperator(value, condition.operator, condition.value);

  return {
    conditionId: condition.id,
    matched,
    value,
    threshold: Array.isArray(condition.value) ? condition.value[0] : condition.value,
    message: matched
      ? `Precipitação acumulada (${condition.timeWindow || '1h'}): ${value.toFixed(1)} mm excede limiar`
      : `Precipitação acumulada (${condition.timeWindow || '1h'}): ${value.toFixed(1)} mm`,
  };
};

// Evaluate instantaneous precipitation rate
export const evaluatePrecipitationRate: ConditionEvaluator = async (
  condition,
  ctx
) => {
  const cacheKey = `precip_rate:${ctx.municipalityId}`;

  let value: number;
  const cached = ctx.cache.get(cacheKey);

  if (cached !== undefined) {
    value = cached as number;
  } else {
    // Get last two observations to calculate rate
    const observations = await prisma.precipitationObservation.findMany({
      where: {
        municipalityId: ctx.municipalityId,
        observationTime: { lte: ctx.timestamp },
      },
      orderBy: { observationTime: 'desc' },
      take: 2,
      select: { precipitationMm: true, observationTime: true },
    });

    if (observations.length < 2) {
      value = 0;
    } else {
      const timeDiffHours =
        (observations[0].observationTime.getTime() -
          observations[1].observationTime.getTime()) /
        (1000 * 60 * 60);

      if (timeDiffHours > 0) {
        value =
          (Number(observations[0].precipitationMm) || 0) / timeDiffHours;
      } else {
        value = 0;
      }
    }

    ctx.cache.set(cacheKey, value);
  }

  const matched = evaluateOperator(value, condition.operator, condition.value);

  return {
    conditionId: condition.id,
    matched,
    value,
    threshold: Array.isArray(condition.value) ? condition.value[0] : condition.value,
    message: matched
      ? `Taxa de precipitação: ${value.toFixed(1)} mm/h excede limiar`
      : `Taxa de precipitação: ${value.toFixed(1)} mm/h`,
  };
};

// Evaluate radar reflectivity
export const evaluateRadarReflectivity: ConditionEvaluator = async (
  condition,
  ctx
) => {
  const cacheKey = `radar_refl:${ctx.municipalityId}`;

  let value: number;
  const cached = ctx.cache.get(cacheKey);

  if (cached !== undefined) {
    value = cached as number;
  } else {
    const tenMinutesAgo = new Date(ctx.timestamp.getTime() - 10 * 60 * 1000);

    const observation = await prisma.precipitationObservation.findFirst({
      where: {
        municipalityId: ctx.municipalityId,
        observationTime: { gte: tenMinutesAgo, lte: ctx.timestamp },
        source: 'radar',
      },
      orderBy: { observationTime: 'desc' },
      select: { reflectivityDbz: true },
    });

    value = Number(observation?.reflectivityDbz) || 0;
    ctx.cache.set(cacheKey, value);
  }

  const matched = evaluateOperator(value, condition.operator, condition.value);

  return {
    conditionId: condition.id,
    matched,
    value,
    threshold: Array.isArray(condition.value) ? condition.value[0] : condition.value,
    message: matched
      ? `Refletividade radar: ${value.toFixed(0)} dBZ excede limiar`
      : `Refletividade radar: ${value.toFixed(0)} dBZ`,
  };
};

// Evaluate station precipitation data
export const evaluateStationPrecipitation: ConditionEvaluator = async (
  condition,
  ctx
) => {
  const cacheKey = `station_precip:${ctx.municipalityId}:${condition.timeWindow || '1h'}`;

  let value: number;
  const cached = ctx.cache.get(cacheKey);

  if (cached !== undefined) {
    value = cached as number;
  } else {
    const windowMs = timeWindowToMs((condition.timeWindow || '1h') as TimeWindow);
    const since = new Date(ctx.timestamp.getTime() - windowMs);

    // Get all stations in municipality
    const stations = await prisma.station.findMany({
      where: { municipalityId: ctx.municipalityId },
      select: { id: true },
    });

    if (stations.length === 0) {
      return {
        conditionId: condition.id,
        matched: false,
        value: 0,
        message: 'Nenhuma estação no município',
      };
    }

    // Get max precipitation from any station
    const result = await prisma.stationObservation.aggregate({
      where: {
        stationId: { in: stations.map((s) => s.id) },
        observationTime: { gte: since, lte: ctx.timestamp },
      },
      _sum: { precipitationMm: true },
    });

    value = Number(result._sum.precipitationMm) || 0;
    ctx.cache.set(cacheKey, value);
  }

  const matched = evaluateOperator(value, condition.operator, condition.value);

  return {
    conditionId: condition.id,
    matched,
    value,
    threshold: Array.isArray(condition.value) ? condition.value[0] : condition.value,
    message: matched
      ? `Precipitação estações (${condition.timeWindow || '1h'}): ${value.toFixed(1)} mm excede limiar`
      : `Precipitação estações (${condition.timeWindow || '1h'}): ${value.toFixed(1)} mm`,
  };
};

// Evaluate wind speed
export const evaluateStationWind: ConditionEvaluator = async (condition, ctx) => {
  const cacheKey = `station_wind:${ctx.municipalityId}`;

  let value: number;
  const cached = ctx.cache.get(cacheKey);

  if (cached !== undefined) {
    value = cached as number;
  } else {
    const thirtyMinutesAgo = new Date(ctx.timestamp.getTime() - 30 * 60 * 1000);

    const stations = await prisma.station.findMany({
      where: { municipalityId: ctx.municipalityId },
      select: { id: true },
    });

    if (stations.length === 0) {
      return {
        conditionId: condition.id,
        matched: false,
        value: 0,
        message: 'Nenhuma estação no município',
      };
    }

    // Get max wind speed
    const result = await prisma.stationObservation.aggregate({
      where: {
        stationId: { in: stations.map((s) => s.id) },
        observationTime: { gte: thirtyMinutesAgo, lte: ctx.timestamp },
      },
      _max: { windSpeedMs: true },
    });

    value = Number(result._max.windSpeedMs) || 0;
    ctx.cache.set(cacheKey, value);
  }

  const matched = evaluateOperator(value, condition.operator, condition.value);

  return {
    conditionId: condition.id,
    matched,
    value,
    threshold: Array.isArray(condition.value) ? condition.value[0] : condition.value,
    message: matched
      ? `Vento máximo: ${value.toFixed(1)} m/s excede limiar`
      : `Vento máximo: ${value.toFixed(1)} m/s`,
  };
};

// Evaluate convective cell presence
export const evaluateConvectiveCell: ConditionEvaluator = async (
  condition,
  ctx
) => {
  const cacheKey = `conv_cell:${ctx.municipalityId}`;

  let value: number;
  const cached = ctx.cache.get(cacheKey);

  if (cached !== undefined) {
    value = cached as number;
  } else {
    // Check for active convective cells affecting municipality
    // This requires spatial query - simplified version using max reflectivity
    const thirtyMinutesAgo = new Date(ctx.timestamp.getTime() - 30 * 60 * 1000);

    const cells = await prisma.convectiveCell.findMany({
      where: {
        detectionTime: { gte: thirtyMinutesAgo, lte: ctx.timestamp },
        isActive: true,
      },
      orderBy: { maxReflectivityDbz: 'desc' },
      take: 1,
    });

    // Get max reflectivity as proxy for cell intensity
    value = cells.length > 0 ? Number(cells[0].maxReflectivityDbz) || 0 : 0;
    ctx.cache.set(cacheKey, value);
  }

  const matched = evaluateOperator(value, condition.operator, condition.value);

  return {
    conditionId: condition.id,
    matched,
    value,
    threshold: Array.isArray(condition.value) ? condition.value[0] : condition.value,
    message: matched
      ? `Célula convectiva detectada: ${value.toFixed(0)} dBZ`
      : `Sem células convectivas significativas`,
  };
};

// Evaluate risk area overlap (checks if precipitation is occurring over risk areas)
export const evaluateRiskAreaOverlap: ConditionEvaluator = async (
  condition,
  ctx
) => {
  const cacheKey = `risk_overlap:${ctx.municipalityId}`;

  let value: number;
  const cached = ctx.cache.get(cacheKey);

  if (cached !== undefined) {
    value = cached as number;
  } else {
    // Get risk areas and current precipitation
    const [riskAreas, precip] = await Promise.all([
      prisma.riskArea.count({
        where: {
          municipalityId: ctx.municipalityId,
          severity: { in: ['high', 'very_high'] },
        },
      }),
      prisma.precipitationObservation.findFirst({
        where: {
          municipalityId: ctx.municipalityId,
          observationTime: {
            gte: new Date(ctx.timestamp.getTime() - 10 * 60 * 1000),
          },
        },
        orderBy: { observationTime: 'desc' },
      }),
    ]);

    // If there's significant precipitation and risk areas, flag it
    const currentPrecip = Number(precip?.precipitationMm) || 0;
    value = riskAreas > 0 && currentPrecip > 5 ? currentPrecip : 0;
    ctx.cache.set(cacheKey, value);
  }

  const matched = evaluateOperator(value, condition.operator, condition.value);

  return {
    conditionId: condition.id,
    matched,
    value,
    threshold: Array.isArray(condition.value) ? condition.value[0] : condition.value,
    message: matched
      ? `Precipitação sobre área de risco: ${value.toFixed(1)} mm`
      : `Sem precipitação significativa sobre áreas de risco`,
  };
};

// Map of evaluators by data source
export const evaluators: Record<string, ConditionEvaluator> = {
  precipitation_accumulated: evaluatePrecipitationAccumulated,
  precipitation_rate: evaluatePrecipitationRate,
  radar_reflectivity: evaluateRadarReflectivity,
  station_precipitation: evaluateStationPrecipitation,
  station_wind: evaluateStationWind,
  convective_cell: evaluateConvectiveCell,
  risk_area_overlap: evaluateRiskAreaOverlap,
};

// Get evaluator for a data source
export function getEvaluator(source: string): ConditionEvaluator | undefined {
  return evaluators[source];
}
