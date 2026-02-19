import { FastifyInstance } from 'fastify';
import { prisma } from '../../config/database.js';
import { cache } from '../../config/redis.js';
import { authenticate } from '../../middleware/auth.js';
import { NotFoundError } from '../../utils/errors.js';
import { z } from 'zod';

const queryHistorySchema = z.object({
  radarId: z.string().uuid().optional(),
  productType: z.string().optional(),
  start: z.coerce.date().optional(),
  end: z.coerce.date().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
});

export async function radarRoutes(app: FastifyInstance): Promise<void> {
  // List radar sites
  app.get(
    '/sites',
    {
      preHandler: [authenticate],
      schema: {
        description: 'List radar sites',
        tags: ['radar'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const cacheKey = 'radar:sites';
      const cached = await cache.get<unknown[]>(cacheKey);

      if (cached) {
        return { success: true, data: { radars: cached } };
      }

      const radars = await prisma.radar.findMany({
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          code: true,
          latitude: true,
          longitude: true,
          elevationM: true,
          rangeKm: true,
          manufacturer: true,
          model: true,
          band: true,
          status: true,
          lastScanAt: true,
        },
      });

      await cache.set(cacheKey, radars, 60);

      return { success: true, data: { radars } };
    }
  );

  // Get radar details
  app.get<{ Params: { id: string } }>(
    '/sites/:id',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Get radar details',
        tags: ['radar'],
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
      const radar = await prisma.radar.findUnique({
        where: { id: request.params.id },
        include: {
          scans: {
            orderBy: { scanTime: 'desc' },
            take: 10,
            select: {
              id: true,
              scanTime: true,
              productType: true,
              tilePath: true,
              qualityScore: true,
            },
          },
        },
      });

      if (!radar) {
        throw new NotFoundError('Radar', request.params.id);
      }

      return { success: true, data: { radar } };
    }
  );

  // Get latest scan
  app.get(
    '/latest',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Get latest radar scans',
        tags: ['radar'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const cacheKey = 'radar:latest';
      const cached = await cache.get(cacheKey);

      if (cached) {
        return { success: true, data: cached };
      }

      // Get latest scan for each radar
      const radars = await prisma.radar.findMany({
        where: { status: 'operational' },
        select: {
          id: true,
          code: true,
          name: true,
          latitude: true,
          longitude: true,
        },
      });

      const latestScans = await Promise.all(
        radars.map(async (radar) => {
          const latestScan = await prisma.radarScan.findFirst({
            where: { radarId: radar.id },
            orderBy: { scanTime: 'desc' },
            select: {
              id: true,
              scanTime: true,
              productType: true,
              tilePath: true,
              qualityScore: true,
              metadata: true,
            },
          });

          return {
            radar,
            latestScan,
          };
        })
      );

      const data = { scans: latestScans, timestamp: new Date().toISOString() };
      await cache.set(cacheKey, data, 30);

      return { success: true, data };
    }
  );

  // Get latest scan for specific radar
  app.get<{ Params: { radarId: string } }>(
    '/latest/:radarId',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Get latest scan for specific radar',
        tags: ['radar'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['radarId'],
          properties: {
            radarId: { type: 'string', format: 'uuid' },
          },
        },
      },
    },
    async (request, reply) => {
      const { radarId } = request.params;

      const radar = await prisma.radar.findUnique({
        where: { id: radarId },
      });

      if (!radar) {
        throw new NotFoundError('Radar', radarId);
      }

      const latestScan = await prisma.radarScan.findFirst({
        where: { radarId },
        orderBy: { scanTime: 'desc' },
      });

      return {
        success: true,
        data: {
          radar: {
            id: radar.id,
            code: radar.code,
            name: radar.name,
          },
          scan: latestScan,
        },
      };
    }
  );

  // Get scan history
  app.get(
    '/history',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Get radar scan history',
        tags: ['radar'],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            radarId: { type: 'string', format: 'uuid' },
            productType: { type: 'string' },
            start: { type: 'string', format: 'date-time' },
            end: { type: 'string', format: 'date-time' },
            limit: { type: 'number' },
          },
        },
      },
    },
    async (request, reply) => {
      const query = queryHistorySchema.parse(request.query);

      const where: {
        radarId?: string;
        productType?: string;
        scanTime?: { gte?: Date; lte?: Date };
      } = {};

      if (query.radarId) where.radarId = query.radarId;
      if (query.productType) where.productType = query.productType;
      if (query.start || query.end) {
        where.scanTime = {};
        if (query.start) where.scanTime.gte = query.start;
        if (query.end) where.scanTime.lte = query.end;
      }

      const scans = await prisma.radarScan.findMany({
        where,
        orderBy: { scanTime: 'desc' },
        take: query.limit,
        include: {
          radar: {
            select: { id: true, code: true, name: true },
          },
        },
      });

      return { success: true, data: { scans } };
    }
  );

  // Get available products
  app.get(
    '/products',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Get available radar products',
        tags: ['radar'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const products = [
        {
          code: 'PPI',
          name: 'Plan Position Indicator',
          description: 'Refletividade em elevação fixa',
        },
        {
          code: 'CAPPI',
          name: 'Constant Altitude PPI',
          description: 'Refletividade em altitude constante',
        },
        {
          code: 'MAX-Z',
          name: 'Maximum Reflectivity',
          description: 'Refletividade máxima na coluna vertical',
        },
        {
          code: 'VIL',
          name: 'Vertically Integrated Liquid',
          description: 'Conteúdo de água líquida integrado verticalmente',
        },
        {
          code: 'ECHO-TOP',
          name: 'Echo Top',
          description: 'Altura do topo do eco radar',
        },
        {
          code: 'QPE',
          name: 'Quantitative Precipitation Estimation',
          description: 'Estimativa de precipitação',
        },
      ];

      return { success: true, data: { products } };
    }
  );
}
