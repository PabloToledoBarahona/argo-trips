import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service.js';
import { TripCancelReason, TripCancelSide } from '@prisma/client';
import { CancelReason } from '../../../domain/enums/cancel-reason.enum.js';
import { CancelSide } from '../../../domain/enums/cancel-side.enum.js';

export interface TripCancellation {
  id: string;
  tripId: string;
  side: string;
  reason: string;
  secondsSinceAssign?: number;
  feeAppliedDec?: number;
  ts: Date;
}

@Injectable()
export class TripCancellationsPrismaRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(cancellation: Omit<TripCancellation, 'id' | 'ts'>): Promise<TripCancellation> {
    const prismaCancellation = await this.prisma.tripCancellation.create({
      data: {
        tripId: cancellation.tripId,
        side: this.mapCancelSideToPrisma(cancellation.side),
        reason: this.mapCancelReasonToPrisma(cancellation.reason),
        secondsSinceAssign: cancellation.secondsSinceAssign,
        feeAppliedDec: cancellation.feeAppliedDec,
      },
    });

    return {
      id: prismaCancellation.id,
      tripId: prismaCancellation.tripId,
      side: prismaCancellation.side,
      reason: prismaCancellation.reason,
      secondsSinceAssign: prismaCancellation.secondsSinceAssign ?? undefined,
      feeAppliedDec: prismaCancellation.feeAppliedDec ? Number(prismaCancellation.feeAppliedDec) : undefined,
      ts: prismaCancellation.ts,
    };
  }

  async findByTripId(tripId: string): Promise<TripCancellation[]> {
    const prismaCancellations = await this.prisma.tripCancellation.findMany({
      where: { tripId },
      orderBy: { ts: 'desc' },
    });

    return prismaCancellations.map(cancellation => ({
      id: cancellation.id,
      tripId: cancellation.tripId,
      side: cancellation.side,
      reason: cancellation.reason,
      secondsSinceAssign: cancellation.secondsSinceAssign ?? undefined,
      feeAppliedDec: cancellation.feeAppliedDec ? Number(cancellation.feeAppliedDec) : undefined,
      ts: cancellation.ts,
    }));
  }

  private mapCancelSideToPrisma(side: string): TripCancelSide {
    if (side === CancelSide.RIDER || side === 'rider') return TripCancelSide.rider;
    if (side === CancelSide.DRIVER || side === 'driver') return TripCancelSide.driver;
    if (side === CancelSide.SYSTEM || side === 'system') return TripCancelSide.system;
    return TripCancelSide.system;
  }

  private mapCancelReasonToPrisma(reason: string): TripCancelReason {
    const reasonMap: Record<string, TripCancelReason> = {
      [CancelReason.RIDER_CANCELLED]: TripCancelReason.RIDER_CANCELLED,
      [CancelReason.DRIVER_CANCELLED]: TripCancelReason.DRIVER_CANCELLED,
      [CancelReason.NO_SHOW]: TripCancelReason.NO_SHOW,
      [CancelReason.SYSTEM_TIMEOUT]: TripCancelReason.SYSTEM_TIMEOUT,
      [CancelReason.REASSIGN_EXHAUSTED]: TripCancelReason.REASSIGN_EXHAUSTED,
    };
    return reasonMap[reason] || TripCancelReason.SYSTEM_TIMEOUT;
  }
}
