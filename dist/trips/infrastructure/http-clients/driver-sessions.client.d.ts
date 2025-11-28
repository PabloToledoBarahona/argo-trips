import { ConfigService } from '@nestjs/config';
import { HttpService } from '../../../shared/http/http.service.js';
export interface DriverLocation {
    lat: number;
    lng: number;
    h3_res9: string;
}
export type VehicleType = 'economy' | 'premium' | 'delivery';
export interface DriverSessionResponse {
    driverId: string;
    isOnline: boolean;
    vehicleType: VehicleType;
    lastLocation: DriverLocation;
    lastUpdate: string;
}
export declare class DriverSessionsClient {
    private readonly httpService;
    private readonly configService;
    private readonly logger;
    private readonly baseUrl;
    constructor(httpService: HttpService, configService: ConfigService);
    getSession(driverId: string): Promise<DriverSessionResponse>;
}
