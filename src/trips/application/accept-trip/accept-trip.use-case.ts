import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { AcceptTripDto, AcceptTripResponseDto } from './accept-trip.dto.js';
import { TripPrismaRepository } from '../../infrastructure/persistence/prisma/trip-prisma.repository.js';
import { TripAuditPrismaRepository } from '../../infrastructure/persistence/prisma/trip-audit-prisma.repository.js';
import { DriverSessionsClient } from '../../infrastructure/http-clients/driver-sessions.client.js';
import { GeoClient } from '../../infrastructure/http-clients/geo.client.js';
import { PinCacheService } from '../../infrastructure/redis/pin-cache.service.js';
import { TimerService } from '../../infrastructure/redis/timer.service.js';
import { TripStatus } from '../../domain/enums/trip-status.enum.js';

@Injectable()
export class AcceptTripUseCase {
  private readonly logger = new Logger(AcceptTripUseCase.name);
  private readonly PIN_TTL_SECONDS = 900; // 15 minutes
  private readonly RIDER_NO_SHOW_SECONDS = 300; // 5 minutes

  constructor(
    private readonly tripRepository: TripPrismaRepository,
    private readonly auditRepository: TripAuditPrismaRepository,
    private readonly driverSessionsClient: DriverSessionsClient,
    private readonly geoClient: GeoClient,
    private readonly pinCacheService: PinCacheService,
    private readonly timerService: TimerService,
  ) {}

  async execute(dto: AcceptTripDto): Promise<AcceptTripResponseDto> {
    this.logger.debug(`Driver ${dto.driverId} accepting trip ${dto.tripId}`);

    // Find trip
    const trip = await this.tripRepository.findById(dto.tripId);
    if (!trip) {
      throw new NotFoundException(`Trip ${dto.tripId} not found`);
    }

    // Validate trip is in REQUESTED or OFFERED status
    if (trip.status !== TripStatus.REQUESTED && trip.status !== TripStatus.OFFERED) {
      throw new BadRequestException(
        `Trip ${dto.tripId} cannot be accepted from status ${trip.status}`,
      );
    }

    // Validate driver is online
    const driverSession = await this.driverSessionsClient.getSession(dto.driverId);
    if (!driverSession.isOnline) {
      throw new BadRequestException(`Driver ${dto.driverId} is not online`);
    }

    // Validate vehicle type matches
    if (driverSession.vehicleType !== trip.vehicleType) {
      throw new BadRequestException(
        `Driver vehicle type ${driverSession.vehicleType} does not match trip requirement ${trip.vehicleType}`,
      );
    }

    // Calculate ETA from driver's location to pickup
    const etaResponse = await this.geoClient.eta(
      {
        lat: driverSession.lastLocation.lat,
        lng: driverSession.lastLocation.lng,
      },
      { lat: trip.originLat, lng: trip.originLng },
    );

    // Generate 4-digit PIN
    const pin = this.generatePin();
    await this.pinCacheService.setPin(trip.id, pin, this.PIN_TTL_SECONDS);

    // Set rider no-show timer
    await this.timerService.setRiderNoShow(trip.id, this.RIDER_NO_SHOW_SECONDS);

    this.logger.log(`PIN generated for trip ${trip.id} (not logged for security)`);

    // Update trip to ASSIGNED
    const assignedAt = new Date();
    const updatedTrip = await this.tripRepository.update(trip.id, {
      driverId: dto.driverId,
      status: TripStatus.ASSIGNED,
      assignedAt,
    });

    // Create audit entry
    await this.auditRepository.create({
      tripId: trip.id,
      action: `Status changed from ${trip.status} to ${TripStatus.ASSIGNED}`,
      actorType: 'driver',
      actorId: dto.driverId,
      payload: {
        previousStatus: trip.status,
        newStatus: TripStatus.ASSIGNED,
        etaSeconds: etaResponse.etaSeconds,
      },
    });

    this.logger.log(
      `Trip ${trip.id} accepted by driver ${dto.driverId}, ETA: ${etaResponse.etaSeconds}s`,
    );

    return {
      id: updatedTrip.id,
      status: updatedTrip.status,
      driverId: updatedTrip.driverId!,
      assignedAt: updatedTrip.assignedAt!,
    };
  }

  private generatePin(): string {
    // Generate 4-digit PIN
    return Math.floor(1000 + Math.random() * 9000).toString();
  }
}
