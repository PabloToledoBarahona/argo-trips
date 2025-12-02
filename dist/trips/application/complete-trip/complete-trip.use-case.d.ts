import { CompleteTripDto, CompleteTripResponseDto } from './complete-trip.dto.js';
import { TripPrismaRepository } from '../../infrastructure/persistence/prisma/trip-prisma.repository.js';
import { TripAuditPrismaRepository } from '../../infrastructure/persistence/prisma/trip-audit-prisma.repository.js';
import { PricingClient } from '../../infrastructure/http-clients/pricing.client.js';
import { PaymentsClient } from '../../infrastructure/http-clients/payments.client.js';
export declare class CompleteTripUseCase {
    private readonly tripRepository;
    private readonly auditRepository;
    private readonly pricingClient;
    private readonly paymentsClient;
    private readonly logger;
    constructor(tripRepository: TripPrismaRepository, auditRepository: TripAuditPrismaRepository, pricingClient: PricingClient, paymentsClient: PaymentsClient);
    execute(dto: CompleteTripDto): Promise<CompleteTripResponseDto>;
    private buildFinalizeSnapshot;
    private formatError;
}
