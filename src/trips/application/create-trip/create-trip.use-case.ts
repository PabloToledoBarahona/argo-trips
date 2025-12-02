import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { CreateTripDto, CreateTripResponseDto } from './create-trip.dto.js';
import { TripPrismaRepository } from '../../infrastructure/persistence/prisma/trip-prisma.repository.js';
import { TripAuditPrismaRepository } from '../../infrastructure/persistence/prisma/trip-audit-prisma.repository.js';
import { GeoClient } from '../../infrastructure/http-clients/geo.client.js';
import { PricingClient, QuoteRequest, QuoteResponse } from '../../infrastructure/http-clients/pricing.client.js';
import { PricingSnapshot, Trip } from '../../domain/entities/trip.entity.js';
import { TripStatus } from '../../domain/enums/trip-status.enum.js';
import { mapToPricingVehicleType } from '../shared/vehicle-type.mapper.js';

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

    const originCoordinates = { lat: dto.originLat, lng: dto.originLng };
    const destinationCoordinates = { lat: dto.destLat, lng: dto.destLng };

    let originH3Res7: string | undefined;
    let originH3Res9: string | undefined;
    let destH3Res7: string | undefined;
    let destH3Res9: string | undefined;
    let distanceMeters: number | undefined;
    let durationSeconds: number | undefined;

    // Resolve H3 indexes (res7 + res9) and distance with graceful degradation
    try {
      const originH3 = await this.geoClient.h3(originCoordinates.lat, originCoordinates.lng);
      originH3Res7 = originH3.h3_res7;
      originH3Res9 = originH3.h3_res9;
    } catch (error) {
      this.logger.error(
        `Failed to resolve origin H3 for trip ${tripId}: ${this.formatError(error)}`,
      );
    }

    try {
      const destinationH3 = await this.geoClient.h3(
        destinationCoordinates.lat,
        destinationCoordinates.lng,
      );
      destH3Res7 = destinationH3.h3_res7;
      destH3Res9 = destinationH3.h3_res9;
    } catch (error) {
      this.logger.error(
        `Failed to resolve destination H3 for trip ${tripId}: ${this.formatError(error)}`,
      );
    }

    try {
      const distanceResponse = await this.geoClient.distance(
        originCoordinates,
        destinationCoordinates,
      );
      distanceMeters = distanceResponse.distanceMeters;
      durationSeconds = distanceResponse.durationSeconds;
    } catch (error) {
      this.logger.error(
        `Geo distance failed for trip ${tripId}: ${this.formatError(error)}`,
      );
    }

    const resolvedOriginH3Res9 = originH3Res9 ?? dto.originH3Res9;
    const resolvedDestH3Res9 = destH3Res9 ?? dto.destH3Res9;

    if (!resolvedOriginH3Res9 || !resolvedDestH3Res9) {
      throw new BadRequestException('Missing origin/destination H3 indices');
    }

    const pricingVehicleType = mapToPricingVehicleType(dto.vehicleType);

    const quoteRequest: QuoteRequest = {
      city: dto.city,
      vehicleType: pricingVehicleType,
      riderId: dto.riderId,
      origin: {
        lat: dto.originLat,
        lng: dto.originLng,
        h3_res7: originH3Res7,
        h3_res9: resolvedOriginH3Res9,
      },
      destination: {
        lat: dto.destLat,
        lng: dto.destLng,
        h3_res7: destH3Res7,
        h3_res9: resolvedDestH3Res9,
      },
      distance_m: distanceMeters,
      duration_s: durationSeconds,
    };

    let quoteResponse: QuoteResponse;

    try {
      quoteResponse = await this.pricingClient.quote(quoteRequest);
    } catch (error) {
      this.logger.error(
        `Pricing quote failed for trip ${tripId}: ${this.formatError(error)}`,
      );
      throw new BadRequestException('Unable to retrieve pricing quote');
    }

    distanceMeters = distanceMeters ?? quoteResponse.distanceMeters;
    durationSeconds = durationSeconds ?? quoteResponse.durationSeconds;

    // Calculate distance and duration using GeoClient
    // Create Trip entity
    const trip = new Trip({
      id: tripId,
      riderId: dto.riderId,
      vehicleType: pricingVehicleType,
      status: TripStatus.REQUESTED,
      city: dto.city,
      originLat: dto.originLat,
      originLng: dto.originLng,
      originH3Res9: resolvedOriginH3Res9,
      destLat: dto.destLat,
      destLng: dto.destLng,
      destH3Res9: resolvedDestH3Res9,
      requestedAt: new Date(),
      quoteId: quoteResponse.quoteId,
      distance_m_est: distanceMeters,
      duration_s_est: durationSeconds,
      pricingSnapshot: this.buildQuoteSnapshot(quoteResponse),
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

  private buildQuoteSnapshot(quote: QuoteResponse): PricingSnapshot {
    const breakdown = quote.breakdown ?? {
      distancePrice: 0,
      timePrice: 0,
      serviceFee: 0,
    };

    return {
      basePrice: quote.basePrice,
      surgeMultiplier: quote.surgeMultiplier,
      totalPrice: quote.estimateTotal,
      currency: quote.currency,
      breakdown: {
        distancePrice: breakdown.distancePrice ?? 0,
        timePrice: breakdown.timePrice ?? 0,
        serviceFee: breakdown.serviceFee ?? 0,
        specialCharges: breakdown.specialCharges,
      },
    };
  }

  private formatError(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
