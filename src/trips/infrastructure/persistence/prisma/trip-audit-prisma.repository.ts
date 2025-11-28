import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service.js';
import { ActorType } from '@prisma/client';

export interface TripAudit {
  id: string;
  tripId: string;
  action: string;
  actorType: string;
  actorId?: string;
  payload: any;
  ip?: string;
  ts: Date;
}

@Injectable()
export class TripAuditPrismaRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(audit: Omit<TripAudit, 'id' | 'ts'>): Promise<TripAudit> {
    const prismaAudit = await this.prisma.tripAudit.create({
      data: {
        tripId: audit.tripId,
        action: audit.action,
        actorType: this.mapActorTypeToPrisma(audit.actorType),
        actorId: audit.actorId,
        payload: audit.payload,
        ip: audit.ip,
      },
    });

    return {
      id: prismaAudit.id,
      tripId: prismaAudit.tripId,
      action: prismaAudit.action,
      actorType: prismaAudit.actorType,
      actorId: prismaAudit.actorId ?? undefined,
      payload: prismaAudit.payload,
      ip: prismaAudit.ip ?? undefined,
      ts: prismaAudit.ts,
    };
  }

  async findByTripId(tripId: string): Promise<TripAudit[]> {
    const prismaAudits = await this.prisma.tripAudit.findMany({
      where: { tripId },
      orderBy: { ts: 'asc' },
    });

    return prismaAudits.map(audit => ({
      id: audit.id,
      tripId: audit.tripId,
      action: audit.action,
      actorType: audit.actorType,
      actorId: audit.actorId ?? undefined,
      payload: audit.payload,
      ip: audit.ip ?? undefined,
      ts: audit.ts,
    }));
  }

  private mapActorTypeToPrisma(actorType: string): ActorType {
    const typeMap: Record<string, ActorType> = {
      'rider': ActorType.rider,
      'driver': ActorType.driver,
      'system': ActorType.system,
    };
    return typeMap[actorType] || ActorType.system;
  }
}
