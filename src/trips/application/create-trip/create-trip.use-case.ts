import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { CreateTripDto, CreateTripResponseDto } from './create-trip.dto.js';
import { TripPrismaRepository } from '../../infrastructure/persistence/prisma/trip-prisma.repository.js';
import { TripAuditPrismaRepository } from '../../infrastructure/persistence/prisma/trip-audit-prisma.repository.js';
import { GeoClient } from '../../infrastructure/http-clients/geo.client.js';
import { PricingClient } from '../../infrastructure/http-clients/pricing.client.js';
import { Trip } from '../../domain/entities/trip.entity.js';
import { TripStatus } from '../../domain/enums/trip-status.enum.js';

@Injectable()
export class CreateTripUseCase {
  private readonly logger = new Logger(CreateTripUseCase.name);

  constructor(
    private readonly tripRepository: TripPrismaRepository,
    private readonly auditRepository: TripAuditPrismaRepository,
    private readonly geoClient: GeoClient,
    private readonly pricingClient: PricingClient,
  ) {}

  async execute(dto: CreateTripDto): Promise<CreateTripResponseDto> {
    this.logger.debug(`Creating trip for rider: ${dto.riderId}`);

    // Generate unique trip ID
    const tripId = uuidv4();

    // Calculate distance and duration using GeoClient
    const distanceResponse = await this.geoClient.distance(
      { lat: dto.originLat, lng: dto.originLng },
      { lat: dto.destLat, lng: dto.destLng },
    );

    // Get pricing quote
    const quoteResponse = await this.pricingClient.quote({
      riderId: dto.riderId,
      vehicleType: dto.vehicleType as 'economy' | 'premium' | 'delivery',
      origin: {
        lat: dto.originLat,
        lng: dto.originLng,
        h3_res9: dto.originH3Res9,
      },
      destination: {
        lat: dto.destLat,
        lng: dto.destLng,
        h3_res9: dto.destH3Res9,
      },
    });

    // Create Trip entity
    const trip = new Trip({
      id: tripId,
      riderId: dto.riderId,
      vehicleType: dto.vehicleType,
      status: TripStatus.REQUESTED,
      city: dto.city,
      originLat: dto.originLat,
      originLng: dto.originLng,
      originH3Res9: dto.originH3Res9,
      destLat: dto.destLat,
      destLng: dto.destLng,
      destH3Res9: dto.destH3Res9,
      requestedAt: new Date(),
      quoteId: quoteResponse.quoteId,
      distance_m_est: distanceResponse.distanceMeters,
      duration_s_est: distanceResponse.durationSeconds,
      pricingSnapshot: {
        basePrice: quoteResponse.baseFare,
        surgeMultiplier: quoteResponse.breakdown.dynamicMultiplier,
        totalPrice: quoteResponse.totalPrice,
        currency: quoteResponse.currency,
        breakdown: {
          distancePrice: quoteResponse.breakdown.distancePrice,
          timePrice: quoteResponse.breakdown.timePrice,
          serviceFee: quoteResponse.breakdown.serviceFee,
        },
      },
    });

    // Save to repository
    const savedTrip = await this.tripRepository.create(trip);

    // Create audit entry
    await this.auditRepository.create({
      tripId: savedTrip.id,
      action: `Status changed to ${TripStatus.REQUESTED}`,
      actorType: 'rider',
      actorId: dto.riderId,
      payload: {
        status: TripStatus.REQUESTED,
        quoteId: quoteResponse.quoteId,
      },
    });

    this.logger.log(`Trip created: ${tripId}, quote: ${quoteResponse.quoteId}`);

    return {
      id: savedTrip.id,
      status: savedTrip.status,
      riderId: savedTrip.riderId,
      vehicleType: savedTrip.vehicleType,
      requestedAt: savedTrip.requestedAt,
    };
  }
}
