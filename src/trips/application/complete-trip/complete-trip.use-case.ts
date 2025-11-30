import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { CompleteTripDto, CompleteTripResponseDto } from './complete-trip.dto.js';
import { TripPrismaRepository } from '../../infrastructure/persistence/prisma/trip-prisma.repository.js';
import { TripAuditPrismaRepository } from '../../infrastructure/persistence/prisma/trip-audit-prisma.repository.js';
import { PricingClient } from '../../infrastructure/http-clients/pricing.client.js';
import { PaymentsClient } from '../../infrastructure/http-clients/payments.client.js';
import { TripStatus } from '../../domain/enums/trip-status.enum.js';

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

    // Use provided metrics or fallback to estimated
    const distance_m_final = dto.distance_m_final ?? trip.distance_m_est ?? 0;
    const duration_s_final = dto.duration_s_final ?? trip.duration_s_est ?? 0;

    // Finalize pricing with actual metrics
    const finalPricing = await this.pricingClient.finalize({
      quoteId: trip.quoteId,
      tripId: trip.id,
    });

    // Create payment intent
    const paymentIntent = await this.paymentsClient.createIntent({
      tripId: trip.id,
      amount: finalPricing.finalPrice,
      currency: finalPricing.currency,
      method: 'card', // Default to card, could be parameterized
    });

    // Transition to COMPLETED
    const completedAt = new Date();
    const updatedTrip = await this.tripRepository.update(trip.id, {
      status: TripStatus.COMPLETED,
      completedAt,
      distance_m_final,
      duration_s_final,
      paymentIntentId: paymentIntent.paymentIntentId,
      pricingSnapshot: {
        basePrice: trip.pricingSnapshot?.basePrice ?? finalPricing.finalPrice,
        surgeMultiplier: finalPricing.breakdown.dynamicMultiplier,
        totalPrice: finalPricing.finalPrice,
        currency: finalPricing.currency,
        breakdown: {
          distancePrice: finalPricing.breakdown.distancePrice,
          timePrice: finalPricing.breakdown.timePrice,
          serviceFee: finalPricing.breakdown.serviceFee,
        },
      },
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
        finalPrice: finalPricing.finalPrice,
        paymentIntentId: paymentIntent.paymentIntentId,
      },
    });

    this.logger.log(
      `Trip ${dto.tripId} completed, final price: ${finalPricing.finalPrice} ${finalPricing.currency}, payment intent: ${paymentIntent.paymentIntentId}`,
    );

    return {
      id: updatedTrip.id,
      status: updatedTrip.status,
      completedAt: updatedTrip.completedAt!,
      distance_m_final: updatedTrip.distance_m_final,
      duration_s_final: updatedTrip.duration_s_final,
    };
  }
}
