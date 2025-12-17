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
import { mapToGeoProfile } from '../shared/geo-profile.mapper.js';

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

    const geoProfile = mapToGeoProfile(dto.vehicleType);

    // Resolve H3 indexes (res7 + res9) using batch operation with graceful degradation
    try {
      const h3Response = await this.geoClient.h3Encode({
        ops: [
          { op: 'encode', lat: dto.originLat, lng: dto.originLng, res: 9 },
          { op: 'encode', lat: dto.originLat, lng: dto.originLng, res: 7 },
          { op: 'encode', lat: dto.destLat, lng: dto.destLng, res: 9 },
          { op: 'encode', lat: dto.destLat, lng: dto.destLng, res: 7 },
        ],
      });

      // Extract results (order matches request ops)
      const [originRes9Result, originRes7Result, destRes9Result, destRes7Result] = h3Response.results;

      if (originRes9Result.op === 'encode' && !('error' in originRes9Result)) {
        originH3Res9 = originRes9Result.h3;
      }
      if (originRes7Result.op === 'encode' && !('error' in originRes7Result)) {
        originH3Res7 = originRes7Result.h3;
      }
      if (destRes9Result.op === 'encode' && !('error' in destRes9Result)) {
        destH3Res9 = destRes9Result.h3;
      }
      if (destRes7Result.op === 'encode' && !('error' in destRes7Result)) {
        destH3Res7 = destRes7Result.h3;
      }
    } catch (error) {
      this.logger.error(
        `Failed to resolve H3 indexes for trip ${tripId}: ${this.formatError(error)}`,
      );
    }

    // Calculate route (distance and duration) with graceful degradation
    try {
      const routeResponse = await this.geoClient.route({
        origin: originCoordinates,
        destination: destinationCoordinates,
        profile: geoProfile,
        city: dto.city,
        include_polyline: false,
        alternatives: 0,
      });

      distanceMeters = routeResponse.distance_m;
      durationSeconds = routeResponse.duration_sec;

      this.logger.debug(
        `Route calculated for trip ${tripId}: ${distanceMeters}m, ${durationSeconds}s, engine=${routeResponse.engine}`,
      );
    } catch (error) {
      this.logger.error(
        `GEO route failed for trip ${tripId}: ${this.formatError(error)}. Will use Pricing service fallback.`,
      );
    }

    const resolvedOriginH3Res9 = originH3Res9 ?? dto.originH3Res9;
    const resolvedDestH3Res9 = destH3Res9 ?? dto.destH3Res9;

    if (!resolvedOriginH3Res9 || !resolvedDestH3Res9) {
      throw new BadRequestException('Missing origin/destination H3 indices');
    }

    const pricingVehicleType = mapToPricingVehicleType(dto.vehicleType);

    // Build MS06-compliant quote request
    const quoteRequest: QuoteRequest = {
      origin: {
        lat: dto.originLat,
        lng: dto.originLng,
      },
      destination: {
        lat: dto.destLat,
        lng: dto.destLng,
      },
      vehicle_type: pricingVehicleType,
      city: dto.city,
      include_breakdown: true,
      distance_m_est: distanceMeters,
      duration_s_est: durationSeconds,
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

    // Log degradation warning if present
    if (quoteResponse.degradation) {
      this.logger.warn(
        `Quote ${quoteResponse.quote_id} for trip ${tripId} returned with degradation: ${quoteResponse.degradation}. Price estimate may be less accurate.`,
      );
    }

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
      originH3Res7,
      destLat: dto.destLat,
      destLng: dto.destLng,
      destH3Res9: resolvedDestH3Res9,
      destH3Res7,
      requestedAt: new Date(),
      quoteId: quoteResponse.quote_id,
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
        quoteId: quoteResponse.quote_id,
        degradation: quoteResponse.degradation,
      },
    });

    this.logger.log(
      `Trip created: ${tripId}, quote: ${quoteResponse.quote_id}, est total: ${quoteResponse.estimate_total} ${quoteResponse.currency}, surge=${quoteResponse.zone.surge}, degradation=${quoteResponse.degradation ?? 'none'}`,
    );

    return {
      id: savedTrip.id,
      status: savedTrip.status,
      riderId: savedTrip.riderId,
      vehicleType: savedTrip.vehicleType,
      requestedAt: savedTrip.requestedAt,
      quoteId: quoteResponse.quote_id,
      estimateTotal: quoteResponse.estimate_total,
      basePrice: quoteResponse.breakdown?.base ?? 0,
      surgeMultiplier: quoteResponse.zone.surge,
      currency: quoteResponse.currency,
      breakdown: this.buildBreakdownDto(quoteResponse),
      distanceMeters,
      durationSeconds,
      degradation: quoteResponse.degradation,
    };
  }

  /**
   * Build pricing snapshot from MS06 quote response
   * Stores full pricing details for audit trail
   */
  private buildQuoteSnapshot(quote: QuoteResponse): PricingSnapshot {
    const breakdown = quote.breakdown;

    if (!breakdown) {
      // Degraded mode: minimal snapshot
      return {
        basePrice: 0,
        surgeMultiplier: quote.zone.surge,
        totalPrice: quote.estimate_total,
        currency: quote.currency,
        breakdown: {
          distancePrice: 0,
          timePrice: 0,
          serviceFee: 0,
        },
      };
    }

    return {
      basePrice: breakdown.base,
      surgeMultiplier: quote.zone.surge,
      totalPrice: quote.estimate_total,
      currency: quote.currency,
      breakdown: {
        distancePrice: breakdown.per_km.amount,
        timePrice: breakdown.per_min.amount,
        serviceFee: breakdown.min_fare,
        specialCharges: breakdown.extras.map((extra) => ({
          type: extra.code,
          amount: extra.amount,
          description: extra.description,
        })),
      },
    };
  }

  /**
   * Build breakdown DTO for response
   * Maps MS06 format to TRIPS API format
   */
  private buildBreakdownDto(quote: QuoteResponse) {
    const breakdown = quote.breakdown;

    if (!breakdown) {
      return {
        distancePrice: 0,
        timePrice: 0,
        serviceFee: 0,
        specialCharges: [],
      };
    }

    return {
      distancePrice: breakdown.per_km.amount,
      timePrice: breakdown.per_min.amount,
      serviceFee: breakdown.min_fare,
      specialCharges: breakdown.extras.map((extra) => ({
        type: extra.code,
        amount: extra.amount,
        description: extra.description,
      })),
    };
  }

  private formatError(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
