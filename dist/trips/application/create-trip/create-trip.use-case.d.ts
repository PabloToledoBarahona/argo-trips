import { CreateTripDto, CreateTripResponseDto } from './create-trip.dto.js';
import { TripPrismaRepository } from '../../infrastructure/persistence/prisma/trip-prisma.repository.js';
import { TripAuditPrismaRepository } from '../../infrastructure/persistence/prisma/trip-audit-prisma.repository.js';
import { GeoClient } from '../../infrastructure/http-clients/geo.client.js';
import { PricingClient } from '../../infrastructure/http-clients/pricing.client.js';
export declare class CreateTripUseCase {
    private readonly tripRepository;
    private readonly auditRepository;
    private readonly geoClient;
    private readonly pricingClient;
    private readonly logger;
    constructor(tripRepository: TripPrismaRepository, auditRepository: TripAuditPrismaRepository, geoClient: GeoClient, pricingClient: PricingClient);
    execute(dto: CreateTripDto): Promise<CreateTripResponseDto>;
    private buildQuoteSnapshot;
    private formatError;
}
