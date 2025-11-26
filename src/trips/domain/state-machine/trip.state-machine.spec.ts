import { Test, TestingModule } from '@nestjs/testing';
import { TripStateMachine } from './trip.state-machine.js';
import { Trip } from '../entities/trip.entity.js';
import { TripStatus } from '../enums/trip-status.enum.js';
import { TripCommand } from '../types/trip-command.type.js';

describe('TripStateMachine', () => {
  let stateMachine: TripStateMachine;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TripStateMachine],
    }).compile();

    stateMachine = module.get<TripStateMachine>(TripStateMachine);
  });

  it('should be defined', () => {
    expect(stateMachine).toBeDefined();
  });

  it('should create a trip instance', () => {
    const trip = new Trip({
      id: 'test-trip-id',
      riderId: 'rider-1',
      vehicleType: 'sedan',
      status: TripStatus.REQUESTED,
      city: 'test-city',
      originLat: 40.7128,
      originLng: -74.006,
      originH3Res9: 'test-h3-origin',
      destLat: 40.7589,
      destLng: -73.9851,
      destH3Res9: 'test-h3-dest',
      requestedAt: new Date(),
    });

    expect(trip).toBeDefined();
    expect(trip.status).toBe(TripStatus.REQUESTED);
  });

  it('should transition from REQUESTED to OFFERED', () => {
    const trip = new Trip({
      id: 'test-trip-id',
      riderId: 'rider-1',
      vehicleType: 'sedan',
      status: TripStatus.REQUESTED,
      city: 'test-city',
      originLat: 40.7128,
      originLng: -74.006,
      originH3Res9: 'test-h3-origin',
      destLat: 40.7589,
      destLng: -73.9851,
      destH3Res9: 'test-h3-dest',
      requestedAt: new Date(),
    });

    const updatedTrip = stateMachine.transition(trip, TripCommand.OFFER, {
      quoteId: 'quote-123',
    });

    expect(updatedTrip.status).toBe(TripStatus.OFFERED);
    expect(updatedTrip.quoteId).toBe('quote-123');
    expect(updatedTrip.offeredAt).toBeDefined();
  });
});
