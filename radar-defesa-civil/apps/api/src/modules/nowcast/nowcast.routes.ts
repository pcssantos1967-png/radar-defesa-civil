import { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/auth.js';
import { NotFoundError } from '../../utils/errors.js';
import {
  queryActiveCellsSchema,
  queryCellTrackSchema,
  queryForecastsSchema,
} from './nowcast.schema.js';
import * as nowcastService from './nowcast.service.js';

export async function nowcastRoutes(app: FastifyInstance): Promise<void> {
  /**
   * GET /cells - List active convective cells
   */
  app.get(
    '/cells',
    {
      preHandler: [authenticate],
      schema: {
        description: 'List active convective cells',
        tags: ['nowcast'],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            severity: {
              type: 'string',
              enum: ['weak', 'moderate', 'strong', 'severe'],
            },
            minReflectivity: { type: 'number', minimum: 0, maximum: 80 },
            limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
            isActive: { type: 'boolean', default: true },
          },
        },
      },
    },
    async (request, reply) => {
      const query = queryActiveCellsSchema.parse(request.query);
      const result = await nowcastService.getActiveCells(query);

      return {
        success: true,
        data: result,
      };
    }
  );

  /**
   * GET /cells/:trackId - Get cell track history
   */
  app.get<{ Params: { trackId: string } }>(
    '/cells/:trackId',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Get cell track history',
        tags: ['nowcast'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['trackId'],
          properties: {
            trackId: { type: 'string' },
          },
        },
        querystring: {
          type: 'object',
          properties: {
            limit: { type: 'integer', minimum: 1, maximum: 500, default: 100 },
            includeInactive: { type: 'boolean', default: false },
          },
        },
      },
    },
    async (request, reply) => {
      const { trackId } = request.params;
      const query = queryCellTrackSchema.parse(request.query);

      const result = await nowcastService.getCellTrack(trackId, query);

      if (result.track.length === 0) {
        throw new NotFoundError('CellTrack', trackId);
      }

      return {
        success: true,
        data: result,
      };
    }
  );

  /**
   * GET /forecasts - List nowcast forecasts
   */
  app.get(
    '/forecasts',
    {
      preHandler: [authenticate],
      schema: {
        description: 'List nowcast forecasts',
        tags: ['nowcast'],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            radarId: { type: 'string', format: 'uuid' },
            leadTimeMinutes: { type: 'integer', minimum: 0, maximum: 180 },
            forecastType: { type: 'string' },
            limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
            page: { type: 'integer', minimum: 1, default: 1 },
          },
        },
      },
    },
    async (request, reply) => {
      const query = queryForecastsSchema.parse(request.query);
      const result = await nowcastService.getForecasts(query);

      return {
        success: true,
        data: { forecasts: result.forecasts },
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
   * GET /forecasts/:id - Get forecast by ID
   */
  app.get<{ Params: { id: string } }>(
    '/forecasts/:id',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Get forecast by ID',
        tags: ['nowcast'],
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
      const forecast = await nowcastService.getForecastById(id);

      if (!forecast) {
        throw new NotFoundError('NowcastForecast', id);
      }

      return {
        success: true,
        data: { forecast },
      };
    }
  );

  /**
   * GET /summary - Dashboard widget data
   */
  app.get(
    '/summary',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Get nowcast summary for dashboard',
        tags: ['nowcast'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const summary = await nowcastService.getNowcastSummary();

      return {
        success: true,
        data: { summary },
      };
    }
  );

  /**
   * GET /tracks - Get active track IDs
   */
  app.get(
    '/tracks',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Get list of active cell track IDs',
        tags: ['nowcast'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const trackIds = await nowcastService.getActiveTrackIds();

      return {
        success: true,
        data: { trackIds, count: trackIds.length },
      };
    }
  );
}
