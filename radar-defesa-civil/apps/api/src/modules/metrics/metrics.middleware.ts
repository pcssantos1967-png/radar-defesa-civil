import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  httpRequestsTotal,
  httpRequestDuration,
  httpRequestSize,
  httpResponseSize,
} from './metrics.service.js';

export async function metricsMiddleware(app: FastifyInstance) {
  app.addHook('onRequest', async (request: FastifyRequest) => {
    // Store start time for duration calculation
    (request as any).metricsStartTime = process.hrtime.bigint();
  });

  app.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    const startTime = (request as any).metricsStartTime;
    if (!startTime) return;

    // Calculate duration in seconds
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1e9;

    // Get route pattern (use URL if no route match)
    const route = request.routeOptions?.url || request.url;
    const method = request.method;
    const status = reply.statusCode.toString();

    // Skip metrics endpoint itself
    if (route === '/api/v1/metrics') return;

    // Record metrics
    httpRequestsTotal.inc({ method, route, status });
    httpRequestDuration.observe({ method, route, status }, duration);

    // Record request size if available
    const contentLength = request.headers['content-length'];
    if (contentLength) {
      httpRequestSize.observe({ method, route }, parseInt(contentLength, 10));
    }

    // Record response size if available
    const responseLength = reply.getHeader('content-length');
    if (responseLength) {
      httpResponseSize.observe(
        { method, route },
        typeof responseLength === 'string' ? parseInt(responseLength, 10) : responseLength
      );
    }
  });
}

// Helper function to normalize route paths for metrics
export function normalizeRoute(route: string): string {
  // Replace UUIDs with :id
  return route.replace(
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
    ':id'
  );
}
