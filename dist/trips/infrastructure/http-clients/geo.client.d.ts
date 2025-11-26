import { ConfigService } from '@nestjs/config';
import { HttpService } from '../../../shared/http/http.service.js';
export interface GeoDistanceRequest {
    originLat: number;
    originLng: number;
    destLat: number;
    destLng: number;
}
export interface GeoDistanceResponse {
    distance_m: number;
    duration_s: number;
}
export declare class GeoClient {
    private readonly httpService;
    private readonly configService;
    private readonly baseUrl;
    constructor(httpService: HttpService, configService: ConfigService);
    calculateDistance(request: GeoDistanceRequest): Promise<GeoDistanceResponse>;
    getH3Index(lat: number, lng: number, resolution: number): Promise<string>;
}
