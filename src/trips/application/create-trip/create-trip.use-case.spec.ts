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
    quoteId: 'quote-123',
    city: 'New York',
    vehicleType: 'economy',
    currency: 'USD',
    basePrice: 10.0,
    surgeMultiplier: 1.5,
    estimateTotal: 15.0,
    breakdown: {
      distancePrice: 8.0,
      timePrice: 5.0,
      serviceFee: 2.0,
      specialCharges: [
        {
          type: 'airport_fee',
          amount: 3.0,
          description: 'Airport surcharge',
        },
      ],
    },
    distanceMeters: 5000,
    durationSeconds: 600,
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
      h3: jest.fn(),
      distance: jest.fn(),
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

      // Mock GeoClient responses
      geoClient.h3.mockResolvedValueOnce({
        h3_res7: 'h3-origin-res7',
        h3_res9: 'h3-origin-res9',
      });
      geoClient.h3.mockResolvedValueOnce({
        h3_res7: 'h3-dest-res7',
        h3_res9: 'h3-dest-res9',
      });
      geoClient.distance.mockResolvedValue({
        distanceMeters: 5000,
        durationSeconds: 600,
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
        quoteId: mockQuoteResponse.quoteId,
        distance_m_est: 5000,
        duration_s_est: 600,
        pricingSnapshot: {
          basePrice: mockQuoteResponse.basePrice,
          surgeMultiplier: mockQuoteResponse.surgeMultiplier,
          totalPrice: mockQuoteResponse.estimateTotal,
          currency: mockQuoteResponse.currency,
          breakdown: mockQuoteResponse.breakdown,
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
      expect(result.quoteId).toBe(mockQuoteResponse.quoteId);
      expect(result.estimateTotal).toBe(mockQuoteResponse.estimateTotal);
      expect(result.basePrice).toBe(mockQuoteResponse.basePrice);
      expect(result.surgeMultiplier).toBe(mockQuoteResponse.surgeMultiplier);
      expect(result.currency).toBe(mockQuoteResponse.currency);
      expect(result.breakdown).toEqual(mockQuoteResponse.breakdown);
      expect(result.distanceMeters).toBe(mockQuoteResponse.distanceMeters);
      expect(result.durationSeconds).toBe(mockQuoteResponse.durationSeconds);

      // Verify PricingClient was called with riderId
      expect(pricingClient.quote).toHaveBeenCalledWith(
        expect.objectContaining({
          riderId: dto.riderId,
          city: dto.city,
          vehicleType: 'economy',
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
      geoClient.h3.mockRejectedValue(new Error('GeoClient unavailable'));
      geoClient.distance.mockRejectedValue(new Error('GeoClient unavailable'));

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
        quoteId: mockQuoteResponse.quoteId,
        distance_m_est: 4500,
        duration_s_est: 550,
        pricingSnapshot: {
          basePrice: mockQuoteResponse.basePrice,
          surgeMultiplier: mockQuoteResponse.surgeMultiplier,
          totalPrice: mockQuoteResponse.estimateTotal,
          currency: mockQuoteResponse.currency,
          breakdown: mockQuoteResponse.breakdown,
        },
      } as Trip);

      auditRepository.create.mockResolvedValue(undefined);

      // Execute
      const result = await useCase.execute(dto);

      // Assertions
      expect(result).toBeDefined();
      expect(result.quoteId).toBe(mockQuoteResponse.quoteId);

      // Verify PricingClient was called with fallback H3
      expect(pricingClient.quote).toHaveBeenCalledWith(
        expect.objectContaining({
          origin: expect.objectContaining({
            h3_res9: dto.originH3Res9,
          }),
          destination: expect.objectContaining({
            h3_res9: dto.destH3Res9,
          }),
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
      geoClient.h3.mockRejectedValue(new Error('GeoClient unavailable'));
      geoClient.distance.mockRejectedValue(new Error('GeoClient unavailable'));

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
      geoClient.h3.mockResolvedValueOnce({
        h3_res7: 'h3-origin-res7',
        h3_res9: 'h3-origin-res9',
      });
      geoClient.h3.mockResolvedValueOnce({
        h3_res7: 'h3-dest-res7',
        h3_res9: 'h3-dest-res9',
      });
      geoClient.distance.mockResolvedValue({
        distanceMeters: 5000,
        durationSeconds: 600,
      });

      // Mock PricingClient to fail
      pricingClient.quote.mockRejectedValue(new Error('Pricing service unavailable'));

      // Execute and expect error
      await expect(useCase.execute(dto)).rejects.toThrow(BadRequestException);
    });
  });
});
