// Reports API Routes
// Generates reports with PDF and CSV export functionality

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../../config/database.js';
import { authenticate } from '../../middleware/auth.js';
import PDFDocument from 'pdfkit';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ReportQuery {
  startDate: string;
  endDate: string;
  municipalityId?: string;
  consortiumId?: string;
  format?: 'json' | 'csv' | 'pdf';
}

interface AlertReportQuery extends ReportQuery {
  severity?: string;
  type?: string;
  status?: string;
}

const SEVERITY_LABELS: Record<string, string> = {
  observation: 'Observação',
  attention: 'Atenção',
  alert: 'Alerta',
  max_alert: 'Alerta Máximo',
};

export async function reportsRoutes(app: FastifyInstance) {
  // All routes require authentication
  app.addHook('onRequest', authenticate);

  // GET /reports/alerts - Alert report
  app.get('/alerts', async (
    request: FastifyRequest<{ Querystring: AlertReportQuery }>,
    reply: FastifyReply
  ) => {
    const {
      startDate,
      endDate,
      municipalityId,
      consortiumId,
      severity,
      type,
      status,
      format: outputFormat = 'json',
    } = request.query;

    const start = new Date(startDate);
    const end = new Date(endDate);

    // Build query filters
    const where: Record<string, unknown> = {
      startedAt: { gte: start, lte: end },
    };

    if (municipalityId) where.municipalityId = municipalityId;
    if (consortiumId) where.consortiumId = consortiumId;
    if (severity) where.severity = severity;
    if (type) where.type = type;
    if (status) where.status = status;

    // Fetch alerts
    const alerts = await prisma.alert.findMany({
      where,
      include: {
        municipality: { select: { name: true, ibgeCode: true } },
        rule: { select: { name: true } },
      },
      orderBy: { startedAt: 'desc' },
    });

    // Calculate summary
    const summary = {
      total: alerts.length,
      bySeverity: {
        observation: alerts.filter((a) => a.severity === 'observation').length,
        attention: alerts.filter((a) => a.severity === 'attention').length,
        alert: alerts.filter((a) => a.severity === 'alert').length,
        max_alert: alerts.filter((a) => a.severity === 'max_alert').length,
      },
      byStatus: {
        active: alerts.filter((a) => a.status === 'active').length,
        acknowledged: alerts.filter((a) => a.status === 'acknowledged').length,
        resolved: alerts.filter((a) => a.status === 'resolved').length,
        expired: alerts.filter((a) => a.status === 'expired').length,
      },
      period: {
        startDate: start.toISOString(),
        endDate: end.toISOString(),
      },
    };

    // Format response based on requested format
    switch (outputFormat) {
      case 'csv':
        return generateAlertsCsv(alerts, summary, reply);
      case 'pdf':
        return generateAlertsPdf(alerts, summary, start, end, reply);
      default:
        return {
          data: {
            summary,
            alerts: alerts.map((a) => ({
              id: a.id,
              severity: a.severity,
              severityLabel: SEVERITY_LABELS[a.severity],
              type: a.type,
              title: a.title,
              description: a.description,
              status: a.status,
              municipalityName: a.municipality?.name || 'N/A',
              municipalityCode: a.municipality?.ibgeCode || 'N/A',
              ruleName: a.rule?.name || 'N/A',
              triggerValue: a.triggerValue,
              thresholdValue: a.thresholdValue,
              startedAt: a.startedAt,
              acknowledgedAt: a.acknowledgedAt,
              endedAt: a.endedAt,
            })),
          },
        };
    }
  });

  // GET /reports/precipitation - Precipitation report
  app.get('/precipitation', async (
    request: FastifyRequest<{ Querystring: ReportQuery }>,
    reply: FastifyReply
  ) => {
    const {
      startDate,
      endDate,
      municipalityId,
      format: outputFormat = 'json',
    } = request.query;

    const start = new Date(startDate);
    const end = new Date(endDate);

    // Fetch precipitation data
    const observations = await prisma.precipitationObservation.findMany({
      where: {
        observationTime: { gte: start, lte: end },
        ...(municipalityId ? { municipalityId } : {}),
      },
      include: {
        municipality: { select: { name: true, ibgeCode: true } },
      },
      orderBy: { observationTime: 'desc' },
    });

    // Calculate summary
    const totalPrecip = observations.reduce(
      (sum, o) => sum + (Number(o.precipitationMm) || 0),
      0
    );
    const avgPrecip = observations.length > 0 ? totalPrecip / observations.length : 0;
    const maxPrecip = Math.max(...observations.map((o) => Number(o.precipitationMm) || 0));

    // Group by municipality
    const byMunicipality = new Map<string, { name: string; total: number; max: number; count: number }>();
    observations.forEach((o) => {
      const key = o.municipalityId || 'unknown';
      const existing = byMunicipality.get(key) || {
        name: o.municipality?.name || 'N/A',
        total: 0,
        max: 0,
        count: 0,
      };
      existing.total += Number(o.precipitationMm) || 0;
      existing.max = Math.max(existing.max, Number(o.precipitationMm) || 0);
      existing.count += 1;
      byMunicipality.set(key, existing);
    });

    // Group by day
    const byDay = new Map<string, { total: number; max: number; count: number }>();
    observations.forEach((o) => {
      const day = format(o.observationTime, 'yyyy-MM-dd');
      const existing = byDay.get(day) || { total: 0, max: 0, count: 0 };
      existing.total += Number(o.precipitationMm) || 0;
      existing.max = Math.max(existing.max, Number(o.precipitationMm) || 0);
      existing.count += 1;
      byDay.set(day, existing);
    });

    const summary = {
      totalMm: totalPrecip,
      averageMm: avgPrecip,
      maxMm: maxPrecip,
      observations: observations.length,
      period: {
        startDate: start.toISOString(),
        endDate: end.toISOString(),
      },
    };

    switch (outputFormat) {
      case 'csv':
        return generatePrecipitationCsv(observations, summary, reply);
      case 'pdf':
        return generatePrecipitationPdf(
          Array.from(byMunicipality.entries()).map(([id, data]) => ({ id, ...data })),
          Array.from(byDay.entries()).map(([date, data]) => ({ date, ...data })),
          summary,
          start,
          end,
          reply
        );
      default:
        return {
          data: {
            summary,
            byMunicipality: Array.from(byMunicipality.entries()).map(([id, data]) => ({
              municipalityId: id,
              ...data,
            })),
            byDay: Array.from(byDay.entries())
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([date, data]) => ({ date, ...data })),
          },
        };
    }
  });

  // GET /reports/municipality - Municipality summary report
  app.get('/municipality/:municipalityId', async (
    request: FastifyRequest<{
      Params: { municipalityId: string };
      Querystring: ReportQuery;
    }>,
    reply: FastifyReply
  ) => {
    const { municipalityId } = request.params;
    const { startDate, endDate, format: outputFormat = 'json' } = request.query;

    const start = new Date(startDate);
    const end = new Date(endDate);

    // Fetch municipality info
    const municipality = await prisma.municipality.findUnique({
      where: { id: municipalityId },
      include: {
        consortium: { select: { name: true } },
      },
    });

    if (!municipality) {
      return reply.status(404).send({ error: 'Municipality not found' });
    }

    // Fetch alerts for this municipality
    const alerts = await prisma.alert.findMany({
      where: {
        municipalityId,
        startedAt: { gte: start, lte: end },
      },
      orderBy: { startedAt: 'desc' },
    });

    // Fetch precipitation for this municipality
    const precipitationStats = await prisma.precipitationObservation.aggregate({
      where: {
        municipalityId,
        observationTime: { gte: start, lte: end },
      },
      _sum: { precipitationMm: true },
      _avg: { precipitationMm: true },
      _max: { precipitationMm: true },
      _count: { id: true },
    });

    // Response times
    const acknowledgedAlerts = alerts.filter((a) => a.acknowledgedAt);
    const avgResponseTime = acknowledgedAlerts.length > 0
      ? acknowledgedAlerts.reduce((sum, a) => {
          const responseMs = new Date(a.acknowledgedAt!).getTime() - new Date(a.startedAt).getTime();
          return sum + responseMs / 60000; // Convert to minutes
        }, 0) / acknowledgedAlerts.length
      : 0;

    const report = {
      municipality: {
        id: municipality.id,
        name: municipality.name,
        ibgeCode: municipality.ibgeCode,
        stateCode: municipality.stateCode,
        population: municipality.population,
        consortiumName: municipality.consortium?.name || 'N/A',
      },
      period: {
        startDate: start.toISOString(),
        endDate: end.toISOString(),
      },
      alerts: {
        total: alerts.length,
        bySeverity: {
          observation: alerts.filter((a) => a.severity === 'observation').length,
          attention: alerts.filter((a) => a.severity === 'attention').length,
          alert: alerts.filter((a) => a.severity === 'alert').length,
          max_alert: alerts.filter((a) => a.severity === 'max_alert').length,
        },
        avgResponseTimeMinutes: avgResponseTime,
      },
      precipitation: {
        totalMm: Number(precipitationStats._sum.precipitationMm) || 0,
        averageMm: Number(precipitationStats._avg.precipitationMm) || 0,
        maxMm: Number(precipitationStats._max.precipitationMm) || 0,
        observations: precipitationStats._count.id,
      },
      recentAlerts: alerts.slice(0, 10).map((a) => ({
        id: a.id,
        severity: a.severity,
        title: a.title,
        startedAt: a.startedAt,
        status: a.status,
      })),
    };

    switch (outputFormat) {
      case 'csv':
        return generateMunicipalityCsv(report, reply);
      case 'pdf':
        return generateMunicipalityPdf(report, reply);
      default:
        return { data: report };
    }
  });

  // GET /reports/executive-summary - Executive summary report
  app.get('/executive-summary', async (
    request: FastifyRequest<{ Querystring: ReportQuery }>,
    reply: FastifyReply
  ) => {
    const { startDate, endDate, consortiumId, format: outputFormat = 'json' } = request.query;

    const start = new Date(startDate);
    const end = new Date(endDate);

    // Get overall statistics
    const [
      alertStats,
      precipStats,
      municipalityCount,
      topMunicipalitiesByAlerts,
      topMunicipalitiesByPrecip,
    ] = await Promise.all([
      // Alert statistics
      prisma.alert.groupBy({
        by: ['severity'],
        where: {
          startedAt: { gte: start, lte: end },
          ...(consortiumId ? { consortiumId } : {}),
        },
        _count: { id: true },
      }),

      // Precipitation statistics
      prisma.precipitationObservation.aggregate({
        where: {
          observationTime: { gte: start, lte: end },
        },
        _sum: { precipitationMm: true },
        _avg: { precipitationMm: true },
        _max: { precipitationMm: true },
      }),

      // Municipality count
      prisma.municipality.count({
        where: consortiumId ? { consortiumId } : {},
      }),

      // Top municipalities by alerts
      prisma.alert.groupBy({
        by: ['municipalityId'],
        where: {
          startedAt: { gte: start, lte: end },
          municipalityId: { not: null },
          ...(consortiumId ? { consortiumId } : {}),
        },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 5,
      }),

      // Top municipalities by precipitation
      prisma.precipitationObservation.groupBy({
        by: ['municipalityId'],
        where: {
          observationTime: { gte: start, lte: end },
          municipalityId: { not: null },
        },
        _sum: { precipitationMm: true },
        orderBy: { _sum: { precipitationMm: 'desc' } },
        take: 5,
      }),
    ]);

    // Get municipality names
    const allMunicipalityIds = [
      ...topMunicipalitiesByAlerts.map((m) => m.municipalityId),
      ...topMunicipalitiesByPrecip.map((m) => m.municipalityId),
    ].filter((id): id is string => id !== null);

    const municipalities = await prisma.municipality.findMany({
      where: { id: { in: allMunicipalityIds } },
      select: { id: true, name: true },
    });

    const municipalityMap = new Map(municipalities.map((m) => [m.id, m.name]));

    // Build severity counts
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

    const report = {
      period: {
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        days: Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)),
      },
      coverage: {
        municipalities: municipalityCount,
      },
      alerts: {
        total: totalAlerts,
        bySeverity: alertsBySeverity,
        dailyAverage: totalAlerts / Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))),
      },
      precipitation: {
        totalMm: Number(precipStats._sum.precipitationMm) || 0,
        averageMm: Number(precipStats._avg.precipitationMm) || 0,
        maxMm: Number(precipStats._max.precipitationMm) || 0,
      },
      topMunicipalitiesByAlerts: topMunicipalitiesByAlerts.map((m) => ({
        municipalityId: m.municipalityId,
        name: municipalityMap.get(m.municipalityId!) || 'N/A',
        alertCount: m._count.id,
      })),
      topMunicipalitiesByPrecipitation: topMunicipalitiesByPrecip.map((m) => ({
        municipalityId: m.municipalityId,
        name: municipalityMap.get(m.municipalityId!) || 'N/A',
        totalMm: Number(m._sum.precipitationMm) || 0,
      })),
    };

    switch (outputFormat) {
      case 'pdf':
        return generateExecutiveSummaryPdf(report, reply);
      default:
        return { data: report };
    }
  });
}

