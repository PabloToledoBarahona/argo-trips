import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service.js';
import { Trip, PricingSnapshot } from '../../../domain/entities/trip.entity.js';
import { TripStatus } from '../../../domain/enums/trip-status.enum.js';
import { CancelReason } from '../../../domain/enums/cancel-reason.enum.js';
import { CancelSide } from '../../../domain/enums/cancel-side.enum.js';
import { PaymentMethod } from '../../../domain/enums/payment-method.enum.js';
import {
  PaymentMethod as PrismaPaymentMethod,
  Prisma,
  Trip as PrismaTrip,
  TripCancelReason,
  TripCancelSide,
  TripStatus as PrismaTripStatus,
} from '@prisma/client';

export interface TripListFilters {
  status?: TripStatus;
  city?: string;
  driverId?: string;
  riderId?: string;
  from?: Date;
  to?: Date;
  page?: number;
  limit?: number;
}

@Injectable()
export class TripPrismaRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(trip: Trip): Promise<Trip> {
    const data: any = {
      id: trip.id,
      riderId: trip.riderId,
      driverId: trip.driverId,
      vehicleType: trip.vehicleType,
      paymentMethod: this.mapPaymentMethodToPrisma(trip.paymentMethod),
      status: this.mapStatusToPrisma(trip.status),
      city: trip.city,
      originLat: trip.originLat,
      originLng: trip.originLng,
      originH3Res9: trip.originH3Res9,
      destLat: trip.destLat,
      destLng: trip.destLng,
      destH3Res9: trip.destH3Res9,
      requestedAt: trip.requestedAt,
      offeredAt: trip.offeredAt,
      assignedAt: trip.assignedAt,
      pickupStartedAt: trip.pickupStartedAt,
      inProgressAt: trip.inProgressAt,
      completedAt: trip.completedAt,
      paidAt: trip.paidAt,
      quoteId: trip.quoteId,
      cancelReason: trip.cancelReason ? this.mapCancelReasonToPrisma(trip.cancelReason) : null,
      cancelSide: trip.cancelSide ? this.mapCancelSideToPrisma(trip.cancelSide) : null,
      cancelAt: trip.cancelAt,
    };

    if (trip.pricingSnapshot !== undefined) data.pricingSnapshot = trip.pricingSnapshot as any;
    if (trip.paymentIntentId !== undefined) data.paymentIntentId = trip.paymentIntentId;
    if (trip.distance_m_est !== undefined) data.distanceMEst = trip.distance_m_est;
    if (trip.duration_s_est !== undefined) data.durationSEst = trip.duration_s_est;
    if (trip.distance_m_final !== undefined) data.distanceMFinal = trip.distance_m_final;
    if (trip.duration_s_final !== undefined) data.durationSFinal = trip.duration_s_final;

    const prismaTrip = await this.prisma.trip.create({ data });

