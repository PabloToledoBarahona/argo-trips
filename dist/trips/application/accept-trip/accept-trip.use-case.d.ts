import { AcceptTripDto, AcceptTripResponseDto } from './accept-trip.dto.js';
import { TripPrismaRepository } from '../../infrastructure/persistence/prisma/trip-prisma.repository.js';
import { TripAuditPrismaRepository } from '../../infrastructure/persistence/prisma/trip-audit-prisma.repository.js';
import { DriverSessionsClient } from '../../infrastructure/http-clients/driver-sessions.client.js';
import { GeoClient } from '../../infrastructure/http-clients/geo.client.js';
import { PinCacheService } from '../../infrastructure/redis/pin-cache.service.js';
import { TimerService } from '../../infrastructure/redis/timer.service.js';
export declare class AcceptTripUseCase {
    private readonly tripRepository;
    private readonly auditRepository;
    private readonly driverSessionsClient;
    private readonly geoClient;
    private readonly pinCacheService;
    private readonly timerService;
    private readonly logger;
    private readonly PIN_TTL_SECONDS;
    private readonly RIDER_NO_SHOW_SECONDS;
    constructor(tripRepository: TripPrismaRepository, auditRepository: TripAuditPrismaRepository, driverSessionsClient: DriverSessionsClient, geoClient: GeoClient, pinCacheService: PinCacheService, timerService: TimerService);
    execute(dto: AcceptTripDto): Promise<AcceptTripResponseDto>;
    private generatePin;
}
