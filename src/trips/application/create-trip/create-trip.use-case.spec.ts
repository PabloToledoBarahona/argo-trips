import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { CreateTripUseCase } from './create-trip.use-case.js';
import { CreateTripDto, CreateTripResponseDto } from './create-trip.dto.js';
import { TripPrismaRepository } from '../../infrastructure/persistence/prisma/trip-prisma.repository.js';
import { TripAuditPrismaRepository } from '../../infrastructure/persistence/prisma/trip-audit-prisma.repository.js';
import { GeoClient } from '../../infrastructure/http-clients/geo.client.js';
import { PricingClient, QuoteResponse } from '../../infrastructure/http-clients/pricing.client.js';
import { TripStatus } from '../../domain/enums/trip-status.enum.js';
import { Trip } from '../../domain/entities/trip.entity.js';

// Mock uuid module
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'trip-123'),
}));

describe('CreateTripUseCase', () => {
  let useCase: CreateTripUseCase;
  let tripRepository: jest.Mocked<TripPrismaRepository>;
  let auditRepository: jest.Mocked<TripAuditPrismaRepository>;
  let geoClient: jest.Mocked<GeoClient>;
  let pricingClient: jest.Mocked<PricingClient>;

  const mockQuoteResponse: QuoteResponse = {
    quote_id: 'quote-123',
    currency: 'USD',
    estimate_total: 15.0,
    expires_at: '2025-12-01T14:42:30Z',
    degradation: null,
    breakdown: {
      base: 10.0,
      per_km: {
        rate: 2.5,
        distance_km: 5.0,
        amount: 12.5,
      },
      per_min: {
        rate: 0.4,
        duration_min: 10.0,
        amount: 4.0,
      },
      multipliers: {
        vehicle: 1.0,
        surge: 1.5,
        time: 1.0,
      },
      extras: [
        {
          code: 'AIRPORT_FEE',
          amount: 3.0,
          description: 'Airport surcharge',
        },
      ],
      min_fare: 10.0,
      rounded_step: 0.5,
    },
    zone: {
      h3_res7: '8728308a1ffffff',
      surge: 1.5,
    },
  };

  beforeEach(async () => {
    const mockTripRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
    };

    const mockAuditRepository = {
      create: jest.fn(),
    };

    const mockGeoClient = {
      h3Encode: jest.fn(),
      h3EncodeSingle: jest.fn(),
      route: jest.fn(),
      eta: jest.fn(),
      geocodeForward: jest.fn(),
      geocodeReverse: jest.fn(),
      onModuleInit: jest.fn(), // Add lifecycle hook
    };

    const mockPricingClient = {
      quote: jest.fn(),
      finalize: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateTripUseCase,
        { provide: TripPrismaRepository, useValue: mockTripRepository },
        { provide: TripAuditPrismaRepository, useValue: mockAuditRepository },
        { provide: GeoClient, useValue: mockGeoClient },
        { provide: PricingClient, useValue: mockPricingClient },
      ],
    }).compile();

    useCase = module.get<CreateTripUseCase>(CreateTripUseCase);
    tripRepository = module.get(TripPrismaRepository);
    auditRepository = module.get(TripAuditPrismaRepository);
    geoClient = module.get(GeoClient);
    pricingClient = module.get(PricingClient);
  });

  it('should be defined', () => {
    expect(useCase).toBeDefined();
  });

  describe('execute - happy path', () => {
    it('should create trip with full pricing details from quote', async () => {
      const dto: CreateTripDto = {
        riderId: 'rider-123',
        vehicleType: 'economy',
        city: 'New York',
        originLat: 40.7128,
        originLng: -74.006,
        originH3Res9: 'h3-origin-res9',
        destLat: 40.7589,
        destLng: -73.9851,
        destH3Res9: 'h3-dest-res9',
      };

      // Mock GeoClient responses (batch H3 encode)
      geoClient.h3Encode.mockResolvedValueOnce({
        results: [
          { op: 'encode', h3: 'h3-origin-res9' },
          { op: 'encode', h3: 'h3-origin-res7' },
          { op: 'encode', h3: 'h3-dest-res9' },
          { op: 'encode', h3: 'h3-dest-res7' },
        ],
      });
      geoClient.route.mockResolvedValue({
        engine: 'mapbox',
        duration_sec: 600,
        distance_m: 5000,
        polyline: null,
        waypoints: [
          { lat: 40.7128, lng: -74.006 },
          { lat: 40.7589, lng: -73.9851 },
        ],
        h3_path_res9: [],
        from_cache: false,
      });

      // Mock PricingClient quote
      pricingClient.quote.mockResolvedValue(mockQuoteResponse);

      // Mock repository create
      tripRepository.create.mockResolvedValue({
        id: 'trip-123',
        riderId: dto.riderId,
        vehicleType: 'economy',
        status: TripStatus.REQUESTED,
        city: dto.city,
        originLat: dto.originLat,
        originLng: dto.originLng,
        originH3Res9: dto.originH3Res9,
        destLat: dto.destLat,
        destLng: dto.destLng,
        destH3Res9: dto.destH3Res9,
        requestedAt: new Date(),
        quoteId: mockQuoteResponse.quote_id,
        distance_m_est: 5000,
        duration_s_est: 600,
        pricingSnapshot: {
          basePrice: mockQuoteResponse.breakdown.base,
          surgeMultiplier: mockQuoteResponse.zone.surge,
          totalPrice: mockQuoteResponse.estimate_total,
          currency: mockQuoteResponse.currency,
          breakdown: {
            distancePrice: mockQuoteResponse.breakdown.per_km.amount,
            timePrice: mockQuoteResponse.breakdown.per_min.amount,
            serviceFee: mockQuoteResponse.breakdown.min_fare,
            specialCharges: mockQuoteResponse.breakdown.extras.map((e) => ({
              type: e.code,
              amount: e.amount,
              description: e.description,
            })),
          },
        },
      } as Trip);

      // Mock audit create
      auditRepository.create.mockResolvedValue(undefined);

      // Execute
      const result: CreateTripResponseDto = await useCase.execute(dto);

      // Assertions
      expect(result).toBeDefined();
      expect(result.id).toBe('trip-123');
      expect(result.status).toBe(TripStatus.REQUESTED);
      expect(result.riderId).toBe(dto.riderId);
      expect(result.vehicleType).toBe('economy');
      expect(result.quoteId).toBe(mockQuoteResponse.quote_id);
      expect(result.estimateTotal).toBe(mockQuoteResponse.estimate_total);
      expect(result.basePrice).toBe(mockQuoteResponse.breakdown.base);
      expect(result.surgeMultiplier).toBe(mockQuoteResponse.zone.surge);
      expect(result.currency).toBe(mockQuoteResponse.currency);
      expect(result.degradation).toBe(mockQuoteResponse.degradation);

      // Verify PricingClient was called with correct format
      expect(pricingClient.quote).toHaveBeenCalledWith(
        expect.objectContaining({
          origin: expect.objectContaining({
            lat: dto.originLat,
            lng: dto.originLng,
          }),
          destination: expect.objectContaining({
            lat: dto.destLat,
            lng: dto.destLng,
          }),
          vehicle_type: 'economy',
          city: dto.city,
        }),
      );

      // Verify repository and audit were called
      expect(tripRepository.create).toHaveBeenCalled();
      expect(auditRepository.create).toHaveBeenCalled();
    });

    it('should create trip with fallback H3 when GeoClient fails', async () => {
      const dto: CreateTripDto = {
        riderId: 'rider-123',
        vehicleType: 'economy',
        city: 'New York',
        originLat: 40.7128,
        originLng: -74.006,
        originH3Res9: 'h3-origin-res9-fallback',
        destLat: 40.7589,
        destLng: -73.9851,
        destH3Res9: 'h3-dest-res9-fallback',
      };

      // Mock GeoClient to fail
      geoClient.h3Encode.mockRejectedValue(new Error('GeoClient unavailable'));
      geoClient.route.mockRejectedValue(new Error('GeoClient unavailable'));

      // Mock PricingClient quote with fallback
      pricingClient.quote.mockResolvedValue({
        ...mockQuoteResponse,
        distanceMeters: 4500,
        durationSeconds: 550,
      });

      // Mock repository create
      tripRepository.create.mockResolvedValue({
        id: 'trip-123',
        riderId: dto.riderId,
        vehicleType: 'economy',
        status: TripStatus.REQUESTED,
        city: dto.city,
        originLat: dto.originLat,
        originLng: dto.originLng,
        originH3Res9: dto.originH3Res9,
        destLat: dto.destLat,
        destLng: dto.destLng,
        destH3Res9: dto.destH3Res9,
        requestedAt: new Date(),
        quoteId: mockQuoteResponse.quote_id,
        distance_m_est: 4500,
        duration_s_est: 550,
        pricingSnapshot: {
          basePrice: mockQuoteResponse.breakdown.base,
          surgeMultiplier: mockQuoteResponse.zone.surge,
          totalPrice: mockQuoteResponse.estimate_total,
          currency: mockQuoteResponse.currency,
          breakdown: {
            distancePrice: mockQuoteResponse.breakdown.per_km.amount,
            timePrice: mockQuoteResponse.breakdown.per_min.amount,
            serviceFee: mockQuoteResponse.breakdown.min_fare,
            specialCharges: mockQuoteResponse.breakdown.extras.map((e) => ({
              type: e.code,
              amount: e.amount,
              description: e.description,
            })),
          },
        },
      } as Trip);

      auditRepository.create.mockResolvedValue(undefined);

      // Execute
      const result = await useCase.execute(dto);

      // Assertions
      expect(result).toBeDefined();
      expect(result.quoteId).toBe(mockQuoteResponse.quote_id);

      // Verify PricingClient was called correctly
      expect(pricingClient.quote).toHaveBeenCalledWith(
        expect.objectContaining({
          vehicle_type: 'economy',
          city: dto.city,
        }),
      );
    });

    it('should throw BadRequestException when H3 res9 is missing', async () => {
      const dto: CreateTripDto = {
        riderId: 'rider-123',
        vehicleType: 'economy',
        city: 'New York',
        originLat: 40.7128,
        originLng: -74.006,
        originH3Res9: 'h3-origin-res9',
        destLat: 40.7589,
        destLng: -73.9851,
        destH3Res9: 'h3-dest-res9',
      };

      // Mock GeoClient to fail and not return H3
      geoClient.h3Encode.mockRejectedValue(new Error('GeoClient unavailable'));
      geoClient.route.mockRejectedValue(new Error('GeoClient unavailable'));

      // Simulate missing H3 from DTO by modifying internal logic expectation
      // This test validates the error handling when both sources fail

      await expect(useCase.execute({ ...dto, originH3Res9: '' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when PricingClient fails', async () => {
      const dto: CreateTripDto = {
        riderId: 'rider-123',
        vehicleType: 'economy',
        city: 'New York',
        originLat: 40.7128,
        originLng: -74.006,
        originH3Res9: 'h3-origin-res9',
        destLat: 40.7589,
        destLng: -73.9851,
        destH3Res9: 'h3-dest-res9',
      };

      // Mock GeoClient success
      geoClient.h3Encode.mockResolvedValueOnce({
        results: [
          { op: 'encode', h3: 'h3-origin-res9' },
          { op: 'encode', h3: 'h3-origin-res7' },
          { op: 'encode', h3: 'h3-dest-res9' },
          { op: 'encode', h3: 'h3-dest-res7' },
        ],
      });
      geoClient.route.mockResolvedValue({
        engine: 'mapbox',
        duration_sec: 600,
        distance_m: 5000,
        polyline: null,
        waypoints: [
          { lat: 40.7128, lng: -74.006 },
          { lat: 40.7589, lng: -73.9851 },
        ],
        h3_path_res9: [],
        from_cache: false,
      });

      // Mock PricingClient to fail
      pricingClient.quote.mockRejectedValue(new Error('Pricing service unavailable'));

      // Execute and expect error
      await expect(useCase.execute(dto)).rejects.toThrow(BadRequestException);
    });
  });
});
