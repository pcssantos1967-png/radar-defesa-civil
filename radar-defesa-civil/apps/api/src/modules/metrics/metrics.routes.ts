import { FastifyInstance } from 'fastify';
import { getMetrics, getMetricsContentType } from './metrics.service.js';

export async function metricsRoutes(app: FastifyInstance) {
  // Prometheus metrics endpoint
  app.get('/metrics', async (request, reply) => {
    const metrics = await getMetrics();
    reply.header('Content-Type', getMetricsContentType());
    return metrics;
  });

  // Health check endpoints for monitoring
  app.get('/health', async () => {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  });

  app.get('/health/db', async (request, reply) => {
    try {
      // Import prisma dynamically to avoid circular dependencies
      const { prisma } = await import('../../config/database.js');
      await prisma.$queryRaw`SELECT 1`;
      return {
        status: 'healthy',
        database: 'connected',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      reply.status(503);
      return {
        status: 'unhealthy',
        database: 'disconnected',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  });

  app.get('/health/redis', async (request, reply) => {
    try {
      const { redis } = await import('../../config/redis.js');
      await redis.ping();
      return {
        status: 'healthy',
        redis: 'connected',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      reply.status(503);
      return {
        status: 'unhealthy',
        redis: 'disconnected',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  });

  app.get('/health/ready', async (request, reply) => {
    try {
      const { prisma } = await import('../../config/database.js');
      const { redis } = await import('../../config/redis.js');

      const [dbCheck, redisCheck] = await Promise.allSettled([
        prisma.$queryRaw`SELECT 1`,
        redis.ping(),
      ]);

      const isReady =
        dbCheck.status === 'fulfilled' && redisCheck.status === 'fulfilled';

      if (!isReady) {
        reply.status(503);
      }

      return {
        status: isReady ? 'ready' : 'not_ready',
        checks: {
          database: dbCheck.status === 'fulfilled' ? 'ok' : 'failed',
          redis: redisCheck.status === 'fulfilled' ? 'ok' : 'failed',
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      reply.status(503);
      return {
        status: 'not_ready',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  });

  app.get('/health/live', async () => {
    return {
      status: 'alive',
      timestamp: new Date().toISOString(),
    };
  });
}
