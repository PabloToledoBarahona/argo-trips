import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service.js';

export interface TripAudit {
  id: string;
  tripId: string;
  action: string;
  previousStatus?: string;
  newStatus: string;
  performedBy: string;
  performedByType: string;
  metadata?: any;
  timestamp: Date;
}

@Injectable()
export class TripAuditPrismaRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(audit: Omit<TripAudit, 'id'>): Promise<TripAudit> {
    // TODO: Implement create logic
    throw new Error('Not implemented');
  }

  async findByTripId(tripId: string): Promise<TripAudit[]> {
    // TODO: Implement findByTripId logic
    throw new Error('Not implemented');
  }
}
