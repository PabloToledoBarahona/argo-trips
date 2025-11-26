import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service.js';
import { Trip } from '../../../domain/entities/trip.entity.js';

@Injectable()
export class TripPrismaRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(trip: Trip): Promise<Trip> {
    // TODO: Implement create logic
    throw new Error('Not implemented');
  }

  async findById(id: string): Promise<Trip | null> {
    // TODO: Implement findById logic
    throw new Error('Not implemented');
  }

  async update(id: string, trip: Partial<Trip>): Promise<Trip> {
    // TODO: Implement update logic
    throw new Error('Not implemented');
  }

  async findByRiderId(riderId: string): Promise<Trip[]> {
    // TODO: Implement findByRiderId logic
    throw new Error('Not implemented');
  }

  async findByDriverId(driverId: string): Promise<Trip[]> {
    // TODO: Implement findByDriverId logic
    throw new Error('Not implemented');
  }
}
