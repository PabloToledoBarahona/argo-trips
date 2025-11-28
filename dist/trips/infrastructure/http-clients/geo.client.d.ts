import { ConfigService } from '@nestjs/config';
import { HttpService } from '../../../shared/http/http.service.js';
export interface Coordinates {
    lat: number;
    lng: number;
}
export interface H3Location {
    lat: number;
    lng: number;
    h3_res9: string;
    h3_res7?: string;
}
export interface ValidateRadiusRequest {
    origin: Coordinates;
    driverLocation: Coordinates;
    maxDistanceMeters?: number;
}
export interface ValidateRadiusResponse {
    isWithinRadius: boolean;
    distanceMeters: number;
    maxDistanceMeters: number;
}
export interface GetETARequest {
    origin: Coordinates;
    destination: Coordinates;
    mode?: 'driving' | 'walking';
}
export interface GetETAResponse {
    etaSeconds: number;
    distanceMeters: number;
    mode: string;
}
export interface GetRouteRequest {
    origin: Coordinates;
    destination: Coordinates;
    includePoints?: boolean;
}
export interface RoutePoint {
    lat: number;
    lng: number;
    h3_res9: string;
    order: number;
}
export interface GetRouteResponse {
    distance_m_est: number;
    duration_s_est: number;
    points?: RoutePoint[];
    polyline?: string;
}
export interface H3EncodeRequest {
    lat: number;
    lng: number;
    resolution: number;
}
export interface H3EncodeResponse {
    h3Index: string;
    resolution: number;
    lat: number;
    lng: number;
}
export interface H3DecodeRequest {
    h3Index: string;
}
export interface H3DecodeResponse {
    lat: number;
    lng: number;
    resolution: number;
}
export declare class GeoClient {
    private readonly httpService;
    private readonly configService;
    private readonly logger;
    private readonly baseUrl;
    private readonly timeout;
    private readonly MAX_PICKUP_RADIUS_METERS;
    constructor(httpService: HttpService, configService: ConfigService);
    private getErrorMessage;
    private getErrorStack;
    validateRadius(request: ValidateRadiusRequest): Promise<ValidateRadiusResponse>;
    calculateDistance(origin: Coordinates, destination: Coordinates): Promise<number>;
    getETA(request: GetETARequest): Promise<GetETAResponse>;
    getRoute(request: GetRouteRequest): Promise<GetRouteResponse>;
    encodeH3(lat: number, lng: number, resolution: number): Promise<string>;
    decodeH3(h3Index: string): Promise<Coordinates>;
    batchEncodeH3(coordinates: Array<{
        lat: number;
        lng: number;
    }>, resolution: number): Promise<string[]>;
}
