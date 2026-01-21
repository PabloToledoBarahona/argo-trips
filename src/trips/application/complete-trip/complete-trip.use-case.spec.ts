import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CompleteTripUseCase } from './complete-trip.use-case.js';
import { CompleteTripDto, CompleteTripResponseDto } from './complete-trip.dto.js';
import { TripPrismaRepository } from '../../infrastructure/persistence/prisma/trip-prisma.repository.js';
import { TripAuditPrismaRepository } from '../../infrastructure/persistence/prisma/trip-audit-prisma.repository.js';
import { PricingClient, FinalizeResponse } from '../../infrastructure/http-clients/pricing.client.js';
import { PaymentsClient } from '../../infrastructure/http-clients/payments.client.js';
import { EventBusService } from '../../../shared/event-bus/event-bus.service.js';
import { TripStatus } from '../../domain/enums/trip-status.enum.js';
import { PaymentMethod } from '../../domain/enums/payment-method.enum.js';
import { Trip } from '../../domain/entities/trip.entity.js';

describe('CompleteTripUseCase', () => {
  let useCase: CompleteTripUseCase;
  let tripRepository: jest.Mocked<TripPrismaRepository>;
  let auditRepository: jest.Mocked<TripAuditPrismaRepository>;
  let pricingClient: jest.Mocked<PricingClient>;
  let paymentsClient: jest.Mocked<PaymentsClient>;

  const mockFinalizeResponse: FinalizeResponse = {
    trip_id: 'trip-123',
    currency: 'USD',
    total_final: 18.5,
    taxes: [
      {
        code: 'VAT',
        amount: 1.5,
        rate: 0.13,
        description: 'IVA',
      },
    ],
    surge_used: 1.5,
    min_fare_applied: false,
    cancel_fee_applied: false,
    pricing_rule_version: 'NYC-2025-12-01',
    degradation: null,
  };

  const mockTrip: Trip = {
    id: 'trip-123',
    riderId: 'rider-123',
    driverId: 'driver-456',
    vehicleType: 'economy',
    paymentMethod: PaymentMethod.CASH,
    status: TripStatus.IN_PROGRESS,
    city: 'New York',
    originLat: 40.7128,
    originLng: -74.006,
    originH3Res9: 'h3-origin-res9',
    originH3Res7: '8728308a1ffffff',
    destLat: 40.7589,
    destLng: -73.9851,
    destH3Res9: 'h3-dest-res9',
    requestedAt: new Date(),
    assignedAt: new Date(),
    inProgressAt: new Date(),
    quoteId: 'quote-123',
    distance_m_est: 5000,
    duration_s_est: 600,
    pricingSnapshot: {
      basePrice: 10.0,
      surgeMultiplier: 1.5,
      totalPrice: 15.0,
      currency: 'USD',
      breakdown: {
        distancePrice: 8.0,
        timePrice: 5.0,
        serviceFee: 2.0,
      },
    },
  } as Trip;

  beforeEach(async () => {
    const mockTripRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
    };

    const mockAuditRepository = {
      create: jest.fn(),
    };

    const mockPricingClient = {
      quote: jest.fn(),
      finalize: jest.fn(),
    };

    const mockPaymentsClient = {
      createIntent: jest.fn(),
      getIntent: jest.fn(),
    };

    const mockEventBusService = {
      publishTripEvent: jest.fn().mockResolvedValue('event-123'),
      isAvailable: jest.fn().mockReturnValue(true),
      registerHandler: jest.fn(),
      markHandlersReady: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CompleteTripUseCase,
        { provide: TripPrismaRepository, useValue: mockTripRepository },
        { provide: TripAuditPrismaRepository, useValue: mockAuditRepository },
        { provide: PricingClient, useValue: mockPricingClient },
        { provide: PaymentsClient, useValue: mockPaymentsClient },
        { provide: EventBusService, useValue: mockEventBusService },
      ],
    }).compile();

    useCase = module.get<CompleteTripUseCase>(CompleteTripUseCase);
    tripRepository = module.get(TripPrismaRepository);
    auditRepository = module.get(TripAuditPrismaRepository);
    pricingClient = module.get(PricingClient);
    paymentsClient = module.get(PaymentsClient);
  });

  it('should be defined', () => {
    expect(useCase).toBeDefined();
  });

  describe('execute - happy path', () => {
    it('should complete trip with full pricing details and create payment intent', async () => {
      const dto: CompleteTripDto = {
        tripId: 'trip-123',
        distance_m_final: 5200,
        duration_s_final: 620,
      };

      // Mock repository findById
      tripRepository.findById.mockResolvedValue(mockTrip);

      // Mock PricingClient finalize
      pricingClient.finalize.mockResolvedValue(mockFinalizeResponse);

      // Mock PaymentsClient createIntent
      paymentsClient.createIntent.mockResolvedValue({
        paymentIntentId: 'pi-123',
        status: 'requires_capture',
        clientSecret: 'secret-123',
      });

      // Mock repository update
      tripRepository.update.mockResolvedValue({
        ...mockTrip,
        status: TripStatus.COMPLETED,
        completedAt: new Date(),
        distance_m_final: dto.distance_m_final,
        duration_s_final: dto.duration_s_final,
        paymentIntentId: 'pi-123',
        pricingSnapshot: {
          basePrice: mockFinalizeResponse.basePrice,
          surgeMultiplier: mockFinalizeResponse.surgeMultiplier,
          totalPrice: mockFinalizeResponse.totalPrice,
          currency: mockFinalizeResponse.currency,
          breakdown: mockFinalizeResponse.breakdown,
          taxes: mockFinalizeResponse.taxes,
        },
      } as Trip);

      // Mock audit create
      auditRepository.create.mockResolvedValue(undefined);

      // Execute
      const result: CompleteTripResponseDto = await useCase.execute(dto);

      // Assertions
      expect(result).toBeDefined();
      expect(result.id).toBe('trip-123');
      expect(result.status).toBe(TripStatus.COMPLETED);
      expect(result.completedAt).toBeDefined();
      expect(result.distance_m_final).toBe(dto.distance_m_final);
      expect(result.duration_s_final).toBe(dto.duration_s_final);
      expect(result.totalPrice).toBe(mockFinalizeResponse.total_final);
      expect(result.surgeMultiplier).toBe(mockFinalizeResponse.surge_used);
      expect(result.currency).toBe(mockFinalizeResponse.currency);
      expect(result.taxes).toEqual(mockFinalizeResponse.taxes);
      expect(result.min_fare_applied).toBe(mockFinalizeResponse.min_fare_applied);
      expect(result.cancel_fee_applied).toBe(mockFinalizeResponse.cancel_fee_applied);
      expect(result.pricing_rule_version).toBe(mockFinalizeResponse.pricing_rule_version);
      expect(result.degradation).toBe(mockFinalizeResponse.degradation);
      expect(result.paymentIntentId).toBe('pi-123');

      // Verify PricingClient finalize was called with MS06 format
      expect(pricingClient.finalize).toHaveBeenCalledWith({
        trip_id: mockTrip.id,
        quote_id: mockTrip.quoteId,
        vehicle_type: 'economy',
        h3_res7: mockTrip.originH3Res7,
        distance_m_final: dto.distance_m_final,
        duration_s_final: dto.duration_s_final,
        city: mockTrip.city,
        status: 'completed',
      });

      // Verify PaymentsClient was called with total_final and payment method from trip
      expect(paymentsClient.createIntent).toHaveBeenCalledWith({
        tripId: mockTrip.id,
        amount: mockFinalizeResponse.total_final,
        currency: mockFinalizeResponse.currency,
        method: PaymentMethod.CASH,
      });

      // Verify audit log includes correct pricing fields
      expect(auditRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tripId: mockTrip.id,
          payload: expect.objectContaining({
            totalPrice: mockFinalizeResponse.total_final,
            surgeMultiplier: mockFinalizeResponse.surge_used,
            paymentIntentId: 'pi-123',
            min_fare_applied: mockFinalizeResponse.min_fare_applied,
            degradation: mockFinalizeResponse.degradation,
          }),
        }),
      );
    });

    it('should use fallback metrics when final metrics not provided', async () => {
      const dto: CompleteTripDto = {
        tripId: 'trip-123',
      };

      // Mock repository findById
      tripRepository.findById.mockResolvedValue(mockTrip);

      // Mock PricingClient finalize
      pricingClient.finalize.mockResolvedValue(mockFinalizeResponse);

      // Mock PaymentsClient createIntent
      paymentsClient.createIntent.mockResolvedValue({
        paymentIntentId: 'pi-123',
        status: 'requires_capture',
        clientSecret: 'secret-123',
      });

      // Mock repository update
      tripRepository.update.mockResolvedValue({
        ...mockTrip,
        status: TripStatus.COMPLETED,
        completedAt: new Date(),
        distance_m_final: mockTrip.distance_m_est,
        duration_s_final: mockTrip.duration_s_est,
        paymentIntentId: 'pi-123',
      } as Trip);

      auditRepository.create.mockResolvedValue(undefined);

      // Execute
      const result = await useCase.execute(dto);

      // Assertions - should use estimated metrics as fallback
      expect(result.distance_m_final).toBe(mockTrip.distance_m_est);
      expect(result.duration_s_final).toBe(mockTrip.duration_s_est);

      // Verify PricingClient was called with fallback values
      expect(pricingClient.finalize).toHaveBeenCalledWith(
        expect.objectContaining({
          distance_m_final: mockTrip.distance_m_est,
          duration_s_final: mockTrip.duration_s_est,
        }),
      );
    });

    it('should throw NotFoundException when trip not found', async () => {
      const dto: CompleteTripDto = {
        tripId: 'non-existent-trip',
      };

      tripRepository.findById.mockResolvedValue(null);

      await expect(useCase.execute(dto)).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when trip is not IN_PROGRESS', async () => {
      const dto: CompleteTripDto = {
        tripId: 'trip-123',
      };

      const wrongStatusTrip = { ...mockTrip, status: TripStatus.REQUESTED };
      tripRepository.findById.mockResolvedValue(wrongStatusTrip);

      await expect(useCase.execute(dto)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when quoteId is missing', async () => {
      const dto: CompleteTripDto = {
        tripId: 'trip-123',
      };

      const tripWithoutQuote = { ...mockTrip, quoteId: undefined };
      tripRepository.findById.mockResolvedValue(tripWithoutQuote);

      await expect(useCase.execute(dto)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when pricing finalize fails', async () => {
      const dto: CompleteTripDto = {
        tripId: 'trip-123',
        distance_m_final: 5200,
        duration_s_final: 620,
      };

      tripRepository.findById.mockResolvedValue(mockTrip);
      pricingClient.finalize.mockRejectedValue(new Error('Pricing service unavailable'));

      await expect(useCase.execute(dto)).rejects.toThrow(BadRequestException);
    });
  });
});
