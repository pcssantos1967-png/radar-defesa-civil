import { FastifyInstance } from 'fastify';
import { prisma } from '../../config/database.js';
import { authenticate, authorize, Roles } from '../../middleware/auth.js';
import { NotFoundError, ForbiddenError } from '../../utils/errors.js';
import { z } from 'zod';
import { ruleEngine } from './rule-engine/index.js';
import { scheduleMunicipalityEvaluation } from '../../jobs/rule-evaluation.job.js';
import { getWebSocketServer } from '../../websocket/gateway.js';

const queryAlertsSchema = z.object({
  status: z.enum(['active', 'acknowledged', 'resolved', 'expired']).optional(),
  severity: z.enum(['observation', 'attention', 'alert', 'max_alert']).optional(),
  municipalityId: z.string().uuid().optional(),
  consortiumId: z.string().uuid().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

const createAlertRuleSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  type: z.string().min(1),
  conditions: z.object({
    threshold: z.number(),
    periodHours: z.number().optional(),
    severity: z.string(),
  }),
  actions: z.object({
    notify: z.boolean().default(true),
    channels: z.array(z.string()).optional(),
    escalate: z.boolean().optional(),
  }),
  municipalityId: z.string().uuid().optional(),
  cooldownMinutes: z.number().min(1).default(30),
  priority: z.number().min(1).max(10).default(5),
});

