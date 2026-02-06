import { BadRequestException } from '@nestjs/common';
import { StartTripUseCase } from './start-trip.use-case.js';
import { Trip } from '../../domain/entities/trip.entity.js';
import { TripStatus } from '../../domain/enums/trip-status.enum.js';

class InMemoryTripRepository {
  private readonly trips = new Map<string, Trip>();

  async findById(id: string): Promise<Trip | null> {
    return this.trips.get(id) ?? null;
  }

  async update(id: string, patch: Partial<Trip>): Promise<Trip> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new Error(`Trip ${id} not found`);
    }
    const updated = Object.assign(existing, patch);
    this.trips.set(id, updated);
    return updated;
  }

  seed(trip: Trip) {
    this.trips.set(trip.id, trip);
  }
}

class InMemoryAuditRepository {
  async create(): Promise<void> {}
}

class NoopTimerService {
  async clearNoShow(): Promise<void> {}
}

describe('StartTripUseCase', () => {
  it('bloquea iniciar si el driver no es elegible (hard gate)', async () => {
    const tripRepository = new InMemoryTripRepository();
    const auditRepository = new InMemoryAuditRepository();
    const timerService = new NoopTimerService();

    const profilesEligibilityClient = {
      recomputeEligibility: async () => ({
        is_eligible: false,
        blocking_reasons: [{ code: 'LICENSE_EXPIRED' }],
      }),
    };

    const useCase = new StartTripUseCase(
      tripRepository as any,
      auditRepository as any,
      timerService as any,
      profilesEligibilityClient as any,
    );

    const trip = new Trip({
      id: 'trip-1',
      riderId: 'rider-1',
      vehicleType: 'comfort' as any,
      paymentMethod: 'cash' as any,
      status: TripStatus.PICKUP_STARTED,
      city: 'SCZ',
      originLat: -17.7,
      originLng: -63.1,
      originH3Res9: 'mock-origin',
      originH3Res7: 'mock-origin7',
      destLat: -17.8,
      destLng: -63.2,
      destH3Res9: 'mock-dest',
      requestedAt: new Date(),
      quoteId: 'qt_1',
      driverId: 'driver-1',
      assignedAt: new Date(),
      pickupStartedAt: new Date(),
    });
    tripRepository.seed(trip);

    await expect(
      useCase.execute({ tripId: trip.id }, { id: 'driver-1', role: 'driver' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

