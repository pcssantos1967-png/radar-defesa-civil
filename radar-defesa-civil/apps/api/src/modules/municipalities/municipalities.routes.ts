import { FastifyInstance } from 'fastify';
import { prisma } from '../../config/database.js';
import { cache } from '../../config/redis.js';
import { authenticate, Roles } from '../../middleware/auth.js';
import { NotFoundError } from '../../utils/errors.js';

export async function municipalitiesRoutes(app: FastifyInstance): Promise<void> {
  // List municipalities
  app.get(
    '/',
    {
      preHandler: [authenticate],
      schema: {
        description: 'List municipalities',
        tags: ['municipalities'],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            consortiumId: { type: 'string', format: 'uuid' },
            stateCode: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { consortiumId, stateCode } = request.query as {
        consortiumId?: string;
        stateCode?: string;
      };

      const where: {
        consortiumId?: string;
        stateCode?: string;
      } = {};

      // Filter by user's consortium if not admin
      if (request.user!.role !== Roles.ADMIN) {
        if (request.user!.consortiumId) {
          where.consortiumId = request.user!.consortiumId;
        }
      } else if (consortiumId) {
        where.consortiumId = consortiumId;
      }

      if (stateCode) {
        where.stateCode = stateCode;
      }

      const municipalities = await prisma.municipality.findMany({
        where,
        orderBy: { name: 'asc' },
        select: {
          id: true,
          ibgeCode: true,
          name: true,
          stateCode: true,
          population: true,
          areaKm2: true,
          alertThresholds: true,
          consortium: {
            select: { id: true, name: true, code: true },
          },
        },
      });

      return { success: true, data: { municipalities } };
    }
  );

  // Get municipality details
  app.get<{ Params: { id: string } }>(
    '/:id',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Get municipality details',
        tags: ['municipalities'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
      },
    },
    async (request, reply) => {
      const municipality = await prisma.municipality.findUnique({
        where: { id: request.params.id },
        include: {
          consortium: true,
          riskAreas: {
            select: {
              id: true,
              name: true,
              riskType: true,
              severity: true,
              populationAtRisk: true,
            },
          },
          stations: {
            where: { status: 'active' },
            select: {
              id: true,
              code: true,
              name: true,
              source: true,
              latitude: true,
              longitude: true,
            },
          },
        },
      });

      if (!municipality) {
        throw new NotFoundError('Municipality', request.params.id);
      }

      return { success: true, data: { municipality } };
    }
  );

  // Get municipality status (current alerts and precipitation)
  app.get<{ Params: { id: string } }>(
    '/:id/status',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Get municipality current status',
        tags: ['municipalities'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;

      const cacheKey = `municipality:${id}:status`;
      const cached = await cache.get(cacheKey);

      if (cached) {
        return { success: true, data: cached };
      }

      const municipality = await prisma.municipality.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          ibgeCode: true,
          alertThresholds: true,
        },
      });

      if (!municipality) {
        throw new NotFoundError('Municipality', id);
      }

      // Get active alerts
      const activeAlerts = await prisma.alert.findMany({
        where: { municipalityId: id, status: 'active' },
        orderBy: { severity: 'desc' },
        select: {
          id: true,
          severity: true,
          type: true,
          title: true,
          startedAt: true,
        },
      });

      // Get recent precipitation (last 24h)
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

      const [precip1h, precip24h] = await Promise.all([
        prisma.precipitationObservation.aggregate({
          where: {
            municipalityId: id,
            observationTime: { gte: oneHourAgo },
          },
          _sum: { precipitationMm: true },
        }),
        prisma.precipitationObservation.aggregate({
          where: {
            municipalityId: id,
            observationTime: { gte: oneDayAgo },
          },
          _sum: { precipitationMm: true },
        }),
      ]);

      // Determine risk level
      const thresholds = municipality.alertThresholds as {
        precipitation_1h?: { attention: number; alert: number; max_alert: number };
        precipitation_24h?: { attention: number; alert: number; max_alert: number };
      };

      const precip1hValue = Number(precip1h._sum.precipitationMm) || 0;
      const precip24hValue = Number(precip24h._sum.precipitationMm) || 0;

      let riskLevel = 'normal';
      if (activeAlerts.some((a) => a.severity === 'max_alert')) {
        riskLevel = 'max_alert';
      } else if (activeAlerts.some((a) => a.severity === 'alert')) {
        riskLevel = 'alert';
      } else if (activeAlerts.some((a) => a.severity === 'attention')) {
        riskLevel = 'attention';
      } else if (activeAlerts.some((a) => a.severity === 'observation')) {
        riskLevel = 'observation';
      }

      const status = {
        municipality: {
          id: municipality.id,
          name: municipality.name,
          ibgeCode: municipality.ibgeCode,
        },
        riskLevel,
        alerts: {
          active: activeAlerts,
          count: activeAlerts.length,
        },
        precipitation: {
          last1h: precip1hValue,
          last24h: precip24hValue,
        },
        timestamp: new Date().toISOString(),
      };

      await cache.set(cacheKey, status, 60);

      return { success: true, data: status };
    }
  );

  // Get risk areas for municipality
  app.get<{ Params: { id: string } }>(
    '/:id/risk-areas',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Get risk areas for municipality',
        tags: ['municipalities'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const riskAreas = await prisma.riskArea.findMany({
        where: { municipalityId: request.params.id },
        orderBy: [{ severity: 'desc' }, { name: 'asc' }],
      });

      return { success: true, data: { riskAreas } };
    }
  );
}
