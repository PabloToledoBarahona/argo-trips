import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { StartTripDto, StartTripResponseDto } from './start-trip.dto.js';
import { TripPrismaRepository } from '../../infrastructure/persistence/prisma/trip-prisma.repository.js';
import { TripAuditPrismaRepository } from '../../infrastructure/persistence/prisma/trip-audit-prisma.repository.js';
import { TimerService } from '../../infrastructure/redis/timer.service.js';
import { TripStatus } from '../../domain/enums/trip-status.enum.js';

@Injectable()
export class StartTripUseCase {
  private readonly logger = new Logger(StartTripUseCase.name);

  constructor(
    private readonly tripRepository: TripPrismaRepository,
    private readonly auditRepository: TripAuditPrismaRepository,
    private readonly timerService: TimerService,
  ) {}

  async execute(dto: StartTripDto): Promise<StartTripResponseDto> {
    this.logger.debug(`Starting trip ${dto.tripId}`);

    // Find trip
    const trip = await this.tripRepository.findById(dto.tripId);
    if (!trip) {
      throw new NotFoundException(`Trip ${dto.tripId} not found`);
    }

    // Validate trip is in PICKUP_STARTED status
    if (trip.status !== TripStatus.PICKUP_STARTED) {
      throw new BadRequestException(
        `Trip ${dto.tripId} must be in PICKUP_STARTED status to start, current status: ${trip.status}`,
      );
    }

    // Transition to IN_PROGRESS
    const inProgressAt = new Date();
    const updatedTrip = await this.tripRepository.update(trip.id, {
      status: TripStatus.IN_PROGRESS,
      inProgressAt,
    });

    // Clear all no-show timers
    await this.timerService.clearNoShow(trip.id);

    // Create audit entry
    await this.auditRepository.create({
      tripId: trip.id,
      action: `Status changed from ${TripStatus.PICKUP_STARTED} to ${TripStatus.IN_PROGRESS}`,
      actorType: 'driver',
      actorId: trip.driverId,
      payload: {
        previousStatus: TripStatus.PICKUP_STARTED,
        newStatus: TripStatus.IN_PROGRESS,
      },
    });

    this.logger.log(`Trip ${dto.tripId} started, status changed to IN_PROGRESS`);

    return {
      id: updatedTrip.id,
      status: updatedTrip.status,
      inProgressAt: updatedTrip.inProgressAt!,
    };
  }
}
