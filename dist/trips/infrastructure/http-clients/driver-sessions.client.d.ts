import { ConfigService } from '@nestjs/config';
import { HttpService } from '../../../shared/http/http.service.js';
export declare enum DriverSessionStatus {
    ONLINE = "ONLINE",
    OFFLINE = "OFFLINE",
    IN_TRIP = "IN_TRIP",
    PAUSED = "PAUSED"
}
export interface DriverLocation {
    lat: number;
    lng: number;
    h3_res9?: string;
    heading?: number;
    speed?: number;
    accuracy?: number;
}
export interface DriverSessionDetails {
    driverId: string;
    status: DriverSessionStatus;
    isOnline: boolean;
    isAvailable: boolean;
    city?: string;
    vehicleType?: string;
    currentLocation?: DriverLocation;
    lastHeartbeat?: string;
    sessionStartedAt?: string;
    metadata?: Record<string, any>;
}
export interface GetDriverSessionStatusResponse {
    driverId: string;
    status: DriverSessionStatus;
    isOnline: boolean;
    isAvailable: boolean;
    lastUpdate: string;
    city?: string;
    vehicleType?: string;
    location?: DriverLocation;
    metadata?: Record<string, any>;
}
export interface BatchGetDriverSessionsRequest {
    driverIds: string[];
}
export interface BatchGetDriverSessionsResponse {
    sessions: GetDriverSessionStatusResponse[];
    notFound: string[];
}
export declare class DriverSessionsClient {
    private readonly httpService;
    private readonly configService;
    private readonly logger;
    private readonly baseUrl;
    private readonly timeout;
    constructor(httpService: HttpService, configService: ConfigService);
    private getErrorMessage;
    private getErrorStack;
    getDriverSessionStatus(driverId: string): Promise<GetDriverSessionStatusResponse>;
    isDriverOnline(driverId: string): Promise<boolean>;
    isDriverAvailable(driverId: string): Promise<boolean>;
    getDriverLocation(driverId: string): Promise<DriverLocation | null>;
    batchGetDriverSessions(driverIds: string[]): Promise<BatchGetDriverSessionsResponse>;
    validateDriverForTrip(driverId: string, requiredCity?: string): Promise<{
        valid: boolean;
        reason?: string;
    }>;
}
