import { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';

// Create a custom registry
export const metricsRegistry = new Registry();

// Add default metrics (CPU, memory, etc.)
collectDefaultMetrics({ register: metricsRegistry });

// HTTP Request metrics
export const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status'],
  registers: [metricsRegistry],
});

export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [metricsRegistry],
});

export const httpRequestSize = new Histogram({
  name: 'http_request_size_bytes',
  help: 'Size of HTTP requests in bytes',
  labelNames: ['method', 'route'],
  buckets: [100, 1000, 10000, 100000, 1000000],
  registers: [metricsRegistry],
});

export const httpResponseSize = new Histogram({
  name: 'http_response_size_bytes',
  help: 'Size of HTTP responses in bytes',
  labelNames: ['method', 'route'],
  buckets: [100, 1000, 10000, 100000, 1000000],
  registers: [metricsRegistry],
});

// WebSocket metrics
export const wsConnectionsTotal = new Gauge({
  name: 'websocket_connections_total',
  help: 'Total number of active WebSocket connections',
  registers: [metricsRegistry],
});

export const wsMessagesTotal = new Counter({
  name: 'websocket_messages_total',
  help: 'Total number of WebSocket messages',
  labelNames: ['direction', 'type'],
  registers: [metricsRegistry],
});

// Database metrics
export const dbQueryDuration = new Histogram({
  name: 'db_query_duration_seconds',
  help: 'Duration of database queries in seconds',
  labelNames: ['operation', 'model'],
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [metricsRegistry],
});

export const dbConnectionsActive = new Gauge({
  name: 'db_connections_active',
  help: 'Number of active database connections',
  registers: [metricsRegistry],
});

// Redis metrics
export const redisOperationsTotal = new Counter({
  name: 'redis_operations_total',
  help: 'Total number of Redis operations',
  labelNames: ['operation', 'status'],
  registers: [metricsRegistry],
});

export const redisOperationDuration = new Histogram({
  name: 'redis_operation_duration_seconds',
  help: 'Duration of Redis operations in seconds',
  labelNames: ['operation'],
  buckets: [0.0001, 0.0005, 0.001, 0.005, 0.01, 0.025, 0.05, 0.1],
  registers: [metricsRegistry],
});

// Alert metrics
export const alertsActiveTotal = new Gauge({
  name: 'radar_alerts_active_total',
  help: 'Total number of active alerts',
  labelNames: ['severity'],
  registers: [metricsRegistry],
});

export const alertsUnacknowledgedTotal = new Gauge({
  name: 'radar_alerts_unacknowledged_total',
  help: 'Total number of unacknowledged alerts',
  labelNames: ['severity'],
  registers: [metricsRegistry],
});

export const alertsCreatedTotal = new Counter({
  name: 'radar_alerts_created_total',
  help: 'Total number of alerts created',
  labelNames: ['severity', 'type'],
  registers: [metricsRegistry],
});

export const alertsResolvedTotal = new Counter({
  name: 'radar_alerts_resolved_total',
  help: 'Total number of alerts resolved',
  labelNames: ['severity'],
  registers: [metricsRegistry],
});

export const alertResolutionDuration = new Histogram({
  name: 'radar_alert_resolution_duration_seconds',
  help: 'Time to resolve alerts in seconds',
  labelNames: ['severity'],
  buckets: [60, 300, 600, 1800, 3600, 7200, 14400, 28800, 86400],
  registers: [metricsRegistry],
});

// Radar data metrics
export const radarLastScanTimestamp = new Gauge({
  name: 'radar_last_scan_timestamp',
  help: 'Timestamp of the last radar scan',
  labelNames: ['radar_id'],
  registers: [metricsRegistry],
});

export const radarScansProcessedTotal = new Counter({
  name: 'radar_scans_processed_total',
  help: 'Total number of radar scans processed',
  labelNames: ['radar_id', 'status'],
  registers: [metricsRegistry],
});

export const radarProcessingDuration = new Histogram({
  name: 'radar_processing_duration_seconds',
  help: 'Duration of radar data processing in seconds',
  labelNames: ['radar_id'],
  buckets: [1, 5, 10, 30, 60, 120, 300],
  registers: [metricsRegistry],
});

// Notification metrics
export const notificationsSentTotal = new Counter({
  name: 'radar_notifications_sent_total',
  help: 'Total number of notifications sent',
  labelNames: ['channel', 'status'],
  registers: [metricsRegistry],
});

export const notificationDuration = new Histogram({
  name: 'radar_notification_duration_seconds',
  help: 'Duration of notification sending in seconds',
  labelNames: ['channel'],
  buckets: [0.1, 0.5, 1, 2, 5, 10],
  registers: [metricsRegistry],
});

// User metrics
export const usersActiveTotal = new Gauge({
  name: 'radar_users_active_total',
  help: 'Total number of active users',
  labelNames: ['role'],
  registers: [metricsRegistry],
});

export const userLoginsTotal = new Counter({
  name: 'radar_user_logins_total',
  help: 'Total number of user logins',
  labelNames: ['status'],
  registers: [metricsRegistry],
});

// Export function to get metrics
export async function getMetrics(): Promise<string> {
  return await metricsRegistry.metrics();
}

// Export function to get metrics content type
export function getMetricsContentType(): string {
  return metricsRegistry.contentType;
}
