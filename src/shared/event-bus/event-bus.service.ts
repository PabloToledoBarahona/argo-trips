import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { randomUUID } from 'crypto';
import * as os from 'os';
import {
  BaseEvent,
  TripEvent,
  STREAM_NAMES,
  CONSUMER_GROUP,
} from './events.interface.js';

/**
 * EventBusService
 *
 * Manages event publishing and consumption via Redis Streams.
 * Uses a separate Redis instance (Event Bus) from the internal cache Redis.
 *
 * Features:
 * - Publish events to Redis Streams
 * - Consume events with consumer groups for reliable delivery
 * - Automatic acknowledgment after processing
 * - Dead letter handling for failed events
 *
 * Architecture:
 * - Each microservice publishes to its own stream (e.g., stream:trips)
 * - Each microservice consumes from streams it's interested in
 * - Consumer groups ensure each event is processed once per service
 */
@Injectable()
export class EventBusService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EventBusService.name);
  private client: Redis | null = null;
  private isConnected = false;
  private readonly SOURCE = 'ms04-trips';

  // Unique consumer name per instance (hostname-pid for horizontal scaling)
  private readonly consumerName = `trips-consumer-${os.hostname()}-${process.pid}`;

  // Event handlers registry
  private eventHandlers: Map<string, (event: BaseEvent) => Promise<void>> = new Map();

  // Consumer polling interval
  private consumerInterval: NodeJS.Timeout | null = null;
  private readonly POLL_INTERVAL_MS = 1000;
  private readonly PEL_CHECK_INTERVAL_MS = 30000; // Check pending messages every 30s
  private readonly PEL_IDLE_TIME_MS = 60000; // Claim messages idle for 60s
  private pelCheckInterval: NodeJS.Timeout | null = null;

  // Flag to track if handlers are ready
  private handlersReady = false;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const configuredEventBusUrl = this.configService.get<string>('REDIS_EVENT_BUS_URL');
    const fallbackRedisUrl = this.configService.get<string>('REDIS_URL');
    const eventBusUrl = configuredEventBusUrl || fallbackRedisUrl;

    if (!eventBusUrl) {
      this.logger.warn('REDIS_EVENT_BUS_URL not configured - Event Bus disabled');
      return;
    }

    if (!configuredEventBusUrl && fallbackRedisUrl) {
      this.logger.warn(
        'REDIS_EVENT_BUS_URL not set - using REDIS_URL for Event Bus (shared Redis)',
      );
    }

    try {
      this.client = new Redis(eventBusUrl, {
        maxRetriesPerRequest: 3,
        retryStrategy: (times: number) => {
          const delay = Math.min(times * 100, 3000);
          return delay;
        },
        lazyConnect: true,
      });

      // Register event listeners BEFORE connecting (fix for isConnected issue)
      this.client.on('connect', () => {
        this.isConnected = true;
        this.logger.log('Event Bus Redis connected');
      });

      this.client.on('ready', () => {
        this.isConnected = true;
        this.logger.log('Event Bus Redis ready');
      });

      this.client.on('error', (error) => {
        this.logger.error('Event Bus Redis error', error);
      });

      this.client.on('close', () => {
        this.isConnected = false;
        this.logger.warn('Event Bus Redis connection closed');
      });

      // Now connect
      await this.client.connect();

      // Set isConnected based on actual connection state
      this.isConnected = this.client.status === 'ready' || this.client.status === 'connect';

      // Create consumer groups for streams we want to consume
      await this.ensureConsumerGroups();

      // NOTE: Consumer is NOT started here - it will start when handlers are marked ready
      // This prevents events from being acked before handlers are registered
      this.logger.log(`Event Bus initialized (consumer: ${this.consumerName})`);
    } catch (error) {
      this.logger.error('Failed to initialize Event Bus', error);
      // Don't throw - allow service to run without Event Bus
    }
  }

  /**
   * Mark handlers as ready and start consumer
   * Should be called after all event handlers are registered
   */
  markHandlersReady(): void {
    if (this.handlersReady) return;

    this.handlersReady = true;
    this.logger.log('Event handlers marked as ready, starting consumer...');

    // Start consuming events only after handlers are ready
    this.startConsumer();

    // Start PEL recovery process
    this.startPelRecovery();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.consumerInterval) {
      clearInterval(this.consumerInterval);
    }

    if (this.pelCheckInterval) {
      clearInterval(this.pelCheckInterval);
    }

    if (this.client) {
      await this.client.quit();
      this.logger.log('Event Bus Redis connection closed');
    }
  }

  /**
   * Check if Event Bus is available
   */
  isAvailable(): boolean {
    return this.isConnected && this.client !== null;
  }

  /**
   * Publish an event to the trips stream
   */
  async publishTripEvent(event: Omit<TripEvent, 'id' | 'source' | 'timestamp'>): Promise<string | null> {
    return this.publish(STREAM_NAMES.TRIPS, {
      ...event,
      id: randomUUID(),
      source: this.SOURCE,
      timestamp: new Date().toISOString(),
    } as TripEvent);
  }

  /**
   * Register a handler for a specific event type
   */
  registerHandler(eventType: string, handler: (event: BaseEvent) => Promise<void>): void {
    this.eventHandlers.set(eventType, handler);
    this.logger.log(`Registered handler for event type: ${eventType}`);
  }

  /**
   * Publish an event to a stream
   */
  private async publish(streamName: string, event: BaseEvent): Promise<string | null> {
    if (!this.isAvailable()) {
      this.logger.warn(`Event Bus unavailable, cannot publish event: ${event.type}`);
      return null;
    }

    try {
      // XADD stream * field value field value ...
      const messageId = await this.client!.xadd(
        streamName,
        '*',
        'event', JSON.stringify(event),
      );

      this.logger.debug(`Published event ${event.type} to ${streamName}: ${messageId}`);
      return messageId;
    } catch (error) {
      this.logger.error(`Failed to publish event ${event.type}`, error);
      return null;
    }
  }

  /**
   * Ensure consumer groups exist for streams we want to consume
   */
  private async ensureConsumerGroups(): Promise<void> {
    if (!this.client) return;

    const streamsToConsume = [STREAM_NAMES.PAYMENTS, STREAM_NAMES.DRIVERS];

    for (const stream of streamsToConsume) {
      try {
        // Create stream if it doesn't exist by adding a dummy message
        // This is needed because XGROUP CREATE requires the stream to exist
        await this.client.xadd(stream, '*', 'init', 'true');

        // Create consumer group, starting from the end (only new messages)
        await this.client.xgroup('CREATE', stream, CONSUMER_GROUP, '$', 'MKSTREAM');
        this.logger.log(`Created consumer group ${CONSUMER_GROUP} for stream ${stream}`);
      } catch (error: any) {
        // BUSYGROUP means group already exists - that's fine
        if (error.message?.includes('BUSYGROUP')) {
          this.logger.debug(`Consumer group ${CONSUMER_GROUP} already exists for ${stream}`);
        } else {
          this.logger.warn(`Error creating consumer group for ${stream}: ${error.message}`);
        }
      }
    }
  }

  /**
   * Start the consumer loop
   */
  private startConsumer(): void {
    if (!this.client || !this.handlersReady) return;

    this.consumerInterval = setInterval(async () => {
      await this.consumeEvents();
    }, this.POLL_INTERVAL_MS);

    this.logger.log(`Event consumer started (${this.consumerName})`);
  }

  /**
   * Start PEL (Pending Entries List) recovery process
   * This claims and re-processes messages that were not acknowledged
   */
  private startPelRecovery(): void {
    if (!this.client || !this.handlersReady) return;

    this.pelCheckInterval = setInterval(async () => {
      await this.processPendingMessages();
    }, this.PEL_CHECK_INTERVAL_MS);

    this.logger.log('PEL recovery process started');
  }

  /**
   * Process pending messages (PEL) that were not acknowledged
   * Uses XAUTOCLAIM to claim and re-process idle messages
   */
  private async processPendingMessages(): Promise<void> {
    if (!this.isAvailable() || !this.handlersReady) return;

    const streamsToConsume = [STREAM_NAMES.PAYMENTS, STREAM_NAMES.DRIVERS];

    for (const stream of streamsToConsume) {
      try {
        // XAUTOCLAIM stream group consumer min-idle-time start [COUNT count]
        // Returns messages that have been idle for more than min-idle-time
        const result = await this.client!.call(
          'XAUTOCLAIM',
          stream,
          CONSUMER_GROUP,
          this.consumerName,
          this.PEL_IDLE_TIME_MS.toString(),
          '0-0', // Start from beginning of PEL
          'COUNT', '10',
        ) as [string, [string, string[]][], string[]];

        if (!result || !result[1] || result[1].length === 0) continue;

        const [_nextId, messages, _deletedIds] = result;

        for (const [messageId, fields] of messages) {
          this.logger.log(`Recovering pending message ${messageId} from ${stream}`);
          await this.processMessage(stream, messageId, fields);
        }
      } catch (error: any) {
        // Ignore NOGROUP errors (stream doesn't exist yet)
        if (!error.message?.includes('NOGROUP')) {
          this.logger.error(`Error processing PEL for ${stream}`, error);
        }
      }
    }
  }

  /**
   * Consume events from subscribed streams
   */
  private async consumeEvents(): Promise<void> {
    if (!this.isAvailable()) return;

    const streamsToConsume = [STREAM_NAMES.PAYMENTS, STREAM_NAMES.DRIVERS];

    for (const stream of streamsToConsume) {
      try {
        // XREADGROUP GROUP group consumer BLOCK ms COUNT n STREAMS stream >
        // Type: [[streamName, [[messageId, [field, value, ...]], ...]], ...]
        type StreamMessage = [string, string[]];
        type StreamResult = [string, StreamMessage[]];

        const results = await this.client!.xreadgroup(
          'GROUP', CONSUMER_GROUP, this.consumerName,
          'COUNT', '10',
          'BLOCK', '100',
          'STREAMS', stream, '>',
        ) as StreamResult[] | null;

        if (!results) continue;

        for (const [_streamName, messages] of results) {
          for (const [messageId, fields] of messages) {
            await this.processMessage(stream, messageId, fields);
          }
        }
      } catch (error: any) {
        // Ignore NOGROUP errors (stream doesn't exist yet)
        if (!error.message?.includes('NOGROUP')) {
          this.logger.error(`Error consuming from ${stream}`, error);
        }
      }
    }
  }

  /**
   * Process a single message from a stream
   */
  private async processMessage(stream: string, messageId: string, fields: string[]): Promise<void> {
    try {
      // Parse fields array to object
      const data: Record<string, string> = {};
      for (let i = 0; i < fields.length; i += 2) {
        data[fields[i]] = fields[i + 1];
      }

      // Skip init messages
      if (data.init) {
        await this.acknowledgeMessage(stream, messageId);
        return;
      }

      const eventJson = data.event;
      if (!eventJson) {
        this.logger.warn(`No event field in message ${messageId}`);
        await this.acknowledgeMessage(stream, messageId);
        return;
      }

      const event: BaseEvent = JSON.parse(eventJson);
      this.logger.debug(`Processing event ${event.type} from ${stream}: ${messageId}`);

      // Find and execute handler
      const handler = this.eventHandlers.get(event.type);
      if (handler) {
        await handler(event);
        this.logger.log(`Processed event ${event.type}: ${event.id}`);
      } else {
        this.logger.debug(`No handler registered for event type: ${event.type}`);
      }

      // Acknowledge the message
      await this.acknowledgeMessage(stream, messageId);
    } catch (error) {
      this.logger.error(`Failed to process message ${messageId} from ${stream}`, error);
      // Don't acknowledge - message will be redelivered
    }
  }

  /**
   * Acknowledge a message as processed
   */
  private async acknowledgeMessage(stream: string, messageId: string): Promise<void> {
    if (!this.client) return;

    try {
      await this.client.xack(stream, CONSUMER_GROUP, messageId);
    } catch (error) {
      this.logger.error(`Failed to acknowledge message ${messageId}`, error);
    }
  }
}
