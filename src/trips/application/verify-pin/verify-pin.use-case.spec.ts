import { ForbiddenException } from '@nestjs/common';
import { VerifyPinUseCase } from './verify-pin.use-case.js';
import { Trip } from '../../domain/entities/trip.entity.js';
import { TripStatus } from '../../domain/enums/trip-status.enum.js';
import { PaymentMethod } from '../../domain/enums/payment-method.enum.js';

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
  readonly entries: any[] = [];

  async create(entry: any): Promise<void> {
    this.entries.push(entry);
  }
}

class InMemoryPinCacheService {
  private readonly pins = new Map<string, string>();

  async isBlocked(): Promise<boolean> {
    return false;
  }

  async validatePin(tripId: string, pin: string): Promise<boolean> {
    return this.pins.get(tripId) === pin;
  }

  async clearPin(tripId: string): Promise<void> {
    this.pins.delete(tripId);
  }

  seedPin(tripId: string, pin: string) {
    this.pins.set(tripId, pin);
  }
}

class NoopTimerService {
  async clearNoShow(): Promise<void> {}
  async setDriverNoShow(): Promise<void> {}
}

describe('VerifyPinUseCase', () => {
  const makeTrip = () =>
    new Trip({
      id: 'trip-1',
      riderId: 'rider-1',
      driverId: 'driver-1',
      vehicleType: 'economy',
      paymentMethod: PaymentMethod.CASH,
      status: TripStatus.ASSIGNED,
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
      assignedAt: new Date(),
    });

  it('permite al driver asignado verificar el pin y audita al actor correcto', async () => {
    const tripRepository = new InMemoryTripRepository();
    const auditRepository = new InMemoryAuditRepository();
    const pinCacheService = new InMemoryPinCacheService();
    const timerService = new NoopTimerService();

    const useCase = new VerifyPinUseCase(
      tripRepository as any,
      auditRepository as any,
      pinCacheService as any,
      timerService as any,
    );

    const trip = makeTrip();
    tripRepository.seed(trip);
    pinCacheService.seedPin(trip.id, '3997');

    const result = await useCase.execute(
      { tripId: trip.id, pin: '3997' },
      { id: 'driver-1', role: 'driver' },
    );

    expect(result).toEqual({ verified: true, tripId: trip.id });
    expect((await tripRepository.findById(trip.id))?.status).toBe(
      TripStatus.PICKUP_STARTED,
    );
    expect(auditRepository.entries).toHaveLength(1);
    expect(auditRepository.entries[0]).toEqual(
      expect.objectContaining({
        actorType: 'driver',
        actorId: 'driver-1',
      }),
    );
  });

  it('rechaza verificacion de un driver que no esta asignado al viaje', async () => {
    const tripRepository = new InMemoryTripRepository();
    const auditRepository = new InMemoryAuditRepository();
    const pinCacheService = new InMemoryPinCacheService();
    const timerService = new NoopTimerService();

    const useCase = new VerifyPinUseCase(
      tripRepository as any,
      auditRepository as any,
      pinCacheService as any,
      timerService as any,
    );

    const trip = makeTrip();
    tripRepository.seed(trip);
    pinCacheService.seedPin(trip.id, '3997');

    await expect(
      useCase.execute(
        { tripId: trip.id, pin: '3997' },
        { id: 'driver-2', role: 'driver' },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
