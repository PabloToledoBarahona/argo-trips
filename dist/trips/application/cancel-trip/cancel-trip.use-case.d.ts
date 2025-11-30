import { CancelTripDto, CancelTripResponseDto } from './cancel-trip.dto.js';
import { TripPrismaRepository } from '../../infrastructure/persistence/prisma/trip-prisma.repository.js';
import { TripAuditPrismaRepository } from '../../infrastructure/persistence/prisma/trip-audit-prisma.repository.js';
import { TripCancellationsPrismaRepository } from '../../infrastructure/persistence/prisma/trip-cancellations-prisma.repository.js';
import { PinCacheService } from '../../infrastructure/redis/pin-cache.service.js';
import { TimerService } from '../../infrastructure/redis/timer.service.js';
export declare class CancelTripUseCase {
    private readonly tripRepository;
    private readonly auditRepository;
    private readonly cancellationsRepository;
    private readonly pinCacheService;
    private readonly timerService;
    private readonly logger;
    constructor(tripRepository: TripPrismaRepository, auditRepository: TripAuditPrismaRepository, cancellationsRepository: TripCancellationsPrismaRepository, pinCacheService: PinCacheService, timerService: TimerService);
    execute(dto: CancelTripDto): Promise<CancelTripResponseDto>;
}
