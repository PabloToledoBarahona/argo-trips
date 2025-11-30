import { StartTripDto, StartTripResponseDto } from './start-trip.dto.js';
import { TripPrismaRepository } from '../../infrastructure/persistence/prisma/trip-prisma.repository.js';
import { TripAuditPrismaRepository } from '../../infrastructure/persistence/prisma/trip-audit-prisma.repository.js';
import { TimerService } from '../../infrastructure/redis/timer.service.js';
export declare class StartTripUseCase {
    private readonly tripRepository;
    private readonly auditRepository;
    private readonly timerService;
    private readonly logger;
    constructor(tripRepository: TripPrismaRepository, auditRepository: TripAuditPrismaRepository, timerService: TimerService);
    execute(dto: StartTripDto): Promise<StartTripResponseDto>;
}
