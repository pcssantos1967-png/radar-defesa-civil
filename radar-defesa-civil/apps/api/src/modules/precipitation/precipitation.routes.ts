import { FastifyInstance } from 'fastify';
import { prisma } from '../../config/database.js';
import { cache } from '../../config/redis.js';
import { authenticate } from '../../middleware/auth.js';
import { NotFoundError } from '../../utils/errors.js';
import { z } from 'zod';

const queryHistorySchema = z.object({
  start: z.coerce.date().optional(),
  end: z.coerce.date().optional(),
  source: z.string().optional(),
  interval: z.enum(['10m', '1h', '3h', '6h', '12h', '24h']).default('1h'),
});

export async function precipitationRoutes(app: FastifyInstance): Promise<void> {
  // Get current precipitation for municipality
  app.get<{ Params: { municipalityId: string } }>(
    '/current/:municipalityId',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Get current precipitation for municipality',
        tags: ['precipitation'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['municipalityId'],
          properties: {
            municipalityId: { type: 'string', format: 'uuid' },
          },
        },
      },
    },
    async (request, reply) => {
      const { municipalityId } = request.params;

      const cacheKey = `precip:current:${municipalityId}`;
      const cached = await cache.get(cacheKey);

      if (cached) {
        return { success: true, data: cached };
      }

      const municipality = await prisma.municipality.findUnique({
        where: { id: municipalityId },
        select: { id: true, name: true, ibgeCode: true },
      });

      if (!municipality) {
        throw new NotFoundError('Municipality', municipalityId);
      }

      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

      const latestObs = await prisma.precipitationObservation.findFirst({
        where: {
          municipalityId,
          observationTime: { gte: tenMinutesAgo },
        },
        orderBy: { observationTime: 'desc' },
      });

      const data = {
        municipality,
        current: latestObs
          ? {
              precipitationMm: Number(latestObs.precipitationMm) || 0,
              reflectivityDbz: Number(latestObs.reflectivityDbz) || 0,
              source: latestObs.source,
              observationTime: latestObs.observationTime,
              confidence: Number(latestObs.confidence) || 0,
            }
          : null,
        timestamp: new Date().toISOString(),
      };

      await cache.set(cacheKey, data, 60);

      return { success: true, data };
    }
  );

  // Get accumulated precipitation for municipality
  app.get<{ Params: { municipalityId: string } }>(
    '/accumulated/:municipalityId',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Get accumulated precipitation for municipality',
        tags: ['precipitation'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['municipalityId'],
          properties: {
            municipalityId: { type: 'string', format: 'uuid' },
          },
        },
      },
    },
    async (request, reply) => {
      const { municipalityId } = request.params;

      const cacheKey = `precip:accumulated:${municipalityId}`;
      const cached = await cache.get(cacheKey);

      if (cached) {
        return { success: true, data: cached };
      }

      const municipality = await prisma.municipality.findUnique({
        where: { id: municipalityId },
        select: { id: true, name: true, alertThresholds: true },
      });

      if (!municipality) {
        throw new NotFoundError('Municipality', municipalityId);
      }

      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000);
      const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000);
      const twelveHoursAgo = new Date(now.getTime() - 12 * 60 * 60 * 1000);
      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const [acc1h, acc3h, acc6h, acc12h, acc24h] = await Promise.all([
        prisma.precipitationObservation.aggregate({
          where: { municipalityId, observationTime: { gte: oneHourAgo } },
          _sum: { precipitationMm: true },
        }),
        prisma.precipitationObservation.aggregate({
          where: { municipalityId, observationTime: { gte: threeHoursAgo } },
          _sum: { precipitationMm: true },
        }),
        prisma.precipitationObservation.aggregate({
          where: { municipalityId, observationTime: { gte: sixHoursAgo } },
          _sum: { precipitationMm: true },
        }),
        prisma.precipitationObservation.aggregate({
          where: { municipalityId, observationTime: { gte: twelveHoursAgo } },
          _sum: { precipitationMm: true },
        }),
        prisma.precipitationObservation.aggregate({
          where: { municipalityId, observationTime: { gte: twentyFourHoursAgo } },
          _sum: { precipitationMm: true },
        }),
      ]);

      const thresholds = municipality.alertThresholds as {
        precipitation_1h?: { attention: number; alert: number; max_alert: number };
        precipitation_24h?: { attention: number; alert: number; max_alert: number };
      };

      const data = {
        municipalityId,
        accumulated: {
          '1h': Number(acc1h._sum.precipitationMm) || 0,
          '3h': Number(acc3h._sum.precipitationMm) || 0,
          '6h': Number(acc6h._sum.precipitationMm) || 0,
          '12h': Number(acc12h._sum.precipitationMm) || 0,
          '24h': Number(acc24h._sum.precipitationMm) || 0,
        },
        thresholds: {
          '1h': thresholds?.precipitation_1h || { attention: 20, alert: 40, max_alert: 60 },
          '24h': thresholds?.precipitation_24h || { attention: 50, alert: 80, max_alert: 120 },
        },
        timestamp: now.toISOString(),
      };

      await cache.set(cacheKey, data, 120);

      return { success: true, data };
    }
  );

  // Get precipitation history for municipality
  app.get<{ Params: { municipalityId: string } }>(
    '/history/:municipalityId',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Get precipitation history for municipality',
        tags: ['precipitation'],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            start: { type: 'string', format: 'date-time' },
            end: { type: 'string', format: 'date-time' },
            source: { type: 'string' },
            interval: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { municipalityId } = request.params;
      const query = queryHistorySchema.parse(request.query);

      const municipality = await prisma.municipality.findUnique({
        where: { id: municipalityId },
      });

      if (!municipality) {
        throw new NotFoundError('Municipality', municipalityId);
      }

      const now = new Date();
      const start = query.start || new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const end = query.end || now;

      const observations = await prisma.precipitationObservation.findMany({
        where: {
          municipalityId,
          observationTime: {
            gte: start,
            lte: end,
          },
          ...(query.source && { source: query.source }),
        },
        orderBy: { observationTime: 'asc' },
        select: {
          observationTime: true,
          precipitationMm: true,
          reflectivityDbz: true,
          source: true,
          confidence: true,
        },
      });

      // Aggregate by interval
      const intervalMinutes = {
        '10m': 10,
        '1h': 60,
        '3h': 180,
        '6h': 360,
        '12h': 720,
        '24h': 1440,
      }[query.interval];

      const aggregated = aggregateByInterval(observations, intervalMinutes);

      return {
        success: true,
        data: {
          municipalityId,
          start: start.toISOString(),
          end: end.toISOString(),
          interval: query.interval,
          observations: aggregated,
        },
      };
    }
  );

  // Get heatmap data
  app.get(
    '/heatmap',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Get precipitation heatmap data',
        tags: ['precipitation'],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            period: { type: 'string', enum: ['1h', '3h', '6h', '24h'] },
          },
        },
      },
    },
    async (request, reply) => {
      const { period = '1h' } = request.query as { period?: string };

      const periodMinutes = {
        '1h': 60,
        '3h': 180,
        '6h': 360,
        '24h': 1440,
      }[period] || 60;

      const since = new Date(Date.now() - periodMinutes * 60 * 1000);

      const municipalities = await prisma.municipality.findMany({
        select: {
          id: true,
          name: true,
          ibgeCode: true,
          precipitationObservations: {
            where: { observationTime: { gte: since } },
            select: { precipitationMm: true },
          },
        },
      });

      const heatmapData = municipalities.map((m) => {
        const totalPrecip = m.precipitationObservations.reduce(
          (sum, obs) => sum + (Number(obs.precipitationMm) || 0),
          0
        );

        return {
          id: m.id,
          name: m.name,
          ibgeCode: m.ibgeCode,
          precipitation: totalPrecip,
        };
      });

      return {
        success: true,
        data: {
          period,
          municipalities: heatmapData,
          timestamp: new Date().toISOString(),
        },
      };
    }
  );
}

