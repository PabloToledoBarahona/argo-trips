import { VerifyPinDto, VerifyPinResponseDto } from './verify-pin.dto.js';
import { TripPrismaRepository } from '../../infrastructure/persistence/prisma/trip-prisma.repository.js';
import { TripAuditPrismaRepository } from '../../infrastructure/persistence/prisma/trip-audit-prisma.repository.js';
import { PinCacheService } from '../../infrastructure/redis/pin-cache.service.js';
import { TimerService } from '../../infrastructure/redis/timer.service.js';
export declare class VerifyPinUseCase {
    private readonly tripRepository;
    private readonly auditRepository;
    private readonly pinCacheService;
    private readonly timerService;
    private readonly logger;
    private readonly DRIVER_NO_SHOW_SECONDS;
    constructor(tripRepository: TripPrismaRepository, auditRepository: TripAuditPrismaRepository, pinCacheService: PinCacheService, timerService: TimerService);
    execute(dto: VerifyPinDto): Promise<VerifyPinResponseDto>;
}
