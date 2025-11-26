import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service.js';

export interface TripPoint {
  id: string;
  tripId: string;
  lat: number;
  lng: number;
  timestamp: Date;
  source: string;
  metadata?: any;
}

@Injectable()
export class TripPointsPrismaRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(point: Omit<TripPoint, 'id'>): Promise<TripPoint> {
    // TODO: Implement create logic
    throw new Error('Not implemented');
  }

  async findByTripId(tripId: string): Promise<TripPoint[]> {
    // TODO: Implement findByTripId logic
    throw new Error('Not implemented');
  }
}
