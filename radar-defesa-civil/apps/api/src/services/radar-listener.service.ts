// Radar Listener Service
// Subscribes to Redis channels from radar processor and triggers alert evaluation

import { redis } from '../config/redis.js';
import { prisma } from '../config/database.js';
import { scheduleMunicipalityEvaluation } from '../jobs/rule-evaluation.job.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('radar-listener');

interface PrecipitationUpdate {
  municipality_id: string;
  observation_time: string;
  source: string;
  source_id: string;
  precipitation_mm: number;
  reflectivity_dbz?: number;
  confidence?: number;
}

interface AlertEvaluateTrigger {
  municipality_id: string;
  trigger: string;
  timestamp: string;
  cell_track_id?: string;
}

interface BatchEvaluateTrigger {
  municipality_ids: string[];
  trigger: string;
  timestamp: string;
  radar_id: string;
}

interface CellApproachAlert {
  municipality_id: string;
  cell_track_id: string;
  estimated_arrival_minutes: number;
  cell_severity: string;
  max_reflectivity_dbz: number;
  velocity_ms: number;
  direction_deg: number;
}

class RadarListenerService {
  private subscriber: typeof redis | null = null;
  private isRunning = false;

  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Radar listener already running');
      return;
    }

    this.subscriber = redis.duplicate();

    // Subscribe to radar processor channels
    await this.subscriber.subscribe(
      'precipitation:update',
      'alert:evaluate',
      'alert:evaluate:batch',
      'cell:approach'
    );

    this.subscriber.on('message', (channel, message) => {
      this.handleMessage(channel, message);
    });

    this.isRunning = true;
    logger.info('Radar listener service started');
  }

  private async handleMessage(channel: string, message: string): Promise<void> {
    try {
      const data = JSON.parse(message);

      switch (channel) {
        case 'precipitation:update':
          await this.handlePrecipitationUpdate(data as PrecipitationUpdate);
          break;

        case 'alert:evaluate':
          await this.handleEvaluateTrigger(data as AlertEvaluateTrigger);
          break;

        case 'alert:evaluate:batch':
          await this.handleBatchEvaluate(data as BatchEvaluateTrigger);
          break;

        case 'cell:approach':
          await this.handleCellApproach(data as CellApproachAlert);
          break;

        default:
          logger.debug({ channel }, 'Unknown channel');
      }
    } catch (error) {
      logger.error({ channel, error }, 'Failed to handle radar message');
    }
  }

  private async handlePrecipitationUpdate(data: PrecipitationUpdate): Promise<void> {
    // Store precipitation observation in database
    try {
      await prisma.precipitationObservation.create({
        data: {
          municipalityId: data.municipality_id,
          observationTime: new Date(data.observation_time),
          source: data.source,
          sourceId: data.source_id,
          precipitationMm: data.precipitation_mm,
          reflectivityDbz: data.reflectivity_dbz,
          confidence: data.confidence,
        },
      });

      logger.debug(
        {
          municipalityId: data.municipality_id,
          precipitationMm: data.precipitation_mm,
        },
        'Stored precipitation observation'
      );
    } catch (error) {
      // Log but don't fail - duplicate or constraint errors are possible
      logger.debug({ error }, 'Failed to store precipitation observation');
    }
  }

  private async handleEvaluateTrigger(data: AlertEvaluateTrigger): Promise<void> {
    // Schedule rule evaluation for this municipality
    await scheduleMunicipalityEvaluation(data.municipality_id);

    logger.debug(
      {
        municipalityId: data.municipality_id,
        trigger: data.trigger,
      },
      'Scheduled rule evaluation'
    );
  }

  private async handleBatchEvaluate(data: BatchEvaluateTrigger): Promise<void> {
    // Schedule rule evaluation for all municipalities in batch
    const { municipality_ids } = data;

    // Batch schedule evaluations
    for (const municipalityId of municipality_ids) {
      await scheduleMunicipalityEvaluation(municipalityId);
    }

    logger.info(
      {
        count: municipality_ids.length,
        radarId: data.radar_id,
      },
      'Scheduled batch rule evaluations'
    );
  }

  private async handleCellApproach(data: CellApproachAlert): Promise<void> {
    // For severe cells, create immediate alert
    if (data.cell_severity === 'severe' || data.estimated_arrival_minutes <= 15) {
      try {
        // Check if alert already exists for this cell and municipality
        const existingAlert = await prisma.alert.findFirst({
          where: {
            municipalityId: data.municipality_id,
            type: 'cell_approach',
            status: { in: ['active', 'acknowledged'] },
            metadata: {
              path: ['cell_track_id'],
              equals: data.cell_track_id,
            },
          },
        });

        if (!existingAlert) {
          // Create cell approach alert
          const municipality = await prisma.municipality.findUnique({
            where: { id: data.municipality_id },
            select: { name: true, consortiumId: true },
          });

          await prisma.alert.create({
            data: {
              municipalityId: data.municipality_id,
              consortiumId: municipality?.consortiumId,
              severity: data.cell_severity === 'severe' ? 'max_alert' : 'alert',
              type: 'cell_approach',
              title: `Célula Convectiva se Aproximando - ${municipality?.name || 'N/A'}`,
              description: `Célula ${data.cell_severity} com ${data.max_reflectivity_dbz.toFixed(0)} dBZ se aproximando. Chegada estimada em ${data.estimated_arrival_minutes} minutos.`,
              triggerValue: data.max_reflectivity_dbz,
              thresholdValue: 50, // dBZ threshold for severe
              expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours
              metadata: {
                cell_track_id: data.cell_track_id,
                velocity_ms: data.velocity_ms,
                direction_deg: data.direction_deg,
                estimated_arrival_minutes: data.estimated_arrival_minutes,
              },
            },
          });

          logger.info(
            {
              municipalityId: data.municipality_id,
              cellTrackId: data.cell_track_id,
              arrivalMinutes: data.estimated_arrival_minutes,
            },
            'Created cell approach alert'
          );
        }
      } catch (error) {
        logger.error({ error, data }, 'Failed to create cell approach alert');
      }
    }

    // Always schedule rule evaluation for cell-related rules
    await scheduleMunicipalityEvaluation(data.municipality_id);
  }

  async stop(): Promise<void> {
    if (this.subscriber) {
      await this.subscriber.unsubscribe();
      await this.subscriber.quit();
      this.subscriber = null;
    }
    this.isRunning = false;
    logger.info('Radar listener service stopped');
  }
}

// Singleton instance
let service: RadarListenerService | null = null;

export function getRadarListenerService(): RadarListenerService {
  if (!service) {
    service = new RadarListenerService();
  }
  return service;
}

export async function startRadarListener(): Promise<void> {
  const listener = getRadarListenerService();
  await listener.start();
}

export async function stopRadarListener(): Promise<void> {
  if (service) {
    await service.stop();
    service = null;
  }
}