export async function alertsRoutes(app: FastifyInstance): Promise<void> {
  // List alerts
  app.get(
    '/',
    {
      preHandler: [authenticate],
      schema: {
        description: 'List alerts',
        tags: ['alerts'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const query = queryAlertsSchema.parse(request.query);
      const { page, limit, status, severity, municipalityId, consortiumId } = query;
      const skip = (page - 1) * limit;

      const where: {
        status?: string;
        severity?: string;
        municipalityId?: string;
        consortiumId?: string;
      } = {};

      if (status) where.status = status;
      if (severity) where.severity = severity;
      if (municipalityId) where.municipalityId = municipalityId;

      // Filter by consortium if user is not admin
      if (request.user!.role !== Roles.ADMIN) {
        if (request.user!.consortiumId) {
          where.consortiumId = request.user!.consortiumId;
        }
      } else if (consortiumId) {
        where.consortiumId = consortiumId;
      }

      const [alerts, total] = await Promise.all([
        prisma.alert.findMany({
          where,
          skip,
          take: limit,
          orderBy: [{ status: 'asc' }, { startedAt: 'desc' }],
          include: {
            municipality: {
              select: { id: true, name: true, ibgeCode: true },
            },
          },
        }),
        prisma.alert.count({ where }),
      ]);

      return {
        success: true,
        data: { alerts },
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    }
  );

  // Get active alerts
  app.get(
    '/active',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Get active alerts',
        tags: ['alerts'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const where: { status: string; consortiumId?: string } = { status: 'active' };

      if (request.user!.role !== Roles.ADMIN && request.user!.consortiumId) {
        where.consortiumId = request.user!.consortiumId;
      }

      const alerts = await prisma.alert.findMany({
        where,
        orderBy: [
          { severity: 'desc' },
          { startedAt: 'desc' },
        ],
        include: {
          municipality: {
            select: { id: true, name: true, ibgeCode: true },
          },
        },
      });

      // Group by severity
      const summary = {
        maxAlert: alerts.filter((a) => a.severity === 'max_alert').length,
        alert: alerts.filter((a) => a.severity === 'alert').length,
        attention: alerts.filter((a) => a.severity === 'attention').length,
        observation: alerts.filter((a) => a.severity === 'observation').length,
        total: alerts.length,
      };

      return { success: true, data: { alerts, summary } };
    }
  );

  // Get alert by ID
  app.get<{ Params: { id: string } }>(
    '/:id',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Get alert details',
        tags: ['alerts'],
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
      const alert = await prisma.alert.findUnique({
        where: { id: request.params.id },
        include: {
          municipality: true,
          consortium: true,
          rule: true,
        },
      });

      if (!alert) {
        throw new NotFoundError('Alert', request.params.id);
      }

      return { success: true, data: { alert } };
    }
  );

  // Acknowledge alert
  app.post<{ Params: { id: string } }>(
    '/:id/acknowledge',
    {
      preHandler: [authorize(Roles.ADMIN, Roles.MANAGER, Roles.OPERATOR)],
      schema: {
        description: 'Acknowledge alert with optional comment',
        tags: ['alerts'],
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
            comment: { type: 'string' },
            actionsTaken: { type: 'array', items: { type: 'string' } },
          },
        },
      },
    },
    async (request, reply) => {
      const alert = await prisma.alert.findUnique({
        where: { id: request.params.id },
        include: { municipality: { select: { id: true, name: true } } },
      });

      if (!alert) {
        throw new NotFoundError('Alert', request.params.id);
      }

      if (alert.status !== 'active') {
        throw new ForbiddenError('Alert is not active');
      }

      const { comment, actionsTaken } = (request.body || {}) as {
        comment?: string;
        actionsTaken?: string[];
      };

      // Get user info for audit
      const user = await prisma.user.findUnique({
        where: { id: request.user!.userId },
        select: { name: true },
      });

      const existingMetadata = alert.metadata as Record<string, unknown> || {};
      const timeline = (existingMetadata.timeline as unknown[]) || [];

      const updated = await prisma.alert.update({
        where: { id: request.params.id },
        data: {
          status: 'acknowledged',
          acknowledgedBy: request.user!.userId,
          acknowledgedAt: new Date(),
          metadata: {
            ...existingMetadata,
            acknowledgeComment: comment,
            actionsTaken,
            timeline: [
              ...timeline,
              {
                action: 'acknowledged',
                userId: request.user!.userId,
                userName: user?.name,
                timestamp: new Date().toISOString(),
                comment,
                actionsTaken,
              },
            ],
          },
        },
        include: { municipality: { select: { id: true, name: true } } },
      });

      // Log audit
      await prisma.auditLog.create({
        data: {
          userId: request.user!.userId,
          action: 'ACKNOWLEDGE_ALERT',
          entityType: 'alert',
          entityId: alert.id,
          newValues: { comment, actionsTaken },
        },
      });

      // Broadcast acknowledgment via WebSocket
      const wsServer = getWebSocketServer();
      if (wsServer) {
        wsServer.emit('alert:acknowledged', {
          alertId: alert.id,
          acknowledgedBy: user?.name,
          timestamp: new Date().toISOString(),
        });
      }

      return { success: true, data: { alert: updated } };
    }
  );

  // Resolve alert
  app.post<{ Params: { id: string } }>(
    '/:id/resolve',
    {
      preHandler: [authorize(Roles.ADMIN, Roles.MANAGER, Roles.OPERATOR)],
      schema: {
        description: 'Resolve alert with optional notes',
        tags: ['alerts'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          properties: {
            resolutionNotes: { type: 'string' },
            rootCause: { type: 'string' },
            preventiveMeasures: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const alert = await prisma.alert.findUnique({
        where: { id: request.params.id },
      });

      if (!alert) {
        throw new NotFoundError('Alert', request.params.id);
      }

      if (alert.status === 'resolved' || alert.status === 'expired') {
        throw new ForbiddenError('Alert is already resolved or expired');
      }

      const { resolutionNotes, rootCause, preventiveMeasures } = (request.body || {}) as {
        resolutionNotes?: string;
        rootCause?: string;
        preventiveMeasures?: string;
      };

      // Get user info
      const user = await prisma.user.findUnique({
        where: { id: request.user!.userId },
        select: { name: true },
      });

      const existingMetadata = alert.metadata as Record<string, unknown> || {};
      const timeline = (existingMetadata.timeline as unknown[]) || [];

      const updated = await prisma.alert.update({
        where: { id: request.params.id },
        data: {
          status: 'resolved',
          resolvedBy: request.user!.userId,
          resolvedAt: new Date(),
          endedAt: new Date(),
          metadata: {
            ...existingMetadata,
            resolutionNotes,
            rootCause,
            preventiveMeasures,
            timeline: [
              ...timeline,
              {
                action: 'resolved',
                userId: request.user!.userId,
                userName: user?.name,
                timestamp: new Date().toISOString(),
                resolutionNotes,
                rootCause,
                preventiveMeasures,
              },
            ],
          },
        },
      });

      // Log audit
      await prisma.auditLog.create({
        data: {
          userId: request.user!.userId,
          action: 'RESOLVE_ALERT',
          entityType: 'alert',
          entityId: alert.id,
          newValues: { resolutionNotes, rootCause, preventiveMeasures },
        },
      });

      // Broadcast resolution via WebSocket
      const wsServer = getWebSocketServer();
      if (wsServer) {
        wsServer.emit('alert:resolved', {
          alertId: alert.id,
          resolvedBy: user?.name,
          timestamp: new Date().toISOString(),
        });
      }

      return { success: true, data: { alert: updated } };
    }
  );

  // Add comment to alert
  app.post<{ Params: { id: string } }>(
    '/:id/comments',
    {
      preHandler: [authorize(Roles.ADMIN, Roles.MANAGER, Roles.OPERATOR)],
      schema: {
        description: 'Add comment to alert',
        tags: ['alerts'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['text'],
          properties: {
            text: { type: 'string' },
            type: { type: 'string', enum: ['comment', 'action', 'update'] },
          },
        },
      },
    },
    async (request, reply) => {
      const alert = await prisma.alert.findUnique({
        where: { id: request.params.id },
      });

      if (!alert) {
        throw new NotFoundError('Alert', request.params.id);
      }

      const { text, type = 'comment' } = request.body as {
        text: string;
        type?: string;
      };

      const user = await prisma.user.findUnique({
        where: { id: request.user!.userId },
        select: { name: true },
      });

      const existingMetadata = alert.metadata as Record<string, unknown> || {};
      const comments = (existingMetadata.comments as unknown[]) || [];

      const newComment = {
        id: Math.random().toString(36).substring(2, 9),
        userId: request.user!.userId,
        userName: user?.name,
        text,
        type,
        timestamp: new Date().toISOString(),
      };

      const updated = await prisma.alert.update({
        where: { id: request.params.id },
        data: {
          metadata: {
            ...existingMetadata,
            comments: [...comments, newComment],
          },
        },
      });

      return {
        success: true,
        data: { comment: newComment },
      };
    }
  );

  // Get alert timeline
  app.get<{ Params: { id: string } }>(
    '/:id/timeline',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Get alert timeline',
        tags: ['alerts'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const alert = await prisma.alert.findUnique({
        where: { id: request.params.id },
        select: {
          id: true,
          startedAt: true,
          acknowledgedAt: true,
          resolvedAt: true,
          endedAt: true,
          metadata: true,
        },
      });

      if (!alert) {
        throw new NotFoundError('Alert', request.params.id);
      }

      const metadata = alert.metadata as Record<string, unknown> || {};
      const timeline = (metadata.timeline as unknown[]) || [];
      const comments = (metadata.comments as unknown[]) || [];

      // Build combined timeline
      const events = [
        {
          type: 'created',
          timestamp: alert.startedAt.toISOString(),
          description: 'Alerta criado',
        },
        ...timeline.map((item: unknown) => {
          const event = item as { action: string; timestamp: string; userName?: string };
          return {
            type: event.action,
            timestamp: event.timestamp,
            user: event.userName,
            ...event,
          };
        }),
        ...comments.map((item: unknown) => {
          const comment = item as { timestamp: string; userName?: string; text: string };
          return {
            type: 'comment',
            timestamp: comment.timestamp,
            user: comment.userName,
            description: comment.text,
          };
        }),
      ].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      return {
        success: true,
        data: { events },
      };
    }
  );

  // List alert rules
  app.get(
    '/rules',
    {
      preHandler: [authorize(Roles.ADMIN, Roles.MANAGER)],
      schema: {
        description: 'List alert rules',
        tags: ['alerts'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const where: { consortiumId?: string } = {};

      if (request.user!.role !== Roles.ADMIN && request.user!.consortiumId) {
        where.consortiumId = request.user!.consortiumId;
      }

      const rules = await prisma.alertRule.findMany({
        where,
        orderBy: [{ priority: 'asc' }, { name: 'asc' }],
        include: {
          municipality: {
            select: { id: true, name: true },
          },
        },
      });

      return { success: true, data: { rules } };
    }
  );

  // Create alert rule
  app.post(
    '/rules',
    {
      preHandler: [authorize(Roles.ADMIN, Roles.MANAGER)],
      schema: {
        description: 'Create alert rule',
        tags: ['alerts'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const input = createAlertRuleSchema.parse(request.body);

      const consortiumId = request.user!.role === Roles.ADMIN
        ? (request.body as { consortiumId?: string }).consortiumId || request.user!.consortiumId
        : request.user!.consortiumId;

      const rule = await prisma.alertRule.create({
        data: {
          consortiumId,
          municipalityId: input.municipalityId,
          name: input.name,
          description: input.description,
          type: input.type,
          conditions: input.conditions,
          actions: input.actions,
          cooldownMinutes: input.cooldownMinutes,
          priority: input.priority,
          createdBy: request.user!.userId,
        },
      });

      return reply.status(201).send({ success: true, data: { rule } });
    }
  );

  // Update alert rule
  app.put<{ Params: { id: string } }>(
    '/rules/:id',
    {
      preHandler: [authorize(Roles.ADMIN, Roles.MANAGER)],
      schema: {
        description: 'Update alert rule',
        tags: ['alerts'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const rule = await prisma.alertRule.findUnique({
        where: { id: request.params.id },
      });

      if (!rule) {
        throw new NotFoundError('AlertRule', request.params.id);
      }

      const input = createAlertRuleSchema.partial().parse(request.body);

      const updated = await prisma.alertRule.update({
        where: { id: request.params.id },
        data: input,
      });

      return { success: true, data: { rule: updated } };
    }
  );

  // Delete alert rule
  app.delete<{ Params: { id: string } }>(
    '/rules/:id',
    {
      preHandler: [authorize(Roles.ADMIN, Roles.MANAGER)],
      schema: {
        description: 'Delete alert rule',
        tags: ['alerts'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const rule = await prisma.alertRule.findUnique({
        where: { id: request.params.id },
      });

      if (!rule) {
        throw new NotFoundError('AlertRule', request.params.id);
      }

      await prisma.alertRule.delete({
        where: { id: request.params.id },
      });

      return { success: true, message: 'Alert rule deleted' };
    }
  );

  // Test alert rule (dry run)
  app.post<{ Params: { id: string } }>(
    '/rules/:id/test',
    {
      preHandler: [authorize(Roles.ADMIN, Roles.MANAGER)],
      schema: {
        description: 'Test alert rule without creating alerts',
        tags: ['alerts'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          properties: {
            municipalityId: { type: 'string', format: 'uuid' },
          },
          required: ['municipalityId'],
        },
      },
    },
    async (request, reply) => {
      const rule = await prisma.alertRule.findUnique({
        where: { id: request.params.id },
      });

      if (!rule) {
        throw new NotFoundError('AlertRule', request.params.id);
      }

      const { municipalityId } = request.body as { municipalityId: string };

      // Get municipality
      const municipality = await prisma.municipality.findUnique({
        where: { id: municipalityId },
      });

      if (!municipality) {
        throw new NotFoundError('Municipality', municipalityId);
      }

      // Run evaluation
      const { results } = await ruleEngine.evaluateRulesForMunicipality(
        municipalityId,
        [rule.id]
      );

      const result = results[0];

      return {
        success: true,
        data: {
          rule: {
            id: rule.id,
            name: rule.name,
            type: rule.type,
          },
          municipality: {
            id: municipality.id,
            name: municipality.name,
          },
          evaluation: {
            triggered: result?.triggered || false,
            severity: result?.severity,
            triggerValue: result?.triggerValue,
            thresholdValue: result?.thresholdValue,
            message: result?.message,
            conditions: result?.conditionResults,
            evaluatedAt: result?.evaluatedAt,
          },
        },
      };
    }
  );

  // Trigger rule evaluation for municipality
  app.post(
    '/evaluate',
    {
      preHandler: [authorize(Roles.ADMIN, Roles.MANAGER)],
      schema: {
        description: 'Trigger rule evaluation for a municipality',
        tags: ['alerts'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          properties: {
            municipalityId: { type: 'string', format: 'uuid' },
            ruleIds: { type: 'array', items: { type: 'string', format: 'uuid' } },
          },
          required: ['municipalityId'],
        },
      },
    },
    async (request, reply) => {
      const { municipalityId, ruleIds } = request.body as {
        municipalityId: string;
        ruleIds?: string[];
      };

      // Verify municipality exists
      const municipality = await prisma.municipality.findUnique({
        where: { id: municipalityId },
      });

      if (!municipality) {
        throw new NotFoundError('Municipality', municipalityId);
      }

      // Schedule evaluation job
      await scheduleMunicipalityEvaluation(municipalityId, ruleIds);

      // Log audit
      await prisma.auditLog.create({
        data: {
          userId: request.user!.userId,
          action: 'TRIGGER_RULE_EVALUATION',
          entityType: 'municipality',
          entityId: municipalityId,
          newValues: { ruleIds },
        },
      });

      return {
        success: true,
        message: 'Rule evaluation scheduled',
        data: {
          municipalityId,
          ruleIds: ruleIds || 'all',
        },
      };
    }
  );

  // Toggle rule active status
  app.patch<{ Params: { id: string } }>(
    '/rules/:id/toggle',
    {
      preHandler: [authorize(Roles.ADMIN, Roles.MANAGER)],
      schema: {
        description: 'Toggle alert rule active status',
        tags: ['alerts'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const rule = await prisma.alertRule.findUnique({
        where: { id: request.params.id },
      });

      if (!rule) {
        throw new NotFoundError('AlertRule', request.params.id);
      }

      const updated = await prisma.alertRule.update({
        where: { id: request.params.id },
        data: { isActive: !rule.isActive },
      });

      return {
        success: true,
        data: { rule: updated },
      };
    }
  );

  // Get rule evaluation history
  app.get<{ Params: { id: string } }>(
    '/rules/:id/history',
    {
      preHandler: [authorize(Roles.ADMIN, Roles.MANAGER)],
      schema: {
        description: 'Get alerts generated by a rule',
        tags: ['alerts'],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          },
        },
      },
    },
    async (request, reply) => {
      const rule = await prisma.alertRule.findUnique({
        where: { id: request.params.id },
      });

      if (!rule) {
        throw new NotFoundError('AlertRule', request.params.id);
      }

      const { limit = 20 } = request.query as { limit?: number };

      const alerts = await prisma.alert.findMany({
        where: { ruleId: rule.id },
        orderBy: { startedAt: 'desc' },
        take: limit,
        include: {
          municipality: {
            select: { id: true, name: true },
          },
        },
      });

      const stats = await prisma.alert.groupBy({
        by: ['severity'],
        where: { ruleId: rule.id },
        _count: true,
      });

      return {
        success: true,
        data: {
          rule: {
            id: rule.id,
            name: rule.name,
          },
          alerts,
          stats: stats.reduce(
            (acc, s) => ({ ...acc, [s.severity]: s._count }),
            {}
          ),
        },
      };
    }
  );
}
