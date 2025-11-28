import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service.js';
import { TripPointPhase } from '@prisma/client';

export interface TripPoint {
  id: string;
  tripId: string;
  phase: string;
  lat: number;
  lng: number;
  h3Res9: string;
  speedMps?: number;
  headingDeg?: number;
  ts: Date;
}

@Injectable()
export class TripPointsPrismaRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(point: Omit<TripPoint, 'id'>): Promise<TripPoint> {
    const prismaPoint = await this.prisma.tripPoint.create({
      data: {
        tripId: point.tripId,
        phase: this.mapPhaseToPrisma(point.phase),
        lat: point.lat,
        lng: point.lng,
        h3Res9: point.h3Res9,
        speedMps: point.speedMps,
        headingDeg: point.headingDeg,
        ts: point.ts,
      },
    });

    return this.mapToDomain(prismaPoint);
  }

  async createMany(points: Omit<TripPoint, 'id'>[]): Promise<number> {
    const result = await this.prisma.tripPoint.createMany({
      data: points.map(point => ({
        tripId: point.tripId,
        phase: this.mapPhaseToPrisma(point.phase),
        lat: point.lat,
        lng: point.lng,
        h3Res9: point.h3Res9,
        speedMps: point.speedMps,
        headingDeg: point.headingDeg,
        ts: point.ts,
      })),
    });

    return result.count;
  }

  async findByTripId(tripId: string, phase?: string): Promise<TripPoint[]> {
    const where: any = { tripId };
    if (phase) {
      where.phase = this.mapPhaseToPrisma(phase);
    }

    const prismaPoints = await this.prisma.tripPoint.findMany({
      where,
      orderBy: { ts: 'asc' },
    });

    return prismaPoints.map(point => this.mapToDomain(point));
  }

  async countByTripId(tripId: string, phase?: string): Promise<number> {
    const where: any = { tripId };
    if (phase) {
      where.phase = this.mapPhaseToPrisma(phase);
    }

    return await this.prisma.tripPoint.count({ where });
  }

  private mapToDomain(prismaPoint: any): TripPoint {
    return {
      id: prismaPoint.id,
      tripId: prismaPoint.tripId,
      phase: prismaPoint.phase,
      lat: prismaPoint.lat,
      lng: prismaPoint.lng,
      h3Res9: prismaPoint.h3Res9,
      speedMps: prismaPoint.speedMps ?? undefined,
      headingDeg: prismaPoint.headingDeg ?? undefined,
      ts: prismaPoint.ts,
    };
  }

  private mapPhaseToPrisma(phase: string): TripPointPhase {
    const phaseMap: Record<string, TripPointPhase> = {
      'pickup': TripPointPhase.pickup,
      'in_progress': TripPointPhase.in_progress,
    };
    return phaseMap[phase] || TripPointPhase.in_progress;
  }
}
