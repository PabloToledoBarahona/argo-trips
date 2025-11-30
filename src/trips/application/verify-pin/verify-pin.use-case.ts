import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { VerifyPinDto, VerifyPinResponseDto } from './verify-pin.dto.js';
import { TripPrismaRepository } from '../../infrastructure/persistence/prisma/trip-prisma.repository.js';
import { TripAuditPrismaRepository } from '../../infrastructure/persistence/prisma/trip-audit-prisma.repository.js';
import { PinCacheService } from '../../infrastructure/redis/pin-cache.service.js';
import { TimerService } from '../../infrastructure/redis/timer.service.js';
import { TripStatus } from '../../domain/enums/trip-status.enum.js';

@Injectable()
export class VerifyPinUseCase {
  private readonly logger = new Logger(VerifyPinUseCase.name);
  private readonly DRIVER_NO_SHOW_SECONDS = 600; // 10 minutes

  constructor(
    private readonly tripRepository: TripPrismaRepository,
    private readonly auditRepository: TripAuditPrismaRepository,
    private readonly pinCacheService: PinCacheService,
    private readonly timerService: TimerService,
  ) {}

  async execute(dto: VerifyPinDto): Promise<VerifyPinResponseDto> {
    this.logger.debug(`Verifying PIN for trip ${dto.tripId}`);

    // Find trip
    const trip = await this.tripRepository.findById(dto.tripId);
    if (!trip) {
      throw new NotFoundException(`Trip ${dto.tripId} not found`);
    }

    // Validate trip is in ASSIGNED status
    if (trip.status !== TripStatus.ASSIGNED) {
      throw new BadRequestException(
        `Trip ${dto.tripId} must be in ASSIGNED status to verify PIN, current status: ${trip.status}`,
      );
    }

    // Check if PIN is blocked due to too many failed attempts
    const isBlocked = await this.pinCacheService.isBlocked(dto.tripId);
    if (isBlocked) {
      this.logger.warn(`PIN verification blocked for trip ${dto.tripId} due to max attempts`);
      throw new BadRequestException('PIN verification blocked due to too many failed attempts');
    }

    // Validate PIN
    const isValid = await this.pinCacheService.validatePin(dto.tripId, dto.pin);

    if (!isValid) {
      this.logger.warn(`Invalid PIN attempt for trip ${dto.tripId}`);
      return {
        verified: false,
        tripId: dto.tripId,
      };
    }

    // PIN is valid - transition to PICKUP_STARTED
    const pickupStartedAt = new Date();
    await this.tripRepository.update(trip.id, {
      status: TripStatus.PICKUP_STARTED,
      pickupStartedAt,
    });

    // Clear rider no-show timer since rider showed up
    await this.timerService.clearNoShow(trip.id);

    // Set driver no-show timer
    await this.timerService.setDriverNoShow(trip.id, this.DRIVER_NO_SHOW_SECONDS);

    // Clear PIN from cache
    await this.pinCacheService.clearPin(trip.id);

    // Create audit entry
    await this.auditRepository.create({
      tripId: trip.id,
      action: `Status changed from ${TripStatus.ASSIGNED} to ${TripStatus.PICKUP_STARTED}`,
      actorType: 'rider',
      actorId: trip.riderId,
      payload: {
        previousStatus: TripStatus.ASSIGNED,
        newStatus: TripStatus.PICKUP_STARTED,
        pinVerified: true,
      },
    });

    this.logger.log(`PIN verified for trip ${dto.tripId}, status changed to PICKUP_STARTED`);

    return {
      verified: true,
      tripId: dto.tripId,
    };
  }
}
