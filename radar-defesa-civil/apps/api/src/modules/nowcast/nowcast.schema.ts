import { z } from 'zod';

/**
 * Schema for querying active convective cells
 */
export const queryActiveCellsSchema = z.object({
  severity: z.enum(['weak', 'moderate', 'strong', 'severe']).optional(),
  minReflectivity: z.coerce.number().min(0).max(80).optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  isActive: z.coerce.boolean().default(true),
});

export type QueryActiveCellsInput = z.infer<typeof queryActiveCellsSchema>;

/**
 * Schema for querying cell track history
 */
export const queryCellTrackSchema = z.object({
  limit: z.coerce.number().min(1).max(500).default(100),
  includeInactive: z.coerce.boolean().default(false),
});

export type QueryCellTrackInput = z.infer<typeof queryCellTrackSchema>;

/**
 * Schema for querying nowcast forecasts
 */
export const queryForecastsSchema = z.object({
  radarId: z.string().uuid().optional(),
  leadTimeMinutes: z.coerce.number().min(0).max(180).optional(),
  forecastType: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  page: z.coerce.number().min(1).default(1),
});

export type QueryForecastsInput = z.infer<typeof queryForecastsSchema>;

/**
 * Response types
 */
export interface ConvectiveCellResponse {
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
  severity: string | null;
  isActive: boolean;
  metadata: Record<string, unknown>;
}

export interface NowcastForecastResponse {
  id: string;
  issueTime: Date;
  validTime: Date;
  leadTimeMinutes: number;
  forecastType: string;
  dataPath: string | null;
  tilePath: string | null;
  metadata: Record<string, unknown>;
}

export interface NowcastSummaryResponse {
  activeCells: number;
  severeCells: number;
  cellsApproaching: number;
  hasRainExpected: boolean;
  latestForecastTime: Date | null;
  forecastLeadTimes: number[];
}
