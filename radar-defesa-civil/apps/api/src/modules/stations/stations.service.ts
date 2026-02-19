import { prisma } from '../../config/database.js';
import { createLogger } from '../../utils/logger.js';
import type {
  QueryStationsInput,
  QueryObservationsInput,
  CreateObservationInput,
  CreateStationInput,
  UpdateStationInput,
  StationResponse,
  ObservationResponse,
  StationMapResponse,
} from './stations.schema.js';

const logger = createLogger('stations-service');

/**
 * Find many stations with filters
 */
export async function findMany(
  query: QueryStationsInput
): Promise<{ stations: StationResponse[]; total: number; page: number; totalPages: number }> {
  const { page, limit, source, municipalityId, status, search, stationType } = query;
  const skip = (page - 1) * limit;

  const where: {
    source?: string;
    municipalityId?: string;
    status?: string;
    stationType?: string;
    OR?: Array<{ name?: { contains: string; mode: 'insensitive' }; code?: { contains: string; mode: 'insensitive' } }>;
  } = {};

  if (source) where.source = source;
  if (municipalityId) where.municipalityId = municipalityId;
  if (status) where.status = status;
  if (stationType) where.stationType = stationType;

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { code: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [stations, total] = await Promise.all([
    prisma.station.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ name: 'asc' }],
      include: {
        municipality: {
          select: { id: true, name: true, ibgeCode: true },
        },
      },
    }),
    prisma.station.count({ where }),
  ]);

  return {
    stations: stations.map((s) => ({
      id: s.id,
      code: s.code,
      name: s.name,
      source: s.source,
      stationType: s.stationType,
      latitude: Number(s.latitude),
      longitude: Number(s.longitude),
      elevationM: s.elevationM ? Number(s.elevationM) : null,
      municipalityId: s.municipalityId,
      status: s.status,
      metadata: s.metadata as Record<string, unknown>,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
      municipality: s.municipality || undefined,
    })),
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * Find station by ID with latest observation
 */
export async function findById(id: string): Promise<StationResponse | null> {
  const station = await prisma.station.findUnique({
    where: { id },
    include: {
      municipality: {
        select: { id: true, name: true, ibgeCode: true },
      },
      observations: {
        orderBy: { observationTime: 'desc' },
        take: 1,
      },
    },
  });

  if (!station) {
    return null;
  }

  const latestObs = station.observations[0];

  return {
    id: station.id,
    code: station.code,
    name: station.name,
    source: station.source,
    stationType: station.stationType,
    latitude: Number(station.latitude),
    longitude: Number(station.longitude),
    elevationM: station.elevationM ? Number(station.elevationM) : null,
    municipalityId: station.municipalityId,
    status: station.status,
    metadata: station.metadata as Record<string, unknown>,
    createdAt: station.createdAt,
    updatedAt: station.updatedAt,
    municipality: station.municipality || undefined,
    latestObservation: latestObs
      ? {
          id: latestObs.id.toString(),
          stationId: latestObs.stationId,
          observationTime: latestObs.observationTime,
          precipitationMm: latestObs.precipitationMm ? Number(latestObs.precipitationMm) : null,
          temperatureC: latestObs.temperatureC ? Number(latestObs.temperatureC) : null,
          humidityPercent: latestObs.humidityPercent ? Number(latestObs.humidityPercent) : null,
          pressureHpa: latestObs.pressureHpa ? Number(latestObs.pressureHpa) : null,
          windSpeedMs: latestObs.windSpeedMs ? Number(latestObs.windSpeedMs) : null,
          windDirectionDeg: latestObs.windDirectionDeg,
          solarRadiationWm2: latestObs.solarRadiationWm2 ? Number(latestObs.solarRadiationWm2) : null,
          qualityFlag: latestObs.qualityFlag,
        }
      : null,
  };
}

/**
 * Get observation history for a station
 */
export async function getObservations(
  stationId: string,
  query: QueryObservationsInput
): Promise<{ observations: ObservationResponse[]; total: number; page: number; totalPages: number }> {
  const { page, limit, start, end } = query;
  const skip = (page - 1) * limit;

  const where: {
    stationId: string;
    observationTime?: { gte?: Date; lte?: Date };
  } = { stationId };

  if (start || end) {
    where.observationTime = {};
    if (start) where.observationTime.gte = start;
    if (end) where.observationTime.lte = end;
  }

  const [observations, total] = await Promise.all([
    prisma.stationObservation.findMany({
      where,
      skip,
      take: limit,
      orderBy: { observationTime: 'desc' },
    }),
    prisma.stationObservation.count({ where }),
  ]);

  return {
    observations: observations.map((o) => ({
      id: o.id.toString(),
      stationId: o.stationId,
      observationTime: o.observationTime,
      precipitationMm: o.precipitationMm ? Number(o.precipitationMm) : null,
      temperatureC: o.temperatureC ? Number(o.temperatureC) : null,
      humidityPercent: o.humidityPercent ? Number(o.humidityPercent) : null,
      pressureHpa: o.pressureHpa ? Number(o.pressureHpa) : null,
      windSpeedMs: o.windSpeedMs ? Number(o.windSpeedMs) : null,
      windDirectionDeg: o.windDirectionDeg,
      solarRadiationWm2: o.solarRadiationWm2 ? Number(o.solarRadiationWm2) : null,
      qualityFlag: o.qualityFlag,
    })),
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * Create a new observation (ingest from external source)
 */
export async function createObservation(
  stationId: string,
  input: CreateObservationInput
): Promise<ObservationResponse> {
  const observation = await prisma.stationObservation.create({
    data: {
      stationId,
      observationTime: input.observationTime,
      precipitationMm: input.precipitationMm,
      temperatureC: input.temperatureC,
      humidityPercent: input.humidityPercent,
      pressureHpa: input.pressureHpa,
      windSpeedMs: input.windSpeedMs,
      windDirectionDeg: input.windDirectionDeg,
      solarRadiationWm2: input.solarRadiationWm2,
      qualityFlag: input.qualityFlag,
    },
  });

  logger.info('Observation created', {
    stationId,
    observationTime: input.observationTime,
  });

  return {
    id: observation.id.toString(),
    stationId: observation.stationId,
    observationTime: observation.observationTime,
    precipitationMm: observation.precipitationMm ? Number(observation.precipitationMm) : null,
    temperatureC: observation.temperatureC ? Number(observation.temperatureC) : null,
    humidityPercent: observation.humidityPercent ? Number(observation.humidityPercent) : null,
    pressureHpa: observation.pressureHpa ? Number(observation.pressureHpa) : null,
    windSpeedMs: observation.windSpeedMs ? Number(observation.windSpeedMs) : null,
    windDirectionDeg: observation.windDirectionDeg,
    solarRadiationWm2: observation.solarRadiationWm2 ? Number(observation.solarRadiationWm2) : null,
    qualityFlag: observation.qualityFlag,
  };
}

/**
 * Create a new station (admin)
 */
export async function create(input: CreateStationInput): Promise<StationResponse> {
  const station = await prisma.station.create({
    data: {
      code: input.code,
      name: input.name,
      source: input.source,
      stationType: input.stationType,
      latitude: input.latitude,
      longitude: input.longitude,
      elevationM: input.elevationM,
      municipalityId: input.municipalityId,
      status: input.status,
      metadata: input.metadata as object | undefined,
    },
    include: {
      municipality: {
        select: { id: true, name: true, ibgeCode: true },
      },
    },
  });

  logger.info('Station created', { id: station.id, code: station.code });

  // Cast to access included municipality
  const stationWithMunicipality = station as typeof station & {
    municipality: { id: string; name: string; ibgeCode: string } | null;
  };

  return {
    id: station.id,
    code: station.code,
    name: station.name,
    source: station.source,
    stationType: station.stationType,
    latitude: Number(station.latitude),
    longitude: Number(station.longitude),
    elevationM: station.elevationM ? Number(station.elevationM) : null,
    municipalityId: station.municipalityId,
    status: station.status,
    metadata: station.metadata as Record<string, unknown>,
    createdAt: station.createdAt,
    updatedAt: station.updatedAt,
    municipality: stationWithMunicipality.municipality || undefined,
  };
}

/**
 * Update a station (admin)
 */
export async function update(
  id: string,
  input: UpdateStationInput
): Promise<StationResponse> {
  const station = await prisma.station.update({
    where: { id },
    data: {
      name: input.name,
      source: input.source,
      stationType: input.stationType,
      latitude: input.latitude,
      longitude: input.longitude,
      elevationM: input.elevationM,
      municipalityId: input.municipalityId,
      status: input.status,
      metadata: input.metadata as object | undefined,
    },
    include: {
      municipality: {
        select: { id: true, name: true, ibgeCode: true },
      },
    },
  });

  logger.info('Station updated', { id: station.id });

  // Cast to access included municipality
  const stationWithMunicipality = station as typeof station & {
    municipality: { id: string; name: string; ibgeCode: string } | null;
  };

  return {
    id: station.id,
    code: station.code,
    name: station.name,
    source: station.source,
    stationType: station.stationType,
    latitude: Number(station.latitude),
    longitude: Number(station.longitude),
    elevationM: station.elevationM ? Number(station.elevationM) : null,
    municipalityId: station.municipalityId,
    status: station.status,
    metadata: station.metadata as Record<string, unknown>,
    createdAt: station.createdAt,
    updatedAt: station.updatedAt,
    municipality: stationWithMunicipality.municipality || undefined,
  };
}

/**
 * Get stations for map display (lightweight)
 */
export async function getStationsForMap(
  municipalityId?: string
): Promise<StationMapResponse[]> {
  const where: { municipalityId?: string; status: string } = {
    status: 'active',
  };

  if (municipalityId) {
    where.municipalityId = municipalityId;
  }

  // Get stations with their latest observation
  const stations = await prisma.station.findMany({
    where,
    select: {
      id: true,
      code: true,
      name: true,
      source: true,
      latitude: true,
      longitude: true,
      status: true,
      observations: {
        orderBy: { observationTime: 'desc' },
        take: 1,
        select: {
          observationTime: true,
          precipitationMm: true,
          temperatureC: true,
        },
      },
    },
  });

  // Define "recent" as within the last hour
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  return stations.map((s) => {
    const latestObs = s.observations[0];
    const hasRecentData = latestObs
      ? new Date(latestObs.observationTime) > oneHourAgo
      : false;

    return {
      id: s.id,
      code: s.code,
      name: s.name,
      source: s.source,
      latitude: Number(s.latitude),
      longitude: Number(s.longitude),
      status: s.status,
      hasRecentData,
      latestPrecipitation: latestObs?.precipitationMm
        ? Number(latestObs.precipitationMm)
        : null,
      latestTemperature: latestObs?.temperatureC
        ? Number(latestObs.temperatureC)
        : null,
    };
  });
}

/**
 * Get station sources for filtering
 */
export async function getSources(): Promise<string[]> {
  const sources = await prisma.station.findMany({
    select: { source: true },
    distinct: ['source'],
    orderBy: { source: 'asc' },
  });

  return sources.map((s: { source: string }) => s.source);
}
