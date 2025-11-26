import { ConfigService } from '@nestjs/config';
import { HttpService } from '../../../shared/http/http.service.js';
export interface DriverAvailability {
    driverId: string;
    available: boolean;
    location?: {
        lat: number;
        lng: number;
    };
    vehicleType: string;
}
export declare class DriverSessionsClient {
    private readonly httpService;
    private readonly configService;
    private readonly baseUrl;
    constructor(httpService: HttpService, configService: ConfigService);
    getDriverAvailability(driverId: string): Promise<DriverAvailability>;
    findNearbyDrivers(lat: number, lng: number, vehicleType: string, radius_m: number): Promise<DriverAvailability[]>;
    notifyDriverOfTrip(driverId: string, tripId: string): Promise<void>;
}
