import { MarkPaidDto, MarkPaidResponseDto } from './mark-paid.dto.js';
import { TripPrismaRepository } from '../../infrastructure/persistence/prisma/trip-prisma.repository.js';
import { TripAuditPrismaRepository } from '../../infrastructure/persistence/prisma/trip-audit-prisma.repository.js';
import { PaymentsClient } from '../../infrastructure/http-clients/payments.client.js';
export declare class MarkPaidUseCase {
    private readonly tripRepository;
    private readonly auditRepository;
    private readonly paymentsClient;
    private readonly logger;
    constructor(tripRepository: TripPrismaRepository, auditRepository: TripAuditPrismaRepository, paymentsClient: PaymentsClient);
    execute(dto: MarkPaidDto): Promise<MarkPaidResponseDto>;
}
