import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service.js';

export interface TripCancellation {
  id: string;
  tripId: string;
  reason: string;
  side: string;
  notes?: string;
  compensationPct?: number;
  timestamp: Date;
}

@Injectable()
export class TripCancellationsPrismaRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(cancellation: Omit<TripCancellation, 'id'>): Promise<TripCancellation> {
    // TODO: Implement create logic
    throw new Error('Not implemented');
  }

  async findByTripId(tripId: string): Promise<TripCancellation | null> {
    // TODO: Implement findByTripId logic
    throw new Error('Not implemented');
  }
}
