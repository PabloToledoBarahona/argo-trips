import { OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '../../../shared/http/http.service.js';
import { ServiceTokenService } from '../../../shared/auth/services/service-token.service.js';
import { TokenBucketRateLimiter } from '../../../shared/rate-limiter/token-bucket.rate-limiter.js';
export interface DriverLastLocation {
    lat: number;
    lng: number;
    h3_res9: string;
    speed_mps: number;
    heading_deg: number;
    ts: string;
}
export interface DriverEligibility {
    ok: boolean;
    status: 'ACTIVE' | 'SUSPENDED' | 'INACTIVE';
}
export interface DriverSessionResponse {
    driver_id: string;
    online: boolean;
    last_loc: DriverLastLocation | null;
    trip_id: string | null;
    eligibility: DriverEligibility;
}
export interface NearbyDriversRequest {
    h3: string;
    k?: number;
    limit?: number;
}
export interface NearbyDriversResponse {
    drivers: string[];
    queried_cells: string[];
}
export declare class DriverSessionsClient implements OnModuleInit {
    private readonly httpService;
    private readonly configService;
    private readonly serviceTokenService;
    private readonly rateLimiter;
    private readonly logger;
    private readonly baseUrl;
    private readonly sessionCircuitBreaker;
    private readonly nearbyCircuitBreaker;
    private readonly SESSION_TIMEOUT_MS;
    private readonly NEARBY_TIMEOUT_MS;
    constructor(httpService: HttpService, configService: ConfigService, serviceTokenService: ServiceTokenService, rateLimiter: TokenBucketRateLimiter);
    onModuleInit(): void;
    getSession(driverId: string): Promise<DriverSessionResponse>;
    findNearbyDrivers(request: NearbyDriversRequest): Promise<NearbyDriversResponse>;
    private validateDriverId;
    private validateSessionResponse;
    private validateNearbyRequest;
    private validateNearbyResponse;
}
