import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EventBusService } from './event-bus.service.js';
import {
  BaseEvent,
  PaymentCapturedEvent,
  PaymentFailedEvent,
  DriverOfflineEvent,
} from './events.interface.js';
import { TripPrismaRepository } from '../../trips/infrastructure/persistence/prisma/trip-prisma.repository.js';
import { TripAuditPrismaRepository } from '../../trips/infrastructure/persistence/prisma/trip-audit-prisma.repository.js';
import { TripStatus } from '../../trips/domain/enums/trip-status.enum.js';

/**
 * TripEventsHandler
 *
 * Handles incoming events from the Event Bus that affect trips.
 * Registers handlers for:
 * - payment.captured: Mark trip as PAID
 * - payment.failed: Handle payment failure
 * - driver.offline: Handle driver going offline during active trip
 */
@Injectable()
export class TripEventsHandler implements OnModuleInit {
  private readonly logger = new Logger(TripEventsHandler.name);

  constructor(
    private readonly eventBus: EventBusService,
    private readonly tripRepository: TripPrismaRepository,
    private readonly auditRepository: TripAuditPrismaRepository,
  ) {}

  onModuleInit(): void {
    // Register event handlers
    this.eventBus.registerHandler('payment.captured', this.handlePaymentCaptured.bind(this));
    this.eventBus.registerHandler('payment.failed', this.handlePaymentFailed.bind(this));
    this.eventBus.registerHandler('driver.offline', this.handleDriverOffline.bind(this));

    this.logger.log('Trip event handlers registered');
  }

  /**
   * Handle payment.captured event
   * Marks the trip as PAID when payment is successfully captured
   */
  private async handlePaymentCaptured(event: BaseEvent): Promise<void> {
    const paymentEvent = event as PaymentCapturedEvent;
    const { tripId, paymentIntentId, amount, currency } = paymentEvent.data;

    this.logger.log(`Processing payment.captured for trip ${tripId}`);

    try {
      // Get the trip
      const trip = await this.tripRepository.findById(tripId);

      if (!trip) {
        this.logger.warn(`Trip not found for payment.captured: ${tripId}`);
        return;
      }

      // Only process if trip is in COMPLETED status
      if (trip.status !== TripStatus.COMPLETED) {
        this.logger.warn(`Trip ${tripId} is not in COMPLETED status (current: ${trip.status})`);
        return;
      }

      // Verify payment intent matches
      if (trip.paymentIntentId !== paymentIntentId) {
        this.logger.warn(`Payment intent mismatch for trip ${tripId}: expected ${trip.paymentIntentId}, got ${paymentIntentId}`);
        return;
      }

      // Update trip to PAID status
      await this.tripRepository.update(tripId, {
        status: TripStatus.PAID,
        paidAt: new Date(),
      });

      // Create audit entry
      await this.auditRepository.create({
        tripId,
        action: `Status changed from ${TripStatus.COMPLETED} to ${TripStatus.PAID} via payment.captured event`,
        actorType: 'system',
        actorId: 'event-bus',
        payload: {
          status: TripStatus.PAID,
          paymentIntentId,
          amount,
          currency,
          eventId: event.id,
        },
      });

      this.logger.log(`Trip ${tripId} marked as PAID`);
    } catch (error) {
      this.logger.error(`Failed to process payment.captured for trip ${tripId}`, error);
      throw error; // Re-throw to prevent acknowledgment
    }
  }

  /**
   * Handle payment.failed event
   * Logs the failure and potentially triggers retry or notification
   */
  private async handlePaymentFailed(event: BaseEvent): Promise<void> {
    const paymentEvent = event as PaymentFailedEvent;
    const { tripId, paymentIntentId, failureReason } = paymentEvent.data;

    this.logger.warn(`Processing payment.failed for trip ${tripId}: ${failureReason}`);

    try {
      // Get the trip
      const trip = await this.tripRepository.findById(tripId);

      if (!trip) {
        this.logger.warn(`Trip not found for payment.failed: ${tripId}`);
        return;
      }

      // Create audit entry for the failed payment
      await this.auditRepository.create({
        tripId,
        action: 'Payment failed',
        actorType: 'system',
        actorId: 'event-bus',
        payload: {
          paymentIntentId,
          failureReason,
          eventId: event.id,
        },
      });

      // TODO: Implement retry logic or notification to rider
      // This could involve:
      // - Publishing a notification event
      // - Updating trip with payment failure flag
      // - Triggering retry with different payment method

      this.logger.log(`Recorded payment failure for trip ${tripId}`);
    } catch (error) {
      this.logger.error(`Failed to process payment.failed for trip ${tripId}`, error);
      throw error;
    }
  }

  /**
   * Handle driver.offline event
   * If driver has an active trip, may need to reassign
   */
  private async handleDriverOffline(event: BaseEvent): Promise<void> {
    const driverEvent = event as DriverOfflineEvent;
    const { driverId, reason } = driverEvent.data;

    this.logger.log(`Processing driver.offline for driver ${driverId}: ${reason}`);

    try {
      // Find active trips for this driver
      const trips = await this.tripRepository.findByDriverId(driverId);

      // Filter for trips that are in active states
      const activeTrips = trips.filter(
        (trip) =>
          trip.status === TripStatus.ASSIGNED ||
          trip.status === TripStatus.PICKUP_STARTED ||
          trip.status === TripStatus.IN_PROGRESS,
      );

      if (activeTrips.length === 0) {
        this.logger.debug(`No active trips for offline driver ${driverId}`);
        return;
      }

      for (const trip of activeTrips) {
        this.logger.warn(`Driver ${driverId} went offline with active trip ${trip.id} (status: ${trip.status})`);

        // Create audit entry
        await this.auditRepository.create({
          tripId: trip.id,
          action: `Driver went offline during active trip`,
          actorType: 'system',
          actorId: 'event-bus',
          payload: {
            driverId,
            reason,
            tripStatus: trip.status,
            eventId: event.id,
          },
        });

        // TODO: Implement reassignment logic
        // This could involve:
        // - If ASSIGNED: Reassign to another driver
        // - If PICKUP_STARTED or IN_PROGRESS: Alert operations team
        // - Publish trip.driver_offline event for monitoring
      }
    } catch (error) {
      this.logger.error(`Failed to process driver.offline for driver ${driverId}`, error);
      throw error;
    }
  }
}
