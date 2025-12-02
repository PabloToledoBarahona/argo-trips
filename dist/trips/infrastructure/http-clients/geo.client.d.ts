import { ConfigService } from '@nestjs/config';
import { HttpService } from '../../../shared/http/http.service.js';
export interface Coordinates {
    lat: number;
    lng: number;
}
export interface DistanceRequest {
    origin: Coordinates;
    destination: Coordinates;
}
export interface DistanceResponse {
    distanceMeters: number;
    durationSeconds: number;
}
export interface ETARequest {
    origin: Coordinates;
    destination: Coordinates;
}
export interface ETAResponse {
    etaSeconds: number;
}
export interface H3Request {
    lat: number;
    lng: number;
}
export interface H3Response {
    h3_res7?: string;
    h3_res9: string;
}
export declare class GeoClient {
    private readonly httpService;
    private readonly configService;
    private readonly logger;
    private readonly baseUrl;
    constructor(httpService: HttpService, configService: ConfigService);
    distance(origin: Coordinates, destination: Coordinates): Promise<DistanceResponse>;
    eta(origin: Coordinates, destination: Coordinates): Promise<ETAResponse>;
    h3(lat: number, lng: number): Promise<H3Response>;
}
