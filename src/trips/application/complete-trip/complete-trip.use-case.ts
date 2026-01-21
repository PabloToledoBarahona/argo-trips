import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { CompleteTripDto, CompleteTripResponseDto } from './complete-trip.dto.js';
import { TripPrismaRepository } from '../../infrastructure/persistence/prisma/trip-prisma.repository.js';
import { TripAuditPrismaRepository } from '../../infrastructure/persistence/prisma/trip-audit-prisma.repository.js';
import { PricingClient, FinalizeRequest, FinalizeResponse } from '../../infrastructure/http-clients/pricing.client.js';
import { PaymentsClient } from '../../infrastructure/http-clients/payments.client.js';
import { TripStatus } from '../../domain/enums/trip-status.enum.js';
import { PricingSnapshot } from '../../domain/entities/trip.entity.js';
import { mapToPricingVehicleType } from '../shared/vehicle-type.mapper.js';

@Injectable()
export class CompleteTripUseCase {
  private readonly logger = new Logger(CompleteTripUseCase.name);

  constructor(
    private readonly tripRepository: TripPrismaRepository,
    private readonly auditRepository: TripAuditPrismaRepository,
    private readonly pricingClient: PricingClient,
    private readonly paymentsClient: PaymentsClient,
  ) {}

  async execute(dto: CompleteTripDto): Promise<CompleteTripResponseDto> {
    this.logger.debug(`Completing trip ${dto.tripId}`);

    // Find trip
    const trip = await this.tripRepository.findById(dto.tripId);
    if (!trip) {
      throw new NotFoundException(`Trip ${dto.tripId} not found`);
    }

    // Validate trip is in IN_PROGRESS status
    if (trip.status !== TripStatus.IN_PROGRESS) {
      throw new BadRequestException(
        `Trip ${dto.tripId} must be in IN_PROGRESS status to complete, current status: ${trip.status}`,
      );
    }

    // Validate quoteId exists
    if (!trip.quoteId) {
      throw new BadRequestException(`Trip ${dto.tripId} is missing quoteId`);
    }

    // Validate originH3Res7 exists (required by MS06-Pricing)
    if (!trip.originH3Res7) {
      throw new BadRequestException(
        `Trip ${dto.tripId} is missing originH3Res7 (required for pricing finalize)`,
      );
    }

    // Use provided metrics or fallback to estimated
    const distance_m_final = dto.distance_m_final ?? trip.distance_m_est ?? 0;
    const duration_s_final = dto.duration_s_final ?? trip.duration_s_est ?? 0;

    // Finalize pricing with actual metrics
    const pricingVehicleType = mapToPricingVehicleType(trip.vehicleType);

    // Build MS06-compliant finalize request
    const finalizeRequest: FinalizeRequest = {
      trip_id: trip.id,
      quote_id: trip.quoteId,
      vehicle_type: pricingVehicleType,
      h3_res7: trip.originH3Res7,
      distance_m_final,
      duration_s_final,
      city: trip.city,
      status: 'completed',
    };

    let finalPricing: FinalizeResponse;

    try {
      finalPricing = await this.pricingClient.finalize(finalizeRequest);
    } catch (error) {
      this.logger.error(
        `Pricing finalize failed for trip ${trip.id}: ${this.formatError(error)}`,
      );
      throw new BadRequestException('Unable to finalize trip pricing');
    }

    // Log degradation warning if present
    if (finalPricing.degradation) {
      this.logger.warn(
        `Finalize for trip ${trip.id} returned with degradation: ${finalPricing.degradation}`,
      );
    }

    // Create payment intent using the trip's payment method
    const paymentIntent = await this.paymentsClient.createIntent({
      tripId: trip.id,
      amount: finalPricing.total_final,
      currency: finalPricing.currency,
      method: trip.paymentMethod,
    });

    // Transition to COMPLETED
    const completedAt = new Date();
    const updatedTrip = await this.tripRepository.update(trip.id, {
      status: TripStatus.COMPLETED,
      completedAt,
      distance_m_final,
      duration_s_final,
      paymentIntentId: paymentIntent.paymentIntentId,
      pricingSnapshot: this.buildFinalizeSnapshot(finalPricing),
    });

    // Create audit entry
    await this.auditRepository.create({
      tripId: trip.id,
      action: `Status changed from ${TripStatus.IN_PROGRESS} to ${TripStatus.COMPLETED}`,
      actorType: 'driver',
      actorId: trip.driverId,
      payload: {
        previousStatus: TripStatus.IN_PROGRESS,
        newStatus: TripStatus.COMPLETED,
        distance_m_final,
        duration_s_final,
        totalPrice: finalPricing.total_final,
        quoteId: trip.quoteId,
        surgeMultiplier: finalPricing.surge_used,
        paymentIntentId: paymentIntent.paymentIntentId,
        min_fare_applied: finalPricing.min_fare_applied,
        cancel_fee_applied: finalPricing.cancel_fee_applied,
        pricing_rule_version: finalPricing.pricing_rule_version,
        degradation: finalPricing.degradation,
      },
    });

    this.logger.log(
      `Trip ${dto.tripId} completed (quote ${trip.quoteId}), final price: ${finalPricing.total_final} ${finalPricing.currency}, surge=${finalPricing.surge_used}, min_fare_applied=${finalPricing.min_fare_applied}, payment intent: ${paymentIntent.paymentIntentId}, degradation=${finalPricing.degradation ?? 'none'}`,
    );

    return {
      id: updatedTrip.id,
      status: updatedTrip.status,
      completedAt: updatedTrip.completedAt!,
      distance_m_final: updatedTrip.distance_m_final,
      duration_s_final: updatedTrip.duration_s_final,
      totalPrice: finalPricing.total_final,
      surgeMultiplier: finalPricing.surge_used,
      currency: finalPricing.currency,
      taxes: finalPricing.taxes,
      min_fare_applied: finalPricing.min_fare_applied,
      cancel_fee_applied: finalPricing.cancel_fee_applied,
      pricing_rule_version: finalPricing.pricing_rule_version,
      paymentIntentId: paymentIntent.paymentIntentId,
      degradation: finalPricing.degradation,
    };
  }

  /**
   * Build pricing snapshot from MS06 finalize response
   * Stores full pricing details for audit trail
   */
  private buildFinalizeSnapshot(finalPricing: FinalizeResponse): PricingSnapshot {
    // MS06 finalize doesn't return breakdown, so we use minimal snapshot
    // The full details are in the audit log payload
    return {
      basePrice: 0, // Not returned by MS06 finalize
      surgeMultiplier: finalPricing.surge_used,
      totalPrice: finalPricing.total_final,
      currency: finalPricing.currency,
      breakdown: {
        distancePrice: 0,
        timePrice: 0,
        serviceFee: 0,
      },
      taxes: finalPricing.taxes.reduce((sum, tax) => sum + tax.amount, 0),
    };
  }

  private formatError(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
