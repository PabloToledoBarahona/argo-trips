import { CreateTripUseCase } from '../create-trip/create-trip.use-case.js';
import { AcceptTripUseCase } from '../accept-trip/accept-trip.use-case.js';
import { VerifyPinUseCase } from '../verify-pin/verify-pin.use-case.js';
import { StartTripUseCase } from '../start-trip/start-trip.use-case.js';
import { CompleteTripUseCase } from '../complete-trip/complete-trip.use-case.js';
import { Trip } from '../../domain/entities/trip.entity.js';
import { TripStatus } from '../../domain/enums/trip-status.enum.js';
import { PaymentMethod } from '../../domain/enums/payment-method.enum.js';
import type { QuoteResponse, FinalizeResponse } from '../../infrastructure/http-clients/pricing.client.js';

class InMemoryTripRepository {
  private readonly trips = new Map<string, Trip>();

  async create(trip: Trip): Promise<Trip> {
    this.trips.set(trip.id, trip);
    return trip;
  }

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
}

class InMemoryAuditRepository {
  public readonly entries: Array<{ tripId: string; action: string }> = [];

  async create(entry: { tripId: string; action: string }): Promise<void> {
    this.entries.push(entry);
  }
}

class InMemoryPinCacheService {
  private readonly pins = new Map<string, string>();

  async setPin(tripId: string, pin: string): Promise<void> {
    this.pins.set(tripId, pin);
  }

  async validatePin(tripId: string, pin: string): Promise<boolean> {
    return this.pins.get(tripId) === pin;
  }

  async isBlocked(): Promise<boolean> {
    return false;
  }

  async clearPin(tripId: string): Promise<void> {
    this.pins.delete(tripId);
  }

  getPin(tripId: string): string | undefined {
    return this.pins.get(tripId);
  }
}

class NoopTimerService {
  async setRiderNoShow(): Promise<void> {}
  async setDriverNoShow(): Promise<void> {}
  async clearNoShow(): Promise<void> {}
}

class MockEventBusService {
  public readonly events: Array<{ type: string; data: any }> = [];

  async publishTripEvent(event: { type: string; data: any }): Promise<void> {
    this.events.push(event);
  }
}

class MockGeoClient {
  async h3Encode(): Promise<{ results: Array<{ op: string; h3: string }> }> {
    return {
      results: [
        { op: 'encode', h3: 'mock-origin-res9' },
        { op: 'encode', h3: 'mock-origin-res7' },
        { op: 'encode', h3: 'mock-dest-res9' },
        { op: 'encode', h3: 'mock-dest-res7' },
      ],
    };
  }

  async route(): Promise<{ distance_m: number; duration_sec: number; engine: string }> {
    return { distance_m: 2500, duration_sec: 420, engine: 'mock' };
  }

  async eta(): Promise<{ pairs: Array<{ duration_sec: number; distance_m: number }>; engine: string }> {
    return { pairs: [{ duration_sec: 300, distance_m: 2000 }], engine: 'mock' };
  }
}

class MockPricingClient {
  async quote(): Promise<QuoteResponse> {
    return {
      quote_id: 'qt_mock',
      currency: 'BOB',
      estimate_total: 20.5,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      degradation: null,
      breakdown: {
        base: 6,
        per_km: { rate: 2.5, distance_km: 3, amount: 7.5 },
        per_min: { rate: 0.4, duration_min: 6, amount: 2.4 },
        multipliers: { vehicle: 1, surge: 1, time: 1 },
        extras: [],
        min_fare: 10,
        rounded_step: 0.5,
      },
      zone: { h3_res7: 'mock-h3-res7', surge: 1 },
    };
  }

  async finalize(): Promise<FinalizeResponse> {
    return {
      trip_id: 'trp_mock',
      currency: 'BOB',
      total_final: 21,
      taxes: [],
      surge_used: 1,
      min_fare_applied: false,
      cancel_fee_applied: false,
      pricing_rule_version: 'mock',
      degradation: null,
    };
  }
}

class MockPaymentsClient {
  async createIntent(): Promise<{ paymentIntentId: string; status: string; clientSecret: string }> {
    return {
      paymentIntentId: 'pi_mock',
      status: 'requires_capture',
      clientSecret: 'secret_mock',
    };
  }
}

class MockDriverSessionsClient {
  async getSession(): Promise<{
    online: boolean;
    last_loc: { lat: number; lng: number };
    eligibility: { ok: boolean; status: 'ACTIVE' };
  }> {
    return {
      online: true,
      last_loc: { lat: -17.78345, lng: -63.18117 },
      eligibility: { ok: true, status: 'ACTIVE' },
    };
  }
}

describe('Trips flow (in-memory integration)', () => {
  it('creates, assigns, verifies PIN, starts, and completes a trip', async () => {
    const tripRepository = new InMemoryTripRepository();
    const auditRepository = new InMemoryAuditRepository();
    const pinCache = new InMemoryPinCacheService();
    const timerService = new NoopTimerService();
    const eventBus = new MockEventBusService();
    const geoClient = new MockGeoClient();
    const pricingClient = new MockPricingClient();
    const paymentsClient = new MockPaymentsClient();
    const driverSessionsClient = new MockDriverSessionsClient();

    const createTrip = new CreateTripUseCase(
      tripRepository as any,
      auditRepository as any,
      geoClient as any,
      pricingClient as any,
      eventBus as any,
    );

    const acceptTrip = new AcceptTripUseCase(
      tripRepository as any,
      auditRepository as any,
      driverSessionsClient as any,
      geoClient as any,
      pinCache as any,
      timerService as any,
      eventBus as any,
    );

    const verifyPin = new VerifyPinUseCase(
      tripRepository as any,
      auditRepository as any,
      pinCache as any,
      timerService as any,
    );

    const startTrip = new StartTripUseCase(
      tripRepository as any,
      auditRepository as any,
      timerService as any,
    );

    const completeTrip = new CompleteTripUseCase(
      tripRepository as any,
      auditRepository as any,
      pricingClient as any,
      paymentsClient as any,
      eventBus as any,
    );

    const createResponse = await createTrip.execute({
      riderId: 'rider-1',
      vehicleType: 'comfort',
      city: 'SCZ',
      payment_method: PaymentMethod.CASH,
      originLat: -17.78345,
      originLng: -63.18117,
      originH3Res9: 'mock-origin-res9',
      destLat: -17.79456,
      destLng: -63.19234,
      destH3Res9: 'mock-dest-res9',
    });

    expect(createResponse.paymentMethod).toBe(PaymentMethod.CASH);

    const acceptResponse = await acceptTrip.execute({
      tripId: createResponse.id,
      driverId: 'driver-1',
    });

    expect(acceptResponse.status).toBe(TripStatus.ASSIGNED);

    const pin = pinCache.getPin(createResponse.id);
    expect(pin).toBeTruthy();

    const verifyResponse = await verifyPin.execute({
      tripId: createResponse.id,
      pin: pin || '0000',
    });

    expect(verifyResponse.verified).toBe(true);

    const startResponse = await startTrip.execute({ tripId: createResponse.id });
    expect(startResponse.status).toBe(TripStatus.IN_PROGRESS);

    const completeResponse = await completeTrip.execute({
      tripId: createResponse.id,
      distance_m_final: 3200,
      duration_s_final: 400,
    });

    expect(completeResponse.status).toBe(TripStatus.COMPLETED);
    expect(completeResponse.paymentIntentId).toBe('pi_mock');

    expect(eventBus.events.map((event) => event.type)).toEqual([
      'trip.created',
      'trip.assigned',
      'trip.completed',
    ]);
  });
});