function aggregateByInterval(
  observations: Array<{
    observationTime: Date;
    precipitationMm: unknown;
    reflectivityDbz: unknown;
    source: string;
    confidence: unknown;
  }>,
  intervalMinutes: number
): Array<{
  time: string;
  precipitation: number;
  avgReflectivity: number;
  count: number;
}> {
  const buckets = new Map<string, { precip: number; refl: number[]; count: number }>();

  for (const obs of observations) {
    const time = new Date(obs.observationTime);
    const bucketTime = new Date(
      Math.floor(time.getTime() / (intervalMinutes * 60 * 1000)) * intervalMinutes * 60 * 1000
    );
    const key = bucketTime.toISOString();

    if (!buckets.has(key)) {
      buckets.set(key, { precip: 0, refl: [], count: 0 });
    }

    const bucket = buckets.get(key)!;
    bucket.precip += Number(obs.precipitationMm) || 0;
    if (obs.reflectivityDbz) {
      bucket.refl.push(Number(obs.reflectivityDbz));
    }
    bucket.count++;
  }

  return Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([time, data]) => ({
      time,
      precipitation: data.precip,
      avgReflectivity: data.refl.length > 0
        ? data.refl.reduce((a, b) => a + b, 0) / data.refl.length
        : 0,
      count: data.count,
    }));
}
