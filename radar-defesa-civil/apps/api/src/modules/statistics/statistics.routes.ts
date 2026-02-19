// Statistics API Routes
// Provides aggregated statistics and metrics for dashboards

import { FastifyInstance, FastifyRequest } from 'fastify';
import { prisma } from '../../config/database.js';
import { authenticate } from '../../middleware/auth.js';

interface DateRangeQuery {
  startDate?: string;
  endDate?: string;
  municipalityId?: string;
  consortiumId?: string;
}

interface TimeSeriesQuery extends DateRangeQuery {
  interval?: 'hour' | 'day' | 'week' | 'month';
}

export async function statisticsRoutes(app: FastifyInstance) {
  // All routes require authentication
  app.addHook('onRequest', authenticate);

  // GET /statistics/overview - General overview statistics
  app.get('/overview', async (request: FastifyRequest<{ Querystring: DateRangeQuery }>) => {
    const { startDate, endDate, municipalityId, consortiumId } = request.query;

    const dateFilter = buildDateFilter(startDate, endDate);
    const locationFilter = buildLocationFilter(municipalityId, consortiumId);

    // Get alert statistics
    const [
      alertStats,
      activeAlerts,
      precipitationStats,
      responseTimeStats,
    ] = await Promise.all([
      // Total alerts by severity
      prisma.alert.groupBy({
        by: ['severity'],
        where: { ...dateFilter, ...locationFilter },
        _count: { id: true },
      }),

      // Currently active alerts
      prisma.alert.count({
        where: {
          status: { in: ['active', 'acknowledged'] },
          ...locationFilter,
        },
      }),

      // Precipitation statistics
      prisma.precipitationObservation.aggregate({
        where: { ...dateFilter, ...(municipalityId ? { municipalityId } : {}) },
        _sum: { precipitationMm: true },
        _avg: { precipitationMm: true },
        _max: { precipitationMm: true },
        _count: { id: true },
      }),

      // Average response time (time to acknowledge)
      prisma.$queryRaw<{ avgResponseMinutes: number }[]>`
        SELECT AVG(EXTRACT(EPOCH FROM (acknowledged_at - started_at)) / 60) as "avgResponseMinutes"
        FROM alerts
        WHERE acknowledged_at IS NOT NULL
        ${startDate ? prisma.$queryRaw`AND started_at >= ${new Date(startDate)}` : prisma.$queryRaw``}
        ${endDate ? prisma.$queryRaw`AND started_at <= ${new Date(endDate)}` : prisma.$queryRaw``}
        ${municipalityId ? prisma.$queryRaw`AND municipality_id = ${municipalityId}` : prisma.$queryRaw``}
      `,
    ]);

    // Transform alert stats
    const alertsBySeverity = {
      observation: 0,
      attention: 0,
      alert: 0,
      max_alert: 0,
    };
    alertStats.forEach((stat) => {
      alertsBySeverity[stat.severity as keyof typeof alertsBySeverity] = stat._count.id;
    });

    const totalAlerts = Object.values(alertsBySeverity).reduce((a, b) => a + b, 0);

    return {
      data: {
        alerts: {
          total: totalAlerts,
          active: activeAlerts,
          bySeverity: alertsBySeverity,
        },
        precipitation: {
          totalMm: Number(precipitationStats._sum.precipitationMm) || 0,
          averageMm: Number(precipitationStats._avg.precipitationMm) || 0,
          maxMm: Number(precipitationStats._max.precipitationMm) || 0,
          observations: precipitationStats._count.id,
        },
        responseTime: {
          averageMinutes: responseTimeStats[0]?.avgResponseMinutes || 0,
        },
        period: {
          startDate: startDate || 'all',
          endDate: endDate || 'now',
        },
      },
    };
  });

  // GET /statistics/alerts - Detailed alert statistics
  app.get('/alerts', async (request: FastifyRequest<{ Querystring: DateRangeQuery }>) => {
    const { startDate, endDate, municipalityId, consortiumId } = request.query;

    const dateFilter = buildDateFilter(startDate, endDate);
    const locationFilter = buildLocationFilter(municipalityId, consortiumId);

    const [
      bySeverity,
      byType,
      byStatus,
      byMunicipality,
      escalated,
      avgDuration,
    ] = await Promise.all([
      // By severity
      prisma.alert.groupBy({
        by: ['severity'],
        where: { ...dateFilter, ...locationFilter },
        _count: { id: true },
      }),

      // By type
      prisma.alert.groupBy({
        by: ['type'],
        where: { ...dateFilter, ...locationFilter },
        _count: { id: true },
      }),

      // By status
      prisma.alert.groupBy({
        by: ['status'],
        where: { ...dateFilter, ...locationFilter },
        _count: { id: true },
      }),

      // By municipality (top 10)
      prisma.alert.groupBy({
        by: ['municipalityId'],
        where: { ...dateFilter, ...locationFilter, municipalityId: { not: null } },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 10,
      }),

      // Escalated alerts count
      prisma.alert.count({
        where: {
          ...dateFilter,
          ...locationFilter,
          metadata: { path: ['escalated'], equals: true },
        },
      }),

      // Average alert duration
      prisma.$queryRaw<{ avgDurationHours: number }[]>`
        SELECT AVG(EXTRACT(EPOCH FROM (COALESCE(ended_at, NOW()) - started_at)) / 3600) as "avgDurationHours"
        FROM alerts
        WHERE 1=1
        ${startDate ? prisma.$queryRaw`AND started_at >= ${new Date(startDate)}` : prisma.$queryRaw``}
        ${endDate ? prisma.$queryRaw`AND started_at <= ${new Date(endDate)}` : prisma.$queryRaw``}
      `,
    ]);

    // Get municipality names
    const municipalityIds = byMunicipality
      .map((m) => m.municipalityId)
      .filter((id): id is string => id !== null);

    const municipalities = await prisma.municipality.findMany({
      where: { id: { in: municipalityIds } },
      select: { id: true, name: true },
    });

    const municipalityMap = new Map(municipalities.map((m) => [m.id, m.name]));

    return {
      data: {
        bySeverity: bySeverity.map((s) => ({
          severity: s.severity,
          count: s._count.id,
        })),
        byType: byType.map((t) => ({
          type: t.type,
          count: t._count.id,
        })),
        byStatus: byStatus.map((s) => ({
          status: s.status,
          count: s._count.id,
        })),
        byMunicipality: byMunicipality.map((m) => ({
          municipalityId: m.municipalityId,
          municipalityName: municipalityMap.get(m.municipalityId!) || 'N/A',
          count: m._count.id,
        })),
        escalated,
        avgDurationHours: avgDuration[0]?.avgDurationHours || 0,
      },
    };
  });

  // GET /statistics/alerts/timeseries - Alert time series data
  app.get('/alerts/timeseries', async (request: FastifyRequest<{ Querystring: TimeSeriesQuery }>) => {
    const { startDate, endDate, interval = 'day', municipalityId } = request.query;

    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    const intervalMap = {
      hour: 'hour',
      day: 'day',
      week: 'week',
      month: 'month',
    };

    const data = await prisma.$queryRaw<{ period: Date; count: number; severity: string }[]>`
      SELECT
        date_trunc(${intervalMap[interval]}, started_at) as period,
        severity,
        COUNT(*)::int as count
      FROM alerts
      WHERE started_at >= ${start}
        AND started_at <= ${end}
        ${municipalityId ? prisma.$queryRaw`AND municipality_id = ${municipalityId}` : prisma.$queryRaw``}
      GROUP BY date_trunc(${intervalMap[interval]}, started_at), severity
      ORDER BY period ASC
    `;

    // Transform to grouped by period
    const grouped = new Map<string, Record<string, number>>();
    data.forEach((row) => {
      const key = row.period.toISOString();
      if (!grouped.has(key)) {
        grouped.set(key, { observation: 0, attention: 0, alert: 0, max_alert: 0 });
      }
      grouped.get(key)![row.severity] = row.count;
    });

    const timeseries = Array.from(grouped.entries()).map(([period, counts]) => ({
      period,
      ...counts,
      total: Object.values(counts).reduce((a, b) => a + b, 0),
    }));

    return { data: { timeseries, interval } };
  });

  // GET /statistics/precipitation - Precipitation statistics
  app.get('/precipitation', async (request: FastifyRequest<{ Querystring: DateRangeQuery }>) => {
    const { startDate, endDate, municipalityId } = request.query;

    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    const [
      overall,
      bySource,
      byMunicipality,
      maxEvents,
    ] = await Promise.all([
      // Overall statistics
      prisma.precipitationObservation.aggregate({
        where: {
          observationTime: { gte: start, lte: end },
          ...(municipalityId ? { municipalityId } : {}),
        },
        _sum: { precipitationMm: true },
        _avg: { precipitationMm: true },
        _max: { precipitationMm: true },
        _count: { id: true },
      }),

      // By source
      prisma.precipitationObservation.groupBy({
        by: ['source'],
        where: {
          observationTime: { gte: start, lte: end },
          ...(municipalityId ? { municipalityId } : {}),
        },
        _sum: { precipitationMm: true },
        _avg: { precipitationMm: true },
        _count: { id: true },
      }),

      // By municipality (top 10 by total precipitation)
      prisma.precipitationObservation.groupBy({
        by: ['municipalityId'],
        where: {
          observationTime: { gte: start, lte: end },
          municipalityId: { not: null },
        },
        _sum: { precipitationMm: true },
        _max: { precipitationMm: true },
        orderBy: { _sum: { precipitationMm: 'desc' } },
        take: 10,
      }),

      // Top precipitation events
      prisma.precipitationObservation.findMany({
        where: {
          observationTime: { gte: start, lte: end },
          ...(municipalityId ? { municipalityId } : {}),
        },
        orderBy: { precipitationMm: 'desc' },
        take: 10,
        include: {
          municipality: { select: { name: true } },
        },
      }),
    ]);

    // Get municipality names
    const municipalityIds = byMunicipality
      .map((m) => m.municipalityId)
      .filter((id): id is string => id !== null);

    const municipalities = await prisma.municipality.findMany({
      where: { id: { in: municipalityIds } },
      select: { id: true, name: true },
    });

    const municipalityMap = new Map(municipalities.map((m) => [m.id, m.name]));

    return {
      data: {
        overall: {
          totalMm: Number(overall._sum.precipitationMm) || 0,
          averageMm: Number(overall._avg.precipitationMm) || 0,
          maxMm: Number(overall._max.precipitationMm) || 0,
          observations: overall._count.id,
        },
        bySource: bySource.map((s) => ({
          source: s.source,
          totalMm: Number(s._sum.precipitationMm) || 0,
          averageMm: Number(s._avg.precipitationMm) || 0,
          observations: s._count.id,
        })),
        byMunicipality: byMunicipality.map((m) => ({
          municipalityId: m.municipalityId,
          municipalityName: municipalityMap.get(m.municipalityId!) || 'N/A',
          totalMm: Number(m._sum.precipitationMm) || 0,
          maxMm: Number(m._max.precipitationMm) || 0,
        })),
        topEvents: maxEvents.map((e) => ({
          id: e.id,
          municipalityName: e.municipality?.name || 'N/A',
          precipitationMm: Number(e.precipitationMm),
          observationTime: e.observationTime,
          source: e.source,
        })),
        period: { startDate: start.toISOString(), endDate: end.toISOString() },
      },
    };
  });

  // GET /statistics/precipitation/timeseries - Precipitation time series
  app.get('/precipitation/timeseries', async (request: FastifyRequest<{ Querystring: TimeSeriesQuery }>) => {
    const { startDate, endDate, interval = 'day', municipalityId } = request.query;

    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    const intervalMap = {
      hour: 'hour',
      day: 'day',
      week: 'week',
      month: 'month',
    };

    const data = await prisma.$queryRaw<{ period: Date; total: number; avg: number; max: number; count: number }[]>`
      SELECT
        date_trunc(${intervalMap[interval]}, observation_time) as period,
        SUM(precipitation_mm)::float as total,
        AVG(precipitation_mm)::float as avg,
        MAX(precipitation_mm)::float as max,
        COUNT(*)::int as count
      FROM precipitation_observations
      WHERE observation_time >= ${start}
        AND observation_time <= ${end}
        ${municipalityId ? prisma.$queryRaw`AND municipality_id = ${municipalityId}` : prisma.$queryRaw``}
      GROUP BY date_trunc(${intervalMap[interval]}, observation_time)
      ORDER BY period ASC
    `;

    return {
      data: {
        timeseries: data.map((row) => ({
          period: row.period.toISOString(),
          totalMm: row.total || 0,
          avgMm: row.avg || 0,
          maxMm: row.max || 0,
          observations: row.count,
        })),
        interval,
      },
    };
  });

  // GET /statistics/municipalities - Municipality comparison statistics
  app.get('/municipalities', async (request: FastifyRequest<{ Querystring: DateRangeQuery }>) => {
    const { startDate, endDate, consortiumId } = request.query;

    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    // Get all municipalities
    const municipalities = await prisma.municipality.findMany({
      where: consortiumId ? { consortiumId } : {},
      select: {
        id: true,
        name: true,
        population: true,
        _count: {
          select: {
            alerts: {
              where: { startedAt: { gte: start, lte: end } },
            },
          },
        },
      },
    });

    // Get precipitation totals per municipality
    const precipTotals = await prisma.precipitationObservation.groupBy({
      by: ['municipalityId'],
      where: {
        observationTime: { gte: start, lte: end },
        municipalityId: { in: municipalities.map((m) => m.id) },
      },
      _sum: { precipitationMm: true },
      _max: { precipitationMm: true },
    });

    const precipMap = new Map(
      precipTotals.map((p) => [
        p.municipalityId,
        { total: Number(p._sum.precipitationMm) || 0, max: Number(p._max.precipitationMm) || 0 },
      ])
    );

    // Get alert severity breakdown per municipality
    const alertsBySeverity = await prisma.alert.groupBy({
      by: ['municipalityId', 'severity'],
      where: {
        startedAt: { gte: start, lte: end },
        municipalityId: { in: municipalities.map((m) => m.id) },
      },
      _count: { id: true },
    });

    const severityMap = new Map<string, Record<string, number>>();
    alertsBySeverity.forEach((a) => {
      if (!a.municipalityId) return;
      if (!severityMap.has(a.municipalityId)) {
        severityMap.set(a.municipalityId, { observation: 0, attention: 0, alert: 0, max_alert: 0 });
      }
      severityMap.get(a.municipalityId)![a.severity] = a._count.id;
    });

    const comparison = municipalities.map((m) => ({
      id: m.id,
      name: m.name,
      population: m.population,
      alerts: {
        total: m._count.alerts,
        bySeverity: severityMap.get(m.id) || { observation: 0, attention: 0, alert: 0, max_alert: 0 },
      },
      precipitation: precipMap.get(m.id) || { total: 0, max: 0 },
    }));

    // Sort by total alerts descending
    comparison.sort((a, b) => b.alerts.total - a.alerts.total);

    return {
      data: {
        municipalities: comparison,
        period: { startDate: start.toISOString(), endDate: end.toISOString() },
      },
    };
  });

  // GET /statistics/response-times - Alert response time analysis
  app.get('/response-times', async (request: FastifyRequest<{ Querystring: DateRangeQuery }>) => {
    const { startDate, endDate, municipalityId } = request.query;

    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    // Response time statistics
    const [overall, bySeverity, byHour] = await Promise.all([
      // Overall stats
      prisma.$queryRaw<{ avg: number; min: number; max: number; median: number; count: number }[]>`
        SELECT
          AVG(EXTRACT(EPOCH FROM (acknowledged_at - started_at)) / 60)::float as avg,
          MIN(EXTRACT(EPOCH FROM (acknowledged_at - started_at)) / 60)::float as min,
          MAX(EXTRACT(EPOCH FROM (acknowledged_at - started_at)) / 60)::float as max,
          PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (acknowledged_at - started_at)) / 60)::float as median,
          COUNT(*)::int as count
        FROM alerts
        WHERE acknowledged_at IS NOT NULL
          AND started_at >= ${start}
          AND started_at <= ${end}
          ${municipalityId ? prisma.$queryRaw`AND municipality_id = ${municipalityId}` : prisma.$queryRaw``}
      `,

      // By severity
      prisma.$queryRaw<{ severity: string; avg: number; count: number }[]>`
        SELECT
          severity,
          AVG(EXTRACT(EPOCH FROM (acknowledged_at - started_at)) / 60)::float as avg,
          COUNT(*)::int as count
        FROM alerts
        WHERE acknowledged_at IS NOT NULL
          AND started_at >= ${start}
          AND started_at <= ${end}
          ${municipalityId ? prisma.$queryRaw`AND municipality_id = ${municipalityId}` : prisma.$queryRaw``}
        GROUP BY severity
      `,

      // By hour of day
      prisma.$queryRaw<{ hour: number; avg: number; count: number }[]>`
        SELECT
          EXTRACT(HOUR FROM started_at)::int as hour,
          AVG(EXTRACT(EPOCH FROM (acknowledged_at - started_at)) / 60)::float as avg,
          COUNT(*)::int as count
        FROM alerts
        WHERE acknowledged_at IS NOT NULL
          AND started_at >= ${start}
          AND started_at <= ${end}
          ${municipalityId ? prisma.$queryRaw`AND municipality_id = ${municipalityId}` : prisma.$queryRaw``}
        GROUP BY EXTRACT(HOUR FROM started_at)
        ORDER BY hour
      `,
    ]);

    return {
      data: {
        overall: overall[0] || { avg: 0, min: 0, max: 0, median: 0, count: 0 },
        bySeverity: bySeverity.map((s) => ({
          severity: s.severity,
          avgMinutes: s.avg || 0,
          count: s.count,
        })),
        byHour: byHour.map((h) => ({
          hour: h.hour,
          avgMinutes: h.avg || 0,
          count: h.count,
        })),
        period: { startDate: start.toISOString(), endDate: end.toISOString() },
      },
    };
  });
}

// Helper functions
function buildDateFilter(startDate?: string, endDate?: string) {
  const filter: { startedAt?: { gte?: Date; lte?: Date } } = {};

  if (startDate || endDate) {
    filter.startedAt = {};
    if (startDate) filter.startedAt.gte = new Date(startDate);
    if (endDate) filter.startedAt.lte = new Date(endDate);
  }

  return filter;
}

function buildLocationFilter(municipalityId?: string, consortiumId?: string) {
  const filter: { municipalityId?: string; consortiumId?: string } = {};

  if (municipalityId) filter.municipalityId = municipalityId;
  if (consortiumId) filter.consortiumId = consortiumId;

  return filter;
}
