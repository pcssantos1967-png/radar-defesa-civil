import { prisma } from '../../config/database.js';
import type { ConvectiveCell, NowcastForecast } from '@prisma/client';
import type {
  QueryActiveCellsInput,
  QueryCellTrackInput,
  QueryForecastsInput,
  ConvectiveCellResponse,
  NowcastForecastResponse,
  NowcastSummaryResponse,
} from './nowcast.schema.js';

// Helper function to map cell to response
function mapCellToResponse(cell: ConvectiveCell): ConvectiveCellResponse {
  return {
    id: cell.id,
    trackId: cell.trackId,
    detectionTime: cell.detectionTime,
    centroidLat: Number(cell.centroidLat),
    centroidLng: Number(cell.centroidLng),
    maxReflectivityDbz: cell.maxReflectivityDbz ? Number(cell.maxReflectivityDbz) : null,
    vil: cell.vil ? Number(cell.vil) : null,
    echoTopKm: cell.echoTopKm ? Number(cell.echoTopKm) : null,
    areaKm2: cell.areaKm2 ? Number(cell.areaKm2) : null,
    velocityMs: cell.velocityMs ? Number(cell.velocityMs) : null,
    directionDeg: cell.directionDeg,
    severity: cell.severity,
    isActive: cell.isActive,
    metadata: cell.metadata as Record<string, unknown>,
  };
}

// Helper function to map forecast to response
function mapForecastToResponse(f: NowcastForecast): NowcastForecastResponse {
  return {
    id: f.id,
    issueTime: f.issueTime,
    validTime: f.validTime,
    leadTimeMinutes: f.leadTimeMinutes,
    forecastType: f.forecastType,
    dataPath: f.dataPath,
    tilePath: f.tilePath,
    metadata: f.metadata as Record<string, unknown>,
  };
}

/**
 * Get active convective cells
 */
export async function getActiveCells(
  query: QueryActiveCellsInput
): Promise<{ cells: ConvectiveCellResponse[]; total: number }> {
  const { severity, minReflectivity, limit, isActive } = query;

  const where: {
    isActive?: boolean;
    severity?: string;
    maxReflectivityDbz?: { gte: number };
  } = {};

  if (typeof isActive === 'boolean') {
    where.isActive = isActive;
  }

  if (severity) {
    where.severity = severity;
  }

  if (minReflectivity !== undefined) {
    where.maxReflectivityDbz = { gte: minReflectivity };
  }

  const [cells, total] = await Promise.all([
    prisma.convectiveCell.findMany({
      where,
      orderBy: [
        { isActive: 'desc' },
        { detectionTime: 'desc' },
      ],
      take: limit,
    }),
    prisma.convectiveCell.count({ where }),
  ]);

  return {
    cells: cells.map(mapCellToResponse),
    total,
  };
}

/**
 * Get cell track history by track ID
 */
export async function getCellTrack(
  trackId: string,
  query: QueryCellTrackInput
): Promise<{ track: ConvectiveCellResponse[]; trackId: string }> {
  const { limit } = query;

  const cells = await prisma.convectiveCell.findMany({
    where: { trackId },
    orderBy: { detectionTime: 'desc' },
    take: limit,
  });

  return {
    trackId,
    track: cells.map(mapCellToResponse),
  };
}

/**
 * Get nowcast forecasts
 */
export async function getForecasts(
  query: QueryForecastsInput
): Promise<{ forecasts: NowcastForecastResponse[]; total: number; page: number; totalPages: number }> {
  const { leadTimeMinutes, forecastType, limit, page } = query;
  const skip = (page - 1) * limit;

  const where: {
    leadTimeMinutes?: number;
    forecastType?: string;
  } = {};

  if (leadTimeMinutes !== undefined) {
    where.leadTimeMinutes = leadTimeMinutes;
  }

  if (forecastType) {
    where.forecastType = forecastType;
  }

  const [forecasts, total] = await Promise.all([
    prisma.nowcastForecast.findMany({
      where,
      orderBy: { issueTime: 'desc' },
      skip,
      take: limit,
    }),
    prisma.nowcastForecast.count({ where }),
  ]);

  return {
    forecasts: forecasts.map(mapForecastToResponse),
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * Get a specific forecast by ID
 */
export async function getForecastById(
  id: string
): Promise<NowcastForecastResponse | null> {
  const forecast = await prisma.nowcastForecast.findUnique({
    where: { id },
  });

  if (!forecast) {
    return null;
  }

  return mapForecastToResponse(forecast);
}

/**
 * Get nowcast summary for dashboard widget
 */
export async function getNowcastSummary(): Promise<NowcastSummaryResponse> {
  // Get active cells count
  const activeCellsCount = await prisma.convectiveCell.count({
    where: { isActive: true },
  });

  // Get severe cells count
  const severeCellsCount = await prisma.convectiveCell.count({
    where: {
      isActive: true,
      severity: { in: ['strong', 'severe'] },
    },
  });

  // Get cells approaching (cells with positive velocity towards populated areas)
  // This is a simplified version - in production would use spatial queries
  const cellsApproaching = await prisma.convectiveCell.count({
    where: {
      isActive: true,
      velocityMs: { gt: 0 },
    },
  });

  // Get latest forecast
  const latestForecast = await prisma.nowcastForecast.findFirst({
    orderBy: { issueTime: 'desc' },
    select: {
      issueTime: true,
      leadTimeMinutes: true,
      metadata: true,
    },
  });

  // Get distinct lead times from recent forecasts
  const recentForecasts = await prisma.nowcastForecast.findMany({
    where: {
      issueTime: latestForecast?.issueTime || undefined,
    },
    select: { leadTimeMinutes: true },
    distinct: ['leadTimeMinutes'],
    orderBy: { leadTimeMinutes: 'asc' },
  });

  // Check if rain is expected based on active cells or forecast metadata
  const hasRainExpected = activeCellsCount > 0 || severeCellsCount > 0;

  return {
    activeCells: activeCellsCount,
    severeCells: severeCellsCount,
    cellsApproaching,
    hasRainExpected,
    latestForecastTime: latestForecast?.issueTime || null,
    forecastLeadTimes: recentForecasts.map((f: { leadTimeMinutes: number }) => f.leadTimeMinutes),
  };
}

/**
 * Get unique track IDs for active cells
 */
export async function getActiveTrackIds(): Promise<string[]> {
  const cells = await prisma.convectiveCell.findMany({
    where: { isActive: true },
    select: { trackId: true },
    distinct: ['trackId'],
  });

  return cells.map((c: { trackId: string }) => c.trackId);
}