    return this.mapToDomain(prismaTrip);
  }

  async findById(id: string): Promise<Trip | null> {
    const prismaTrip = await this.prisma.trip.findUnique({
      where: { id },
    });

    if (!prismaTrip) {
      return null;
    }

    return this.mapToDomain(prismaTrip);
  }

  async update(id: string, trip: Partial<Trip>): Promise<Trip> {
    const updateData: any = {};

    if (trip.driverId !== undefined) updateData.driverId = trip.driverId;
    if (trip.status !== undefined) updateData.status = this.mapStatusToPrisma(trip.status);
    if (trip.offeredAt !== undefined) updateData.offeredAt = trip.offeredAt;
    if (trip.assignedAt !== undefined) updateData.assignedAt = trip.assignedAt;
    if (trip.pickupStartedAt !== undefined) updateData.pickupStartedAt = trip.pickupStartedAt;
    if (trip.inProgressAt !== undefined) updateData.inProgressAt = trip.inProgressAt;
    if (trip.completedAt !== undefined) updateData.completedAt = trip.completedAt;
    if (trip.paidAt !== undefined) updateData.paidAt = trip.paidAt;
    if (trip.quoteId !== undefined) updateData.quoteId = trip.quoteId;
    if (trip.pricingSnapshot !== undefined) updateData.pricingSnapshot = trip.pricingSnapshot as any;
    if (trip.paymentIntentId !== undefined) updateData.paymentIntentId = trip.paymentIntentId;
    if (trip.distance_m_est !== undefined) updateData.distanceMEst = trip.distance_m_est;
    if (trip.duration_s_est !== undefined) updateData.durationSEst = trip.duration_s_est;
    if (trip.distance_m_final !== undefined) updateData.distanceMFinal = trip.distance_m_final;
    if (trip.duration_s_final !== undefined) updateData.durationSFinal = trip.duration_s_final;
    if (trip.cancelReason !== undefined) updateData.cancelReason = trip.cancelReason ? this.mapCancelReasonToPrisma(trip.cancelReason) : null;
    if (trip.cancelSide !== undefined) updateData.cancelSide = trip.cancelSide ? this.mapCancelSideToPrisma(trip.cancelSide) : null;
    if (trip.cancelAt !== undefined) updateData.cancelAt = trip.cancelAt;

    const prismaTrip = await this.prisma.trip.update({
      where: { id },
      data: updateData,
    });

    return this.mapToDomain(prismaTrip);
  }

  async findByRiderId(riderId: string): Promise<Trip[]> {
    const prismaTrips = await this.prisma.trip.findMany({
      where: { riderId },
      orderBy: { requestedAt: 'desc' },
    });

    return prismaTrips.map(trip => this.mapToDomain(trip));
  }

  async findByDriverId(driverId: string): Promise<Trip[]> {
    const prismaTrips = await this.prisma.trip.findMany({
      where: { driverId },
      orderBy: { assignedAt: 'desc' },
    });

    return prismaTrips.map(trip => this.mapToDomain(trip));
  }

  async findMany(filters: TripListFilters): Promise<{ trips: Trip[]; total: number }> {
    const page = filters.page && filters.page > 0 ? filters.page : 1;
    const limitRaw = filters.limit && filters.limit > 0 ? filters.limit : 20;
    const limit = Math.min(limitRaw, 100);
    const skip = (page - 1) * limit;

    const where: Prisma.TripWhereInput = {};

    if (filters.status) {
      where.status = filters.status as PrismaTripStatus;
    }
    if (filters.city) {
      where.city = filters.city;
    }
    if (filters.driverId) {
      where.driverId = filters.driverId;
    }
    if (filters.riderId) {
      where.riderId = filters.riderId;
    }
    if (filters.from || filters.to) {
      where.requestedAt = {
        gte: filters.from,
        lte: filters.to,
      };
    }

    const [total, prismaTrips] = await this.prisma.$transaction([
      this.prisma.trip.count({ where }),
      this.prisma.trip.findMany({
        where,
        orderBy: { requestedAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return {
      total,
      trips: prismaTrips.map((trip) => this.mapToDomain(trip)),
    };
  }

  private mapToDomain(prismaTrip: PrismaTrip): Trip {
    return new Trip({
      id: prismaTrip.id,
      riderId: prismaTrip.riderId,
      driverId: prismaTrip.driverId ?? undefined,
      vehicleType: prismaTrip.vehicleType,
      paymentMethod: this.mapPaymentMethodToDomain(prismaTrip.paymentMethod),
      status: this.mapStatusToDomain(prismaTrip.status),
      city: prismaTrip.city,
      originLat: prismaTrip.originLat,
      originLng: prismaTrip.originLng,
      originH3Res9: prismaTrip.originH3Res9,
      destLat: prismaTrip.destLat,
      destLng: prismaTrip.destLng,
      destH3Res9: prismaTrip.destH3Res9,
      requestedAt: prismaTrip.requestedAt,
      offeredAt: prismaTrip.offeredAt ?? undefined,
      assignedAt: prismaTrip.assignedAt ?? undefined,
      pickupStartedAt: prismaTrip.pickupStartedAt ?? undefined,
      inProgressAt: prismaTrip.inProgressAt ?? undefined,
      completedAt: prismaTrip.completedAt ?? undefined,
      paidAt: prismaTrip.paidAt ?? undefined,
      quoteId: prismaTrip.quoteId ?? undefined,
      pricingSnapshot: prismaTrip.pricingSnapshot ? (prismaTrip.pricingSnapshot as unknown as PricingSnapshot) : undefined,
      paymentIntentId: prismaTrip.paymentIntentId ?? undefined,
      distance_m_est: prismaTrip.distanceMEst ?? undefined,
      duration_s_est: prismaTrip.durationSEst ?? undefined,
      distance_m_final: prismaTrip.distanceMFinal ?? undefined,
      duration_s_final: prismaTrip.durationSFinal ?? undefined,
      cancelReason: prismaTrip.cancelReason ? this.mapCancelReasonToDomain(prismaTrip.cancelReason) : undefined,
      cancelSide: prismaTrip.cancelSide ? this.mapCancelSideToDomain(prismaTrip.cancelSide) : undefined,
      cancelAt: prismaTrip.cancelAt ?? undefined,
    });
  }

  private mapStatusToPrisma(status: TripStatus): PrismaTripStatus {
    return status as unknown as PrismaTripStatus;
  }

  private mapStatusToDomain(status: PrismaTripStatus): TripStatus {
    return status as unknown as TripStatus;
  }

  private mapCancelReasonToPrisma(reason: CancelReason): TripCancelReason {
    return reason as unknown as TripCancelReason;
  }

  private mapCancelReasonToDomain(reason: TripCancelReason): CancelReason {
    return reason as unknown as CancelReason;
  }

  private mapCancelSideToPrisma(side: CancelSide): TripCancelSide {
    const sideMap: Record<CancelSide, TripCancelSide> = {
      [CancelSide.RIDER]: 'rider' as TripCancelSide,
      [CancelSide.DRIVER]: 'driver' as TripCancelSide,
      [CancelSide.SYSTEM]: 'system' as TripCancelSide,
    };
    return sideMap[side];
  }

  private mapCancelSideToDomain(side: TripCancelSide): CancelSide {
    const sideMap: Record<TripCancelSide, CancelSide> = {
      'rider': CancelSide.RIDER,
      'driver': CancelSide.DRIVER,
      'system': CancelSide.SYSTEM,
    };
    return sideMap[side];
  }

  private mapPaymentMethodToPrisma(method: PaymentMethod): PrismaPaymentMethod {
    const methodMap: Record<PaymentMethod, PrismaPaymentMethod> = {
      [PaymentMethod.CASH]: 'cash' as PrismaPaymentMethod,
      [PaymentMethod.QR]: 'qr' as PrismaPaymentMethod,
    };
    return methodMap[method];
  }

  private mapPaymentMethodToDomain(method: PrismaPaymentMethod): PaymentMethod {
    const methodMap: Record<PrismaPaymentMethod, PaymentMethod> = {
      'cash': PaymentMethod.CASH,
      'qr': PaymentMethod.QR,
    };
    return methodMap[method];
  }
}
