import { FastifyInstance } from 'fastify';
import { authenticate, authorize, Roles } from '../../middleware/auth.js';
import { NotFoundError } from '../../utils/errors.js';
import { prisma } from '../../config/database.js';
import {
  queryStationsSchema,
  queryObservationsSchema,
  createObservationSchema,
  createStationSchema,
  updateStationSchema,
} from './stations.schema.js';
import * as stationsService from './stations.service.js';

export async function stationsRoutes(app: FastifyInstance): Promise<void> {
  /**
   * GET / - List stations
   */
  app.get(
    '/',
    {
      preHandler: [authenticate],
      schema: {
        description: 'List weather stations',
        tags: ['stations'],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'integer', minimum: 1, default: 1 },
            limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
            source: { type: 'string' },
            municipalityId: { type: 'string', format: 'uuid' },
            status: { type: 'string', enum: ['active', 'inactive', 'maintenance'] },
            search: { type: 'string' },
            stationType: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const query = queryStationsSchema.parse(request.query);
      const result = await stationsService.findMany(query);

      return {
        success: true,
        data: { stations: result.stations },
        pagination: {
          page: result.page,
          limit: query.limit,
          total: result.total,
          totalPages: result.totalPages,
        },
      };
    }
  );

  /**
   * GET /map - Stations for map (lightweight)
   */
  app.get(
    '/map',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Get stations for map display (lightweight response)',
        tags: ['stations'],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            municipalityId: { type: 'string', format: 'uuid' },
          },
        },
      },
    },
    async (request, reply) => {
      const { municipalityId } = request.query as { municipalityId?: string };
      const stations = await stationsService.getStationsForMap(municipalityId);

      return {
        success: true,
        data: { stations, count: stations.length },
      };
    }
  );

  /**
   * GET /sources - Get available station sources
   */
  app.get(
    '/sources',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Get list of station data sources',
        tags: ['stations'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const sources = await stationsService.getSources();

      return {
        success: true,
        data: { sources },
      };
    }
  );

  /**
   * GET /:id - Station details
   */
  app.get<{ Params: { id: string } }>(
    '/:id',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Get station details with latest observation',
        tags: ['stations'],
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
      const station = await stationsService.findById(id);

      if (!station) {
        throw new NotFoundError('Station', id);
      }

      return {
        success: true,
        data: { station },
      };
    }
  );

  /**
   * GET /:id/observations - Observation history
   */
  app.get<{ Params: { id: string } }>(
    '/:id/observations',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Get station observation history',
        tags: ['stations'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'integer', minimum: 1, default: 1 },
            limit: { type: 'integer', minimum: 1, maximum: 1000, default: 100 },
            start: { type: 'string', format: 'date-time' },
            end: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;

      // Verify station exists
      const station = await prisma.station.findUnique({
        where: { id },
        select: { id: true, code: true, name: true },
      });

      if (!station) {
        throw new NotFoundError('Station', id);
      }

      const query = queryObservationsSchema.parse(request.query);
      const result = await stationsService.getObservations(id, query);

      return {
        success: true,
        data: {
          station: { id: station.id, code: station.code, name: station.name },
          observations: result.observations,
        },
        pagination: {
          page: result.page,
          limit: query.limit,
          total: result.total,
          totalPages: result.totalPages,
        },
      };
    }
  );

  /**
   * POST /:id/observations - Ingest observation (API_USER, ADMIN)
   */
  app.post<{ Params: { id: string } }>(
    '/:id/observations',
    {
      preHandler: [authorize(Roles.ADMIN, Roles.API_USER)],
      schema: {
        description: 'Ingest observation from external source',
        tags: ['stations'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
        body: {
          type: 'object',
          required: ['observationTime'],
          properties: {
            observationTime: { type: 'string', format: 'date-time' },
            precipitationMm: { type: 'number', minimum: 0, maximum: 1000 },
            temperatureC: { type: 'number', minimum: -50, maximum: 60 },
            humidityPercent: { type: 'number', minimum: 0, maximum: 100 },
            pressureHpa: { type: 'number', minimum: 800, maximum: 1100 },
            windSpeedMs: { type: 'number', minimum: 0, maximum: 100 },
            windDirectionDeg: { type: 'integer', minimum: 0, maximum: 360 },
            solarRadiationWm2: { type: 'number', minimum: 0 },
            qualityFlag: { type: 'integer', minimum: 0, maximum: 255, default: 0 },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;

      // Verify station exists
      const station = await prisma.station.findUnique({
        where: { id },
        select: { id: true },
      });

      if (!station) {
        throw new NotFoundError('Station', id);
      }

      const input = createObservationSchema.parse(request.body);
      const observation = await stationsService.createObservation(id, input);

      return reply.status(201).send({
        success: true,
        data: { observation },
      });
    }
  );

  /**
   * POST / - Create station (ADMIN)
   */
  app.post(
    '/',
    {
      preHandler: [authorize(Roles.ADMIN)],
      schema: {
        description: 'Create a new weather station',
        tags: ['stations'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['code', 'name', 'source', 'latitude', 'longitude'],
          properties: {
            code: { type: 'string', minLength: 1, maxLength: 50 },
            name: { type: 'string', minLength: 1, maxLength: 255 },
            source: { type: 'string', minLength: 1, maxLength: 50 },
            stationType: { type: 'string', maxLength: 50 },
            latitude: { type: 'number', minimum: -90, maximum: 90 },
            longitude: { type: 'number', minimum: -180, maximum: 180 },
            elevationM: { type: 'number' },
            municipalityId: { type: 'string', format: 'uuid' },
            status: { type: 'string', enum: ['active', 'inactive', 'maintenance'], default: 'active' },
            metadata: { type: 'object', additionalProperties: true, default: {} },
          },
        },
      },
    },
    async (request, reply) => {
      const input = createStationSchema.parse(request.body);
      const station = await stationsService.create(input);

      // Audit log
      await prisma.auditLog.create({
        data: {
          userId: request.user!.userId,
          action: 'CREATE_STATION',
          entityType: 'station',
          entityId: station.id,
          newValues: input,
        },
      });

      return reply.status(201).send({
        success: true,
        data: { station },
      });
    }
  );

  /**
   * PUT /:id - Update station (ADMIN)
   */
  app.put<{ Params: { id: string } }>(
    '/:id',
    {
      preHandler: [authorize(Roles.ADMIN)],
      schema: {
        description: 'Update a weather station',
        tags: ['stations'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
        body: {
          type: 'object',
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 255 },
            source: { type: 'string', minLength: 1, maxLength: 50 },
            stationType: { type: 'string', maxLength: 50 },
            latitude: { type: 'number', minimum: -90, maximum: 90 },
            longitude: { type: 'number', minimum: -180, maximum: 180 },
            elevationM: { type: 'number' },
            municipalityId: { type: 'string', format: 'uuid' },
            status: { type: 'string', enum: ['active', 'inactive', 'maintenance'] },
            metadata: { type: 'object', additionalProperties: true },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;

      // Verify station exists
      const existing = await prisma.station.findUnique({
        where: { id },
      });

      if (!existing) {
        throw new NotFoundError('Station', id);
      }

      const input = updateStationSchema.parse(request.body);
      const station = await stationsService.update(id, input);

      // Audit log
      await prisma.auditLog.create({
        data: {
          userId: request.user!.userId,
          action: 'UPDATE_STATION',
          entityType: 'station',
          entityId: id,
          oldValues: {
            name: existing.name,
            source: existing.source,
            status: existing.status,
          },
          newValues: input,
        },
      });

      return {
        success: true,
        data: { station },
      };
    }
  );

  /**
   * DELETE /:id - Delete station (ADMIN)
   */
  app.delete<{ Params: { id: string } }>(
    '/:id',
    {
      preHandler: [authorize(Roles.ADMIN)],
      schema: {
        description: 'Delete a weather station',
        tags: ['stations'],
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

      // Verify station exists
      const existing = await prisma.station.findUnique({
        where: { id },
      });

      if (!existing) {
        throw new NotFoundError('Station', id);
      }

      await prisma.station.delete({
        where: { id },
      });

      // Audit log
      await prisma.auditLog.create({
        data: {
          userId: request.user!.userId,
          action: 'DELETE_STATION',
          entityType: 'station',
          entityId: id,
          oldValues: {
            code: existing.code,
            name: existing.name,
          },
        },
      });

      return {
        success: true,
        message: 'Station deleted successfully',
      };
    }
  );
}