// CSV Generation Functions
function generateAlertsCsv(
  alerts: Array<{
    id: string;
    severity: string;
    type: string;
    title: string;
    description: string | null;
    status: string;
    startedAt: Date;
    acknowledgedAt: Date | null;
    endedAt: Date | null;
    triggerValue: number | null;
    municipality: { name: string; ibgeCode: string } | null;
  }>,
  summary: Record<string, unknown>,
  reply: FastifyReply
) {
  const headers = [
    'ID',
    'Severidade',
    'Tipo',
    'Título',
    'Município',
    'Código IBGE',
    'Status',
    'Início',
    'Reconhecimento',
    'Fim',
    'Valor Gatilho',
  ];

  const rows = alerts.map((a) => [
    a.id,
    SEVERITY_LABELS[a.severity] || a.severity,
    a.type,
    `"${a.title.replace(/"/g, '""')}"`,
    a.municipality?.name || 'N/A',
    a.municipality?.ibgeCode || 'N/A',
    a.status,
    format(a.startedAt, 'dd/MM/yyyy HH:mm', { locale: ptBR }),
    a.acknowledgedAt ? format(a.acknowledgedAt, 'dd/MM/yyyy HH:mm', { locale: ptBR }) : '',
    a.endedAt ? format(a.endedAt, 'dd/MM/yyyy HH:mm', { locale: ptBR }) : '',
    a.triggerValue?.toFixed(2) || '',
  ]);

  const csv = [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n');

  reply
    .header('Content-Type', 'text/csv; charset=utf-8')
    .header('Content-Disposition', `attachment; filename="alertas_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv"`)
    .send('\ufeff' + csv); // BOM for Excel UTF-8 compatibility
}

function generatePrecipitationCsv(
  observations: Array<{
    id: string;
    precipitationMm: unknown;
    observationTime: Date;
    source: string | null;
    municipality: { name: string; ibgeCode: string } | null;
  }>,
  summary: Record<string, unknown>,
  reply: FastifyReply
) {
  const headers = ['ID', 'Município', 'Código IBGE', 'Data/Hora', 'Precipitação (mm)', 'Fonte'];

  const rows = observations.map((o) => [
    o.id,
    o.municipality?.name || 'N/A',
    o.municipality?.ibgeCode || 'N/A',
    format(o.observationTime, 'dd/MM/yyyy HH:mm', { locale: ptBR }),
    (Number(o.precipitationMm) || 0).toFixed(2),
    o.source || 'N/A',
  ]);

  const csv = [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n');

  reply
    .header('Content-Type', 'text/csv; charset=utf-8')
    .header('Content-Disposition', `attachment; filename="precipitacao_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv"`)
    .send('\ufeff' + csv);
}

function generateMunicipalityCsv(report: Record<string, unknown>, reply: FastifyReply) {
  const municipality = report.municipality as Record<string, unknown>;
  const alerts = report.alerts as Record<string, unknown>;
  const precipitation = report.precipitation as Record<string, unknown>;

  const lines = [
    'RELATÓRIO DO MUNICÍPIO',
    '',
    `Município;${municipality.name}`,
    `Código IBGE;${municipality.ibgeCode}`,
    `Estado;${municipality.stateCode}`,
    `População;${municipality.population}`,
    `Consórcio;${municipality.consortiumName}`,
    '',
    'ALERTAS',
    `Total;${alerts.total}`,
    `Observação;${(alerts.bySeverity as Record<string, number>).observation}`,
    `Atenção;${(alerts.bySeverity as Record<string, number>).attention}`,
    `Alerta;${(alerts.bySeverity as Record<string, number>).alert}`,
    `Alerta Máximo;${(alerts.bySeverity as Record<string, number>).max_alert}`,
    `Tempo Médio de Resposta (min);${(alerts.avgResponseTimeMinutes as number).toFixed(1)}`,
    '',
    'PRECIPITAÇÃO',
    `Total (mm);${(precipitation.totalMm as number).toFixed(2)}`,
    `Média (mm);${(precipitation.averageMm as number).toFixed(2)}`,
    `Máxima (mm);${(precipitation.maxMm as number).toFixed(2)}`,
    `Observações;${precipitation.observations}`,
  ];

  const csv = lines.join('\n');

  reply
    .header('Content-Type', 'text/csv; charset=utf-8')
    .header('Content-Disposition', `attachment; filename="municipio_${municipality.ibgeCode}_${format(new Date(), 'yyyyMMdd')}.csv"`)
    .send('\ufeff' + csv);
}

// PDF Generation Functions
async function generateAlertsPdf(
  alerts: Array<{
    id: string;
    severity: string;
    type: string;
    title: string;
    status: string;
    startedAt: Date;
    municipality: { name: string } | null;
  }>,
  summary: Record<string, unknown>,
  startDate: Date,
  endDate: Date,
  reply: FastifyReply
) {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  const chunks: Buffer[] = [];

  doc.on('data', (chunk: Buffer) => chunks.push(chunk));

  // Header
  doc
    .fontSize(20)
    .fillColor('#0B1120')
    .text('Relatório de Alertas', { align: 'center' });

  doc.moveDown();
  doc
    .fontSize(10)
    .fillColor('#666')
    .text(
      `Período: ${format(startDate, 'dd/MM/yyyy', { locale: ptBR })} a ${format(endDate, 'dd/MM/yyyy', { locale: ptBR })}`,
      { align: 'center' }
    );

  doc.moveDown(2);

  // Summary
  doc.fontSize(14).fillColor('#0B1120').text('Resumo');
  doc.moveDown(0.5);

  const bySeverity = summary.bySeverity as Record<string, number>;
  doc
    .fontSize(10)
    .fillColor('#333')
    .text(`Total de Alertas: ${summary.total}`)
    .text(`Alerta Máximo: ${bySeverity.max_alert}`)
    .text(`Alerta: ${bySeverity.alert}`)
    .text(`Atenção: ${bySeverity.attention}`)
    .text(`Observação: ${bySeverity.observation}`);

  doc.moveDown(2);

  // Alerts table
  doc.fontSize(14).fillColor('#0B1120').text('Lista de Alertas');
  doc.moveDown(0.5);

  // Table header
  const tableTop = doc.y;
  const tableLeft = 50;
  const colWidths = [80, 100, 150, 80, 80];

  doc.fontSize(9).fillColor('#666');
  doc.text('Data', tableLeft, tableTop);
  doc.text('Severidade', tableLeft + colWidths[0], tableTop);
  doc.text('Título', tableLeft + colWidths[0] + colWidths[1], tableTop);
  doc.text('Município', tableLeft + colWidths[0] + colWidths[1] + colWidths[2], tableTop);

  doc.moveDown(0.5);
  doc.strokeColor('#ddd').moveTo(tableLeft, doc.y).lineTo(550, doc.y).stroke();
  doc.moveDown(0.3);

  // Table rows
  doc.fillColor('#333');
  alerts.slice(0, 30).forEach((alert) => {
    const y = doc.y;
    doc.text(format(alert.startedAt, 'dd/MM HH:mm', { locale: ptBR }), tableLeft, y, { width: colWidths[0] - 5 });
    doc.text(SEVERITY_LABELS[alert.severity] || alert.severity, tableLeft + colWidths[0], y, { width: colWidths[1] - 5 });
    doc.text(alert.title.substring(0, 30), tableLeft + colWidths[0] + colWidths[1], y, { width: colWidths[2] - 5 });
    doc.text(alert.municipality?.name?.substring(0, 15) || 'N/A', tableLeft + colWidths[0] + colWidths[1] + colWidths[2], y, { width: colWidths[3] - 5 });
    doc.moveDown(0.8);

    if (doc.y > 750) {
      doc.addPage();
    }
  });

  if (alerts.length > 30) {
    doc.moveDown();
    doc.fontSize(9).fillColor('#666').text(`... e mais ${alerts.length - 30} alertas`);
  }

  // Footer
  doc
    .fontSize(8)
    .fillColor('#999')
    .text(
      `Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })} - Sistema Radar Defesa Civil`,
      50,
      doc.page.height - 50,
      { align: 'center' }
    );

  doc.end();

  return new Promise<void>((resolve) => {
    doc.on('end', () => {
      const pdfBuffer = Buffer.concat(chunks);
      reply
        .header('Content-Type', 'application/pdf')
        .header('Content-Disposition', `attachment; filename="alertas_${format(new Date(), 'yyyyMMdd_HHmmss')}.pdf"`)
        .send(pdfBuffer);
      resolve();
    });
  });
}

async function generatePrecipitationPdf(
  byMunicipality: Array<{ id: string; name: string; total: number; max: number; count: number }>,
  byDay: Array<{ date: string; total: number; max: number; count: number }>,
  summary: Record<string, unknown>,
  startDate: Date,
  endDate: Date,
  reply: FastifyReply
) {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  const chunks: Buffer[] = [];

  doc.on('data', (chunk: Buffer) => chunks.push(chunk));

  // Header
  doc
    .fontSize(20)
    .fillColor('#0B1120')
    .text('Relatório de Precipitação', { align: 'center' });

  doc.moveDown();
  doc
    .fontSize(10)
    .fillColor('#666')
    .text(
      `Período: ${format(startDate, 'dd/MM/yyyy', { locale: ptBR })} a ${format(endDate, 'dd/MM/yyyy', { locale: ptBR })}`,
      { align: 'center' }
    );

  doc.moveDown(2);

  // Summary
  doc.fontSize(14).fillColor('#0B1120').text('Resumo Geral');
  doc.moveDown(0.5);

  doc
    .fontSize(10)
    .fillColor('#333')
    .text(`Total Acumulado: ${(summary.totalMm as number).toFixed(2)} mm`)
    .text(`Média: ${(summary.averageMm as number).toFixed(2)} mm`)
    .text(`Máxima: ${(summary.maxMm as number).toFixed(2)} mm`)
    .text(`Total de Observações: ${summary.observations}`);

  doc.moveDown(2);

  // By Municipality
  doc.fontSize(14).fillColor('#0B1120').text('Por Município');
  doc.moveDown(0.5);

  byMunicipality.slice(0, 15).forEach((m) => {
    doc
      .fontSize(10)
      .fillColor('#333')
      .text(`${m.name}: ${m.total.toFixed(2)} mm (máx: ${m.max.toFixed(2)} mm)`);
  });

  doc.moveDown(2);

  // By Day
  doc.fontSize(14).fillColor('#0B1120').text('Por Dia');
  doc.moveDown(0.5);

  byDay.slice(0, 15).forEach((d) => {
    doc
      .fontSize(10)
      .fillColor('#333')
      .text(`${format(new Date(d.date), 'dd/MM/yyyy', { locale: ptBR })}: ${d.total.toFixed(2)} mm`);
  });

  // Footer
  doc
    .fontSize(8)
    .fillColor('#999')
    .text(
      `Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })} - Sistema Radar Defesa Civil`,
      50,
      doc.page.height - 50,
      { align: 'center' }
    );

  doc.end();

  return new Promise<void>((resolve) => {
    doc.on('end', () => {
      const pdfBuffer = Buffer.concat(chunks);
      reply
        .header('Content-Type', 'application/pdf')
        .header('Content-Disposition', `attachment; filename="precipitacao_${format(new Date(), 'yyyyMMdd_HHmmss')}.pdf"`)
        .send(pdfBuffer);
      resolve();
    });
  });
}

async function generateMunicipalityPdf(report: Record<string, unknown>, reply: FastifyReply) {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  const chunks: Buffer[] = [];

  doc.on('data', (chunk: Buffer) => chunks.push(chunk));

  const municipality = report.municipality as Record<string, unknown>;
  const alerts = report.alerts as Record<string, unknown>;
  const precipitation = report.precipitation as Record<string, unknown>;
  const period = report.period as Record<string, string>;

  // Header
  doc
    .fontSize(20)
    .fillColor('#0B1120')
    .text(`Relatório: ${municipality.name}`, { align: 'center' });

  doc.moveDown();
  doc
    .fontSize(10)
    .fillColor('#666')
    .text(
      `Período: ${format(new Date(period.startDate), 'dd/MM/yyyy', { locale: ptBR })} a ${format(new Date(period.endDate), 'dd/MM/yyyy', { locale: ptBR })}`,
      { align: 'center' }
    );

  doc.moveDown(2);

  // Municipality Info
  doc.fontSize(14).fillColor('#0B1120').text('Informações do Município');
  doc.moveDown(0.5);

  doc
    .fontSize(10)
    .fillColor('#333')
    .text(`Código IBGE: ${municipality.ibgeCode}`)
    .text(`Estado: ${municipality.stateCode}`)
    .text(`População: ${(municipality.population as number)?.toLocaleString('pt-BR') || 'N/A'}`)
    .text(`Consórcio: ${municipality.consortiumName}`);

  doc.moveDown(2);

  // Alerts Summary
  doc.fontSize(14).fillColor('#0B1120').text('Alertas');
  doc.moveDown(0.5);

  const bySeverity = alerts.bySeverity as Record<string, number>;
  doc
    .fontSize(10)
    .fillColor('#333')
    .text(`Total: ${alerts.total}`)
    .text(`Alerta Máximo: ${bySeverity.max_alert}`)
    .text(`Alerta: ${bySeverity.alert}`)
    .text(`Atenção: ${bySeverity.attention}`)
    .text(`Observação: ${bySeverity.observation}`)
    .text(`Tempo Médio de Resposta: ${(alerts.avgResponseTimeMinutes as number).toFixed(1)} minutos`);

  doc.moveDown(2);

  // Precipitation Summary
  doc.fontSize(14).fillColor('#0B1120').text('Precipitação');
  doc.moveDown(0.5);

  doc
    .fontSize(10)
    .fillColor('#333')
    .text(`Total Acumulado: ${(precipitation.totalMm as number).toFixed(2)} mm`)
    .text(`Média: ${(precipitation.averageMm as number).toFixed(2)} mm`)
    .text(`Máxima: ${(precipitation.maxMm as number).toFixed(2)} mm`)
    .text(`Total de Observações: ${precipitation.observations}`);

  // Footer
  doc
    .fontSize(8)
    .fillColor('#999')
    .text(
      `Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })} - Sistema Radar Defesa Civil`,
      50,
      doc.page.height - 50,
      { align: 'center' }
    );

  doc.end();

  return new Promise<void>((resolve) => {
    doc.on('end', () => {
      const pdfBuffer = Buffer.concat(chunks);
      reply
        .header('Content-Type', 'application/pdf')
        .header('Content-Disposition', `attachment; filename="municipio_${municipality.ibgeCode}_${format(new Date(), 'yyyyMMdd')}.pdf"`)
        .send(pdfBuffer);
      resolve();
    });
  });
}

async function generateExecutiveSummaryPdf(report: Record<string, unknown>, reply: FastifyReply) {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  const chunks: Buffer[] = [];

  doc.on('data', (chunk: Buffer) => chunks.push(chunk));

  const period = report.period as Record<string, unknown>;
  const alerts = report.alerts as Record<string, unknown>;
  const precipitation = report.precipitation as Record<string, unknown>;

  // Header
  doc
    .fontSize(24)
    .fillColor('#0B1120')
    .text('Sumário Executivo', { align: 'center' });

  doc.moveDown();
  doc
    .fontSize(12)
    .fillColor('#666')
    .text('Sistema de Monitoramento Meteorológico - Defesa Civil', { align: 'center' });

  doc.moveDown();
  doc
    .fontSize(10)
    .fillColor('#666')
    .text(
      `Período: ${format(new Date(period.startDate as string), 'dd/MM/yyyy', { locale: ptBR })} a ${format(new Date(period.endDate as string), 'dd/MM/yyyy', { locale: ptBR })} (${period.days} dias)`,
      { align: 'center' }
    );

  doc.moveDown(3);

  // Key Metrics
  doc.fontSize(16).fillColor('#0B1120').text('Indicadores Principais');
  doc.moveDown();

  const bySeverity = alerts.bySeverity as Record<string, number>;

  // Create metric boxes
  doc.fontSize(12).fillColor('#333');
  doc.text(`Total de Alertas: ${alerts.total}`, 50, doc.y);
  doc.text(`Média Diária: ${(alerts.dailyAverage as number).toFixed(1)}`, 300, doc.y - 14);
  doc.moveDown();

  doc.text(`Alertas Máximo: ${bySeverity.max_alert}`, 50, doc.y);
  doc.text(`Alertas: ${bySeverity.alert}`, 200, doc.y - 14);
  doc.text(`Atenção: ${bySeverity.attention}`, 350, doc.y - 14);
  doc.moveDown(2);

  doc.text(`Precipitação Total: ${(precipitation.totalMm as number).toFixed(2)} mm`);
  doc.text(`Precipitação Máxima: ${(precipitation.maxMm as number).toFixed(2)} mm`);

  doc.moveDown(3);

  // Top municipalities by alerts
  doc.fontSize(16).fillColor('#0B1120').text('Municípios com Mais Alertas');
  doc.moveDown();

  const topByAlerts = report.topMunicipalitiesByAlerts as Array<{ name: string; alertCount: number }>;
  topByAlerts.forEach((m, i) => {
    doc.fontSize(10).fillColor('#333').text(`${i + 1}. ${m.name}: ${m.alertCount} alertas`);
  });

  doc.moveDown(2);

  // Top municipalities by precipitation
  doc.fontSize(16).fillColor('#0B1120').text('Municípios com Maior Precipitação');
  doc.moveDown();

  const topByPrecip = report.topMunicipalitiesByPrecipitation as Array<{ name: string; totalMm: number }>;
  topByPrecip.forEach((m, i) => {
    doc.fontSize(10).fillColor('#333').text(`${i + 1}. ${m.name}: ${m.totalMm.toFixed(2)} mm`);
  });

  // Footer
  doc
    .fontSize(8)
    .fillColor('#999')
    .text(
      `Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })} - Sistema Radar Defesa Civil`,
      50,
      doc.page.height - 50,
      { align: 'center' }
    );

  doc.end();

  return new Promise<void>((resolve) => {
    doc.on('end', () => {
      const pdfBuffer = Buffer.concat(chunks);
      reply
        .header('Content-Type', 'application/pdf')
        .header('Content-Disposition', `attachment; filename="sumario_executivo_${format(new Date(), 'yyyyMMdd')}.pdf"`)
        .send(pdfBuffer);
      resolve();
    });
  });
}
