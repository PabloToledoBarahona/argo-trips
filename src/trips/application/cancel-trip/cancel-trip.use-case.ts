import { Injectable, Logger, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { CancelTripDto, CancelTripResponseDto } from './cancel-trip.dto.js';
import { TripPrismaRepository } from '../../infrastructure/persistence/prisma/trip-prisma.repository.js';
import { TripAuditPrismaRepository } from '../../infrastructure/persistence/prisma/trip-audit-prisma.repository.js';
import { TripCancellationsPrismaRepository } from '../../infrastructure/persistence/prisma/trip-cancellations-prisma.repository.js';
import { PinCacheService } from '../../infrastructure/redis/pin-cache.service.js';
import { TimerService } from '../../infrastructure/redis/timer.service.js';
import { EventBusService } from '../../../shared/event-bus/event-bus.service.js';
import { TripStatus } from '../../domain/enums/trip-status.enum.js';
import type { ActorContext } from '../shared/actor-context.js';

@Injectable()
export class CancelTripUseCase {
  private readonly logger = new Logger(CancelTripUseCase.name);

  constructor(
    private readonly tripRepository: TripPrismaRepository,
    private readonly auditRepository: TripAuditPrismaRepository,
    private readonly cancellationsRepository: TripCancellationsPrismaRepository,
    private readonly pinCacheService: PinCacheService,
    private readonly timerService: TimerService,
    private readonly eventBus: EventBusService,
  ) {}

  async execute(dto: CancelTripDto, actor?: ActorContext): Promise<CancelTripResponseDto> {
    this.logger.debug(`Canceling trip ${dto.tripId}, reason: ${dto.reason}, side: ${dto.side}`);

    // Find trip
    const trip = await this.tripRepository.findById(dto.tripId);
    if (!trip) {
      throw new NotFoundException(`Trip ${dto.tripId} not found`);
    }

    if (actor?.role && actor.role !== 'admin') {
      if (dto.side === 'rider' && actor.role !== 'rider') {
        throw new ForbiddenException('cancel side does not match actor role');
      }
      if (dto.side === 'driver' && actor.role !== 'driver') {
        throw new ForbiddenException('cancel side does not match actor role');
      }

      if (dto.side === 'rider' && trip.riderId !== actor.id) {
        throw new ForbiddenException('rider is not assigned to this trip');
      }

      if (dto.side === 'driver' && trip.driverId !== actor.id) {
        throw new ForbiddenException('driver is not assigned to this trip');
      }
    }

    // Validate trip can be canceled (not already COMPLETED, PAID, or CANCELED)
    if (trip.status === TripStatus.COMPLETED || trip.status === TripStatus.PAID) {
      throw new BadRequestException(
        `Trip ${dto.tripId} cannot be canceled from status ${trip.status}`,
      );
    }

    if (trip.status === TripStatus.CANCELED) {
      this.logger.warn(`Trip ${dto.tripId} is already canceled`);
      // Return existing canceled trip info
      return {
        id: trip.id,
        status: trip.status,
        cancelAt: trip.cancelAt!,
        cancelReason: trip.cancelReason!,
        cancelSide: trip.cancelSide!,
      };
    }

    // Transition to CANCELED
    const cancelAt = new Date();
    const updatedTrip = await this.tripRepository.update(trip.id, {
      status: TripStatus.CANCELED,
      cancelAt,
      cancelReason: dto.reason,
      cancelSide: dto.side,
    });

    // Clear PIN if exists
    try {
      await this.pinCacheService.clearPin(trip.id);
    } catch (error) {
      this.logger.warn(`Failed to clear PIN for trip ${trip.id}:`, error);
      // Non-critical, continue
    }

    // Clear all timers
    try {
      await this.timerService.clearOfferExpiry(trip.id);
      await this.timerService.clearNoShow(trip.id);
    } catch (error) {
      this.logger.warn(`Failed to clear timers for trip ${trip.id}:`, error);
      // Non-critical, continue
    }

    // Create audit entry
    await this.auditRepository.create({
      tripId: trip.id,
      action: `Status changed from ${trip.status} to ${TripStatus.CANCELED}`,
      actorType: dto.side,
      actorId: dto.side === 'rider' ? trip.riderId : trip.driverId,
      payload: {
        previousStatus: trip.status,
        newStatus: TripStatus.CANCELED,
        reason: dto.reason,
        notes: dto.notes,
      },
    });

    // Calculate seconds since assign if applicable
    let secondsSinceAssign: number | undefined;
    if (trip.assignedAt) {
      secondsSinceAssign = Math.floor((cancelAt.getTime() - trip.assignedAt.getTime()) / 1000);
    }

    // Create cancellation record
    const cancellationRecord = await this.cancellationsRepository.create({
      tripId: trip.id,
      reason: dto.reason,
      side: dto.side,
      secondsSinceAssign,
      feeAppliedDec: 0, // Could be calculated based on timing and policy
    });

    this.logger.log(
      `Trip ${dto.tripId} canceled by ${dto.side}, reason: ${dto.reason}`,
    );

    // Publish trip.cancelled event to Event Bus
    await this.eventBus.publishTripEvent({
      type: 'trip.cancelled',
      data: {
        tripId: updatedTrip.id,
        riderId: updatedTrip.riderId,
        driverId: updatedTrip.driverId,
        cancelledBy: dto.side,
        reason: dto.reason,
        cancellationFee: cancellationRecord.feeAppliedDec ? Number(cancellationRecord.feeAppliedDec) : undefined,
        currency: updatedTrip.pricingSnapshot?.currency,
      },
    });

    return {
      id: updatedTrip.id,
      status: updatedTrip.status,
      cancelAt: updatedTrip.cancelAt!,
      cancelReason: updatedTrip.cancelReason!,
      cancelSide: updatedTrip.cancelSide!,
    };
  }
}
