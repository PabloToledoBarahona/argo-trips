import { OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '../../../shared/http/http.service.js';
import { ServiceTokenService } from '../../../shared/auth/services/service-token.service.js';
import { TokenBucketRateLimiter } from '../../../shared/rate-limiter/token-bucket.rate-limiter.js';
import { H3CacheService } from '../../../shared/cache/h3-cache.service.js';
export interface Coordinate {
    lat: number;
    lng: number;
}
export type GeoVehicleProfile = 'car' | 'moto';
export type GeoEngine = 'mapbox' | 'mapbox-matrix' | 'heuristic' | 'fallback';
export type GeoDegradationMode = 'NO_ROUTER' | 'NO_GEOCODER' | null;
export interface EtaRequest {
    origins: Coordinate[];
    destinations: Coordinate[];
    profile: GeoVehicleProfile;
    city: string;
    hour_bucket?: string;
}
export interface EtaPair {
    o: number;
    d: number;
    duration_sec: number;
    distance_m: number;
    from_cache: boolean;
}
export interface EtaResponse {
    engine: 'mapbox-matrix' | 'heuristic';
    pairs: EtaPair[];
    degradation: GeoDegradationMode;
}
export interface RouteRequest {
    origin: Coordinate;
    destination: Coordinate;
    profile: GeoVehicleProfile;
    city: string;
    include_polyline?: boolean;
    alternatives?: number;
}
export interface RouteResponse {
    engine: 'mapbox' | 'heuristic';
    duration_sec: number;
    distance_m: number;
    polyline: string | null;
    waypoints: Coordinate[];
    h3_path_res9: string[];
    from_cache: boolean;
    degradation?: GeoDegradationMode;
}
export interface H3EncodeOperation {
    op: 'encode';
    lat: number;
    lng: number;
    res?: number;
}
export interface H3KRingOperation {
    op: 'kRing';
    h3: string;
    k?: number;
}
export type H3Operation = H3EncodeOperation | H3KRingOperation;
export interface H3Request {
    ops: H3Operation[];
}
export interface H3EncodeResult {
    op: 'encode';
    h3: string;
}
export interface H3KRingResult {
    op: 'kRing';
    cells: string[];
}
export interface H3ErrorResult {
    op: string;
    error: string;
}
export type H3Result = H3EncodeResult | H3KRingResult | H3ErrorResult;
export interface H3Response {
    results: H3Result[];
}
export interface GeocodeForwardRequest {
    query: string;
    city: string;
    country: string;
    limit?: number;
}
export interface GeocodeResult {
    lat: number;
    lng: number;
    label: string;
    h3_res9: string;
}
export interface GeocodeForwardResponse {
    engine: 'mapbox' | 'fallback';
    results: GeocodeResult[];
    from_cache: boolean;
    degradation?: GeoDegradationMode;
}
export interface GeocodeReverseRequest {
    lat: number;
    lng: number;
    lang?: 'es' | 'en' | 'pt';
}
export interface GeocodeReverseResponse {
    engine: 'mapbox' | 'fallback';
    label: string;
    h3_res9: string;
    from_cache: boolean;
    degradation?: GeoDegradationMode;
}
export declare class GeoClient implements OnModuleInit {
    private readonly httpService;
    private readonly configService;
    private readonly serviceTokenService;
    private readonly rateLimiter;
    private readonly h3Cache;
    private readonly logger;
    private readonly baseUrl;
    private readonly ETA_TIMEOUT_MS;
    private readonly ROUTE_TIMEOUT_MS;
    private readonly GEOCODE_TIMEOUT_MS;
    private readonly H3_TIMEOUT_MS;
    private readonly etaCircuitBreaker;
    private readonly routeCircuitBreaker;
    private readonly h3CircuitBreaker;
    private readonly geocodeCircuitBreaker;
    constructor(httpService: HttpService, configService: ConfigService, serviceTokenService: ServiceTokenService, rateLimiter: TokenBucketRateLimiter, h3Cache: H3CacheService);
    onModuleInit(): void;
    eta(request: EtaRequest): Promise<EtaResponse>;
    route(request: RouteRequest): Promise<RouteResponse>;
    h3Encode(request: H3Request): Promise<H3Response>;
    h3EncodeSingle(lat: number, lng: number, res?: number): Promise<string>;
    geocodeForward(request: GeocodeForwardRequest): Promise<GeocodeForwardResponse>;
    geocodeReverse(request: GeocodeReverseRequest): Promise<GeocodeReverseResponse>;
    private validateEtaRequest;
    private validateRouteRequest;
    private validateH3Request;
    private validateGeocodeForwardRequest;
    private validateGeocodeReverseRequest;
    private validateCoordinate;
    private validateEtaResponse;
    private validateRouteResponse;
    private validateH3Response;
    private validateGeocodeForwardResponse;
    private validateGeocodeReverseResponse;
}
