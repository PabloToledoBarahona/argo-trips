import { Injectable, Logger, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { AcceptTripDto, AcceptTripResponseDto } from './accept-trip.dto.js';
import { TripPrismaRepository } from '../../infrastructure/persistence/prisma/trip-prisma.repository.js';
import { TripAuditPrismaRepository } from '../../infrastructure/persistence/prisma/trip-audit-prisma.repository.js';
import { DriverSessionsClient } from '../../infrastructure/http-clients/driver-sessions.client.js';
import { ProfilesEligibilityClient } from '../../infrastructure/http-clients/profiles-eligibility.client.js';
import { GeoClient } from '../../infrastructure/http-clients/geo.client.js';
import { PinCacheService } from '../../infrastructure/redis/pin-cache.service.js';
import { TimerService } from '../../infrastructure/redis/timer.service.js';
import { EventBusService } from '../../../shared/event-bus/event-bus.service.js';
import { TripStatus } from '../../domain/enums/trip-status.enum.js';
import { mapToGeoProfile } from '../shared/geo-profile.mapper.js';
import type { ActorContext } from '../shared/actor-context.js';

@Injectable()
export class AcceptTripUseCase {
  private readonly logger = new Logger(AcceptTripUseCase.name);
  private readonly PIN_TTL_SECONDS = 900; // 15 minutes
  private readonly RIDER_NO_SHOW_SECONDS = 300; // 5 minutes

  constructor(
    private readonly tripRepository: TripPrismaRepository,
    private readonly auditRepository: TripAuditPrismaRepository,
    private readonly driverSessionsClient: DriverSessionsClient,
    private readonly profilesEligibilityClient: ProfilesEligibilityClient,
    private readonly geoClient: GeoClient,
    private readonly pinCacheService: PinCacheService,
    private readonly timerService: TimerService,
    private readonly eventBus: EventBusService,
  ) {}

  async execute(dto: AcceptTripDto, actor?: ActorContext): Promise<AcceptTripResponseDto> {
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

    if (actor?.role === 'driver' && actor.id !== dto.driverId) {
      throw new ForbiddenException('driverId does not match authenticated user');
    }

    // Validate driver is online and eligible
    const driverSession = await this.driverSessionsClient.getSession(dto.driverId);

    if (!driverSession.online) {
      throw new BadRequestException(`Driver ${dto.driverId} is not online`);
    }

    if (!driverSession.eligibility.ok) {
      throw new BadRequestException(
        `Driver ${dto.driverId} is not eligible: ${driverSession.eligibility.status}`,
      );
    }

    // Hard gate: recompute eligibility directly from MS02 to avoid stale caches during assignment.
    const eligibility = await this.profilesEligibilityClient.recomputeEligibility(dto.driverId);
    if (!eligibility.is_eligible) {
      const code = eligibility.blocking_reasons?.[0]?.code || 'unknown';
      throw new BadRequestException(
        `Driver ${dto.driverId} is not eligible (profiles): ${code}`,
      );
    }

    // Validate driver has sent location data
    if (!driverSession.last_loc) {
      throw new BadRequestException(
        `Driver ${dto.driverId} has no location data available`,
      );
    }

    // Calculate ETA from driver's location to pickup
    const geoProfile = mapToGeoProfile(trip.vehicleType);

    const etaResponse = await this.geoClient.eta({
      origins: [
        {
          lat: driverSession.last_loc.lat,
          lng: driverSession.last_loc.lng,
        },
      ],
      destinations: [{ lat: trip.originLat, lng: trip.originLng }],
      profile: geoProfile,
      city: trip.city,
    });

    // Extract ETA from first (and only) pair
    const etaPair = etaResponse.pairs[0];
    if (!etaPair) {
      throw new BadRequestException('Failed to calculate ETA: no results from GEO service');
    }

    const etaSeconds = etaPair.duration_sec;
    const etaDistance = etaPair.distance_m;

    this.logger.debug(
      `ETA calculated for driver ${dto.driverId} to pickup: ${etaSeconds}s, ${etaDistance}m, engine=${etaResponse.engine}`,
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
        etaSeconds,
        etaDistanceMeters: etaDistance,
        geoEngine: etaResponse.engine,
        geoDegradation: etaResponse.degradation,
      },
    });

    this.logger.log(
      `Trip ${trip.id} accepted by driver ${dto.driverId}, ETA: ${etaSeconds}s (${etaDistance}m)`,
    );

    // Publish trip.assigned event to Event Bus
    await this.eventBus.publishTripEvent({
      type: 'trip.assigned',
      data: {
        tripId: updatedTrip.id,
        riderId: updatedTrip.riderId,
        driverId: updatedTrip.driverId!,
        vehicleType: updatedTrip.vehicleType,
        city: updatedTrip.city,
        estimatedArrivalMinutes: Math.ceil(etaSeconds / 60),
      },
    });

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
