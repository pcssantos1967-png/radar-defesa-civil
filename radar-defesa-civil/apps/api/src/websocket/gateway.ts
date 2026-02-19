import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import { redis } from '../config/redis.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('websocket');

interface ClientData {
  userId?: string;
  consortiumId?: string;
  subscriptions: Set<string>;
}

export class WebSocketGateway {
  private io: SocketIOServer;
  private clients: Map<string, ClientData> = new Map();

  constructor(server: HttpServer) {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: process.env.NODE_ENV === 'production'
          ? ['https://radar.defesacivil.gov.br']
          : '*',
        methods: ['GET', 'POST'],
      },
      path: '/api/v1/stream',
    });

    // Set reference for direct access
    ioServer = this.io;

    this.setupHandlers();
    this.setupRedisSubscription();
  }

  private setupHandlers() {
    this.io.on('connection', (socket: Socket) => {
      logger.info({ socketId: socket.id }, 'Client connected');

      this.clients.set(socket.id, {
        subscriptions: new Set(),
      });

      // Authentication
      socket.on('authenticate', async (token: string) => {
        try {
          // Verify JWT token (simplified - should use proper verification)
          const client = this.clients.get(socket.id);
          if (client) {
            // In production, decode and verify JWT
            client.userId = 'authenticated';
            socket.emit('authenticated', { success: true });
          }
        } catch (error) {
          socket.emit('error', { code: 'AUTH_FAILED', message: 'Authentication failed' });
        }
      });

      // Subscribe to radar updates
      socket.on('subscribe:radar', (radarId?: string) => {
        const channel = radarId ? `radar:${radarId}` : 'radar:all';
        const client = this.clients.get(socket.id);
        if (client) {
          client.subscriptions.add(channel);
          socket.join(channel);
          logger.debug({ socketId: socket.id, channel }, 'Subscribed to radar');
        }
      });

      // Subscribe to alerts
      socket.on('subscribe:alerts', (consortiumId?: string) => {
        const channel = consortiumId ? `alerts:${consortiumId}` : 'alerts:all';
        const client = this.clients.get(socket.id);
        if (client) {
          client.subscriptions.add(channel);
          socket.join(channel);
          logger.debug({ socketId: socket.id, channel }, 'Subscribed to alerts');
        }
      });

      // Subscribe to municipality
      socket.on('subscribe:municipality', (municipalityId: string) => {
        const channel = `municipality:${municipalityId}`;
        const client = this.clients.get(socket.id);
        if (client) {
          client.subscriptions.add(channel);
          socket.join(channel);
          logger.debug({ socketId: socket.id, channel }, 'Subscribed to municipality');
        }
      });

      // Subscribe to consortium (for consortium-wide alerts)
      socket.on('subscribe:consortium', (consortiumId: string) => {
        const channel = `consortium:${consortiumId}`;
        const client = this.clients.get(socket.id);
        if (client) {
          client.subscriptions.add(channel);
          socket.join(channel);
          logger.debug({ socketId: socket.id, channel }, 'Subscribed to consortium');
        }
      });

      // Subscribe to critical alerts only
      socket.on('subscribe:critical', () => {
        const channel = 'alerts:critical';
        const client = this.clients.get(socket.id);
        if (client) {
          client.subscriptions.add(channel);
          socket.join(channel);
          logger.debug({ socketId: socket.id, channel }, 'Subscribed to critical alerts');
        }
      });

      // Subscribe to specific severity levels
      socket.on('subscribe:severity', (severity: string) => {
        const validSeverities = ['observation', 'attention', 'alert', 'max_alert'];
        if (validSeverities.includes(severity)) {
          const channel = `severity:${severity}`;
          const client = this.clients.get(socket.id);
          if (client) {
            client.subscriptions.add(channel);
            socket.join(channel);
            logger.debug({ socketId: socket.id, channel }, 'Subscribed to severity');
          }
        }
      });

      // Unsubscribe
      socket.on('unsubscribe', (channel: string) => {
        const client = this.clients.get(socket.id);
        if (client) {
          client.subscriptions.delete(channel);
          socket.leave(channel);
          logger.debug({ socketId: socket.id, channel }, 'Unsubscribed');
        }
      });

      // Disconnect
      socket.on('disconnect', () => {
        this.clients.delete(socket.id);
        logger.info({ socketId: socket.id }, 'Client disconnected');
      });
    });
  }

  private async setupRedisSubscription() {
    const subscriber = redis.duplicate();

    await subscriber.subscribe(
      'radar:update',
      'radar:status',
      'alert:new',
      'alert:update',
      'alert:end',
      'precipitation:update',
      'nowcast:update',
      'lightning:strike'
    );

    subscriber.on('message', (channel, message) => {
      try {
        const data = JSON.parse(message);
        this.handleRedisMessage(channel, data);
      } catch (error) {
        logger.error({ channel, error }, 'Failed to parse Redis message');
      }
    });
  }

  private handleRedisMessage(channel: string, data: unknown) {
    switch (channel) {
      case 'radar:update':
        this.broadcastRadarUpdate(data);
        break;
      case 'radar:status':
        this.broadcastRadarStatus(data);
        break;
      case 'alert:new':
      case 'alert:update':
      case 'alert:end':
        this.broadcastAlert(channel, data);
        break;
      case 'precipitation:update':
        this.broadcastPrecipitation(data);
        break;
      case 'nowcast:update':
        this.broadcastNowcast(data);
        break;
      case 'lightning:strike':
        this.broadcastLightning(data);
        break;
    }
  }

  private broadcastRadarUpdate(data: unknown) {
    const radarData = data as { radarId?: string };
    if (radarData.radarId) {
      this.io.to(`radar:${radarData.radarId}`).emit('radar:update', data);
    }
    this.io.to('radar:all').emit('radar:update', data);
  }

  private broadcastRadarStatus(data: unknown) {
    this.io.to('radar:all').emit('radar:status', data);
  }

  private broadcastAlert(event: string, data: unknown) {
    const alertData = data as {
      consortiumId?: string;
      municipalityId?: string;
      severity?: string;
      alert?: { severity?: string; consortiumId?: string; municipalityId?: string };
    };

    // Extract alert details
    const severity = alertData.severity || alertData.alert?.severity;
    const consortiumId = alertData.consortiumId || alertData.alert?.consortiumId;
    const municipalityId = alertData.municipalityId || alertData.alert?.municipalityId;

    // Broadcast to consortium room
    if (consortiumId) {
      this.io.to(`alerts:${consortiumId}`).emit(event, data);
      this.io.to(`consortium:${consortiumId}`).emit(event, data);
    }

    // Broadcast to municipality room
    if (municipalityId) {
      this.io.to(`municipality:${municipalityId}`).emit(event, data);
    }

    // Broadcast to severity room
    if (severity) {
      this.io.to(`severity:${severity}`).emit(event, data);

      // Broadcast critical alerts to special room
      if (severity === 'max_alert' || severity === 'alert') {
        this.io.to('alerts:critical').emit(event, data);
      }
    }

    // Broadcast to all alerts room
    this.io.to('alerts:all').emit(event, data);
  }

  private broadcastPrecipitation(data: unknown) {
    const precipData = data as { municipalityId?: string };
    if (precipData.municipalityId) {
      this.io.to(`municipality:${precipData.municipalityId}`).emit('precipitation:update', data);
    }
  }

  private broadcastNowcast(data: unknown) {
    this.io.to('radar:all').emit('nowcast:update', data);
  }

  private broadcastLightning(data: unknown) {
    this.io.emit('lightning:strike', data);
  }

  // Public methods for emitting events from API
  public emitRadarUpdate(radarId: string, data: object) {
    redis.publish('radar:update', JSON.stringify({ radarId, ...data }));
  }

  public emitAlert(event: 'alert:new' | 'alert:update' | 'alert:end', data: object) {
    redis.publish(event, JSON.stringify(data));
  }

  public emitPrecipitation(municipalityId: string, data: object) {
    redis.publish('precipitation:update', JSON.stringify({ municipalityId, ...data }));
  }
}

let gateway: WebSocketGateway | null = null;
let ioServer: SocketIOServer | null = null;

export function initializeWebSocket(server: HttpServer): WebSocketGateway {
  gateway = new WebSocketGateway(server);
  return gateway;
}

export function getWebSocketGateway(): WebSocketGateway {
  if (!gateway) {
    throw new Error('WebSocket gateway not initialized');
  }
  return gateway;
}

// Get raw Socket.IO server for direct access
export function getWebSocketServer(): SocketIOServer | null {
  return ioServer;
}

// Set the Socket.IO server reference (called internally)
export function setWebSocketServer(io: SocketIOServer): void {
  ioServer = io;
}
