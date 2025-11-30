import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { MarkPaidDto, MarkPaidResponseDto } from './mark-paid.dto.js';
import { TripPrismaRepository } from '../../infrastructure/persistence/prisma/trip-prisma.repository.js';
import { TripAuditPrismaRepository } from '../../infrastructure/persistence/prisma/trip-audit-prisma.repository.js';
import { PaymentsClient } from '../../infrastructure/http-clients/payments.client.js';
import { TripStatus } from '../../domain/enums/trip-status.enum.js';

@Injectable()
export class MarkPaidUseCase {
  private readonly logger = new Logger(MarkPaidUseCase.name);

  constructor(
    private readonly tripRepository: TripPrismaRepository,
    private readonly auditRepository: TripAuditPrismaRepository,
    private readonly paymentsClient: PaymentsClient,
  ) {}

  async execute(dto: MarkPaidDto): Promise<MarkPaidResponseDto> {
    this.logger.debug(`Marking trip ${dto.tripId} as paid with payment intent ${dto.paymentIntentId}`);

    // Find trip
    const trip = await this.tripRepository.findById(dto.tripId);
    if (!trip) {
      throw new NotFoundException(`Trip ${dto.tripId} not found`);
    }

    // Validate trip is in COMPLETED status
    if (trip.status !== TripStatus.COMPLETED) {
      throw new BadRequestException(
        `Trip ${dto.tripId} must be in COMPLETED status to mark as paid, current status: ${trip.status}`,
      );
    }

    // Validate payment intent ID matches
    if (trip.paymentIntentId !== dto.paymentIntentId) {
      throw new BadRequestException(
        `Payment intent ID mismatch. Trip has ${trip.paymentIntentId}, provided ${dto.paymentIntentId}`,
      );
    }

    // Verify payment intent status from Payments service
    const paymentIntent = await this.paymentsClient.getIntent(dto.paymentIntentId);

    if (paymentIntent.status !== 'succeeded') {
      throw new BadRequestException(
        `Payment intent ${dto.paymentIntentId} is not succeeded, current status: ${paymentIntent.status}`,
      );
    }

    // Transition to PAID
    const paidAt = new Date();
    const updatedTrip = await this.tripRepository.update(trip.id, {
      status: TripStatus.PAID,
      paidAt,
    });

    // Create audit entry
    await this.auditRepository.create({
      tripId: trip.id,
      action: `Status changed from ${TripStatus.COMPLETED} to ${TripStatus.PAID}`,
      actorType: 'system',
      actorId: undefined,
      payload: {
        previousStatus: TripStatus.COMPLETED,
        newStatus: TripStatus.PAID,
        paymentIntentId: dto.paymentIntentId,
      },
    });

    this.logger.log(`Trip ${dto.tripId} marked as paid, payment intent: ${dto.paymentIntentId}`);

    return {
      id: updatedTrip.id,
      status: updatedTrip.status,
      paidAt: updatedTrip.paidAt!,
      paymentIntentId: updatedTrip.paymentIntentId!,
    };
  }
}
