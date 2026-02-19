import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';

import { env } from './config/env.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { connectRedis, disconnectRedis } from './config/redis.js';
import { errorHandler } from './middleware/error-handler.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { usersRoutes } from './modules/users/users.routes.js';
import { radarRoutes } from './modules/radar/radar.routes.js';
import { alertsRoutes } from './modules/alerts/alerts.routes.js';
import { municipalitiesRoutes } from './modules/municipalities/municipalities.routes.js';
import { statisticsRoutes } from './modules/statistics/statistics.routes.js';
import { reportsRoutes } from './modules/reports/reports.routes.js';
import { createLogger } from './utils/logger.js';
import { initializeJobs, shutdownJobs } from './jobs/index.js';
import { startRadarListener, stopRadarListener } from './services/radar-listener.service.js';

const logger = createLogger('server');

async function buildApp() {
  const app = Fastify({
    logger: {
      level: env.NODE_ENV === 'production' ? 'info' : 'debug',
      transport: env.NODE_ENV === 'development'
        ? {
            target: 'pino-pretty',
            options: { colorize: true },
          }
        : undefined,
    },
  });

  // Plugins
  await app.register(cors, {
    origin: env.NODE_ENV === 'production'
      ? ['https://radar.defesacivil.gov.br']
      : true,
    credentials: true,
  });

  await app.register(helmet, {
    contentSecurityPolicy: env.NODE_ENV === 'production',
  });

  await app.register(jwt, {
    secret: env.JWT_SECRET,
  });

  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });

  // Swagger documentation
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'Radar Defesa Civil API',
        description: 'API para monitoramento meteorológico em tempo real',
        version: '1.0.0',
      },
      servers: [
        { url: 'http://localhost:3001/api/v1', description: 'Development' },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
    },
  });

  await app.register(swaggerUi, {
    routePrefix: '/docs',
  });

  // Error handler
  app.setErrorHandler(errorHandler);

  // Health check
  app.get('/health', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  }));

  // API routes
  await app.register(
    async (api) => {
      await api.register(authRoutes, { prefix: '/auth' });
      await api.register(usersRoutes, { prefix: '/users' });
      await api.register(radarRoutes, { prefix: '/radar' });
      await api.register(alertsRoutes, { prefix: '/alerts' });
      await api.register(municipalitiesRoutes, { prefix: '/municipalities' });
      await api.register(statisticsRoutes, { prefix: '/statistics' });
      await api.register(reportsRoutes, { prefix: '/reports' });
    },
    { prefix: '/api/v1' }
  );

  return app;
}

async function start() {
  try {
    // Connect to databases
    await connectDatabase();
    await connectRedis();

    const app = await buildApp();

    // Initialize background jobs
    await initializeJobs();

    // Start radar listener for real-time processing
    await startRadarListener();

    // Start server
    await app.listen({
      port: env.API_PORT,
      host: env.API_HOST,
    });

    logger.info(`Server running at http://${env.API_HOST}:${env.API_PORT}`);
    logger.info(`Documentation at http://${env.API_HOST}:${env.API_PORT}/docs`);

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info(`${signal} received, shutting down...`);
      await stopRadarListener();
      await shutdownJobs();
      await app.close();
      await disconnectDatabase();
      await disconnectRedis();
      process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    logger.error(error, 'Failed to start server');
    process.exit(1);
  }
}

start();
