import { z } from 'zod';

/**
 * Schema for querying stations
 */
export const queryStationsSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  source: z.string().optional(),
  municipalityId: z.string().uuid().optional(),
  status: z.enum(['active', 'inactive', 'maintenance']).optional(),
  search: z.string().optional(),
  stationType: z.string().optional(),
});

export type QueryStationsInput = z.infer<typeof queryStationsSchema>;

/**
 * Schema for querying observations
 */
export const queryObservationsSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(1000).default(100),
  start: z.coerce.date().optional(),
  end: z.coerce.date().optional(),
});

export type QueryObservationsInput = z.infer<typeof queryObservationsSchema>;

/**
 * Schema for creating an observation
 */
export const createObservationSchema = z.object({
  observationTime: z.coerce.date(),
  precipitationMm: z.number().min(0).max(1000).optional(),
  temperatureC: z.number().min(-50).max(60).optional(),
  humidityPercent: z.number().min(0).max(100).optional(),
  pressureHpa: z.number().min(800).max(1100).optional(),
  windSpeedMs: z.number().min(0).max(100).optional(),
  windDirectionDeg: z.number().int().min(0).max(360).optional(),
  solarRadiationWm2: z.number().min(0).optional(),
  qualityFlag: z.number().int().min(0).max(255).default(0),
});

export type CreateObservationInput = z.infer<typeof createObservationSchema>;

/**
 * Schema for creating a station
 */
export const createStationSchema = z.object({
  code: z.string().min(1).max(50),
  name: z.string().min(1).max(255),
  source: z.string().min(1).max(50),
  stationType: z.string().max(50).optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  elevationM: z.number().optional(),
  municipalityId: z.string().uuid().optional(),
  status: z.enum(['active', 'inactive', 'maintenance']).default('active'),
  metadata: z.record(z.unknown()).default({}),
});

export type CreateStationInput = z.infer<typeof createStationSchema>;

/**
 * Schema for updating a station
 */
export const updateStationSchema = createStationSchema.partial().omit({ code: true });

export type UpdateStationInput = z.infer<typeof updateStationSchema>;

/**
 * Response types
 */
export interface StationResponse {
  id: string;
  code: string;
  name: string;
  source: string;
  stationType: string | null;
  latitude: number;
  longitude: number;
  elevationM: number | null;
  municipalityId: string | null;
  status: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  municipality?: {
    id: string;
    name: string;
    ibgeCode: string;
  };
  latestObservation?: ObservationResponse | null;
}

export interface ObservationResponse {
  id: bigint | string;
  stationId: string;
  observationTime: Date;
  precipitationMm: number | null;
  temperatureC: number | null;
  humidityPercent: number | null;
  pressureHpa: number | null;
  windSpeedMs: number | null;
  windDirectionDeg: number | null;
  solarRadiationWm2: number | null;
  qualityFlag: number;
}

export interface StationMapResponse {
  id: string;
  code: string;
  name: string;
  source: string;
  latitude: number;
  longitude: number;
  status: string;
  hasRecentData: boolean;
  latestPrecipitation: number | null;
  latestTemperature: number | null;
}
