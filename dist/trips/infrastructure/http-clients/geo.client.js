"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var GeoClient_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.GeoClient = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const http_service_js_1 = require("../../../shared/http/http.service.js");
const service_token_service_js_1 = require("../../../shared/auth/services/service-token.service.js");
const token_bucket_rate_limiter_js_1 = require("../../../shared/rate-limiter/token-bucket.rate-limiter.js");
const circuit_breaker_js_1 = require("../../../shared/circuit-breaker/circuit-breaker.js");
const h3_cache_service_js_1 = require("../../../shared/cache/h3-cache.service.js");
let GeoClient = GeoClient_1 = class GeoClient {
    httpService;
    configService;
    serviceTokenService;
    rateLimiter;
    h3Cache;
    logger = new common_1.Logger(GeoClient_1.name);
    baseUrl;
    ETA_TIMEOUT_MS = 5000;
    ROUTE_TIMEOUT_MS = 8000;
    GEOCODE_TIMEOUT_MS = 2000;
    H3_TIMEOUT_MS = 5000;
    etaCircuitBreaker;
    routeCircuitBreaker;
    h3CircuitBreaker;
    geocodeCircuitBreaker;
    constructor(httpService, configService, serviceTokenService, rateLimiter, h3Cache) {
        this.httpService = httpService;
        this.configService = configService;
        this.serviceTokenService = serviceTokenService;
        this.rateLimiter = rateLimiter;
        this.h3Cache = h3Cache;
        this.baseUrl =
            this.configService.get('GEO_SERVICE_URL') ||
                'http://alb-argo-gateway-1317937741.us-east-2.elb.amazonaws.com/geo';
        this.etaCircuitBreaker = new circuit_breaker_js_1.CircuitBreaker('geo-eta', {
            failureThreshold: 5,
            successThreshold: 2,
            timeout: 60000,
            rollingWindow: 60000,
        });
        this.routeCircuitBreaker = new circuit_breaker_js_1.CircuitBreaker('geo-route', {
            failureThreshold: 5,
            successThreshold: 2,
            timeout: 60000,
            rollingWindow: 60000,
        });
        this.h3CircuitBreaker = new circuit_breaker_js_1.CircuitBreaker('geo-h3', {
            failureThreshold: 5,
            successThreshold: 2,
            timeout: 60000,
            rollingWindow: 60000,
        });
        this.geocodeCircuitBreaker = new circuit_breaker_js_1.CircuitBreaker('geo-geocode', {
            failureThreshold: 5,
            successThreshold: 2,
            timeout: 60000,
            rollingWindow: 60000,
        });
        this.logger.log(`GEO Client initialized with base URL: ${this.baseUrl}`);
    }
    onModuleInit() {
        this.rateLimiter.createBucket('geo-eta', 50, 50);
        this.rateLimiter.createBucket('geo-route', 15, 15);
        this.rateLimiter.createBucket('geo-geocode', 10, 10);
        this.rateLimiter.createBucket('geo-h3', 100, 100);
        this.logger.log('GEO Client rate limiters initialized');
    }
    async eta(request) {
        try {
            this.logger.debug(`Calculating ETA: ${request.origins.length} origins → ${request.destinations.length} destinations, profile=${request.profile}, city=${request.city}`);
            this.validateEtaRequest(request);
            await this.rateLimiter.acquire('geo-eta');
            const response = await this.etaCircuitBreaker.execute(async () => {
                const headers = await this.serviceTokenService.getServiceHeaders();
                return await this.httpService.post(`${this.baseUrl}/eta`, request, {
                    headers,
                    timeout: this.ETA_TIMEOUT_MS,
                });
            });
            this.validateEtaResponse(response);
            if (response.degradation) {
                this.logger.warn(`GEO ETA using degraded mode: engine=${response.engine}, degradation=${response.degradation}. Results may be less accurate.`);
            }
            this.logger.debug(`ETA calculated: ${response.pairs.length} pairs, engine=${response.engine}, cached=${response.pairs.some((p) => p.from_cache)}`);
            return response;
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.error(`Failed to calculate ETA: ${message}`);
            throw new Error(`GEO service ETA failed: ${message}`);
        }
    }
    async route(request) {
        try {
            this.logger.debug(`Calculating route: (${request.origin.lat},${request.origin.lng}) → (${request.destination.lat},${request.destination.lng}), profile=${request.profile}, city=${request.city}`);
            this.validateRouteRequest(request);
            await this.rateLimiter.acquire('geo-route');
            const response = await this.routeCircuitBreaker.execute(async () => {
                const headers = await this.serviceTokenService.getServiceHeaders();
                return await this.httpService.post(`${this.baseUrl}/route`, request, {
                    headers,
                    timeout: this.ROUTE_TIMEOUT_MS,
                });
            });
            this.validateRouteResponse(response);
            if (response.degradation) {
                this.logger.warn(`GEO route using degraded mode: engine=${response.engine}, degradation=${response.degradation}. Results may be less accurate.`);
            }
            this.logger.debug(`Route calculated: ${response.distance_m}m, ${response.duration_sec}s, engine=${response.engine}, cached=${response.from_cache}`);
            return response;
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.error(`Failed to calculate route: ${message}`);
            throw new Error(`GEO service route failed: ${message}`);
        }
    }
    async h3Encode(request) {
        try {
            this.logger.debug(`H3 encode batch: ${request.ops.length} operations`);
            this.validateH3Request(request);
            const results = new Array(request.ops.length).fill(null);
            const uncachedOps = [];
            const uncachedIndexMap = new Map();
            let cacheHits = 0;
            for (let i = 0; i < request.ops.length; i++) {
                const op = request.ops[i];
                if (op.op === 'encode') {
                    const res = op.res || 9;
                    const cachedH3 = this.h3Cache.get(op.lat, op.lng, res);
                    if (cachedH3) {
                        results[i] = { op: 'encode', h3: cachedH3 };
                        cacheHits++;
                    }
                    else {
                        uncachedIndexMap.set(uncachedOps.length, i);
                        uncachedOps.push(op);
                    }
                }
                else {
                    uncachedIndexMap.set(uncachedOps.length, i);
                    uncachedOps.push(op);
                }
            }
            if (cacheHits > 0) {
                this.logger.debug(`H3 cache hits: ${cacheHits}/${request.ops.length}`);
            }
            if (uncachedOps.length === 0) {
                return { results: results };
            }
            await this.rateLimiter.acquire('geo-h3');
            const response = await this.h3CircuitBreaker.execute(async () => {
                const headers = await this.serviceTokenService.getServiceHeaders();
                return await this.httpService.post(`${this.baseUrl}/h3/encode`, { ops: uncachedOps }, {
                    headers,
                    timeout: this.H3_TIMEOUT_MS,
                });
            });
            this.validateH3Response(response);
            for (let i = 0; i < uncachedOps.length; i++) {
                const op = uncachedOps[i];
                const result = response.results[i];
                const originalIndex = uncachedIndexMap.get(i);
                results[originalIndex] = result;
                if (op.op === 'encode' && result.op === 'encode' && !('error' in result)) {
                    const res = op.res || 9;
                    this.h3Cache.set(op.lat, op.lng, res, result.h3);
                }
            }
            const errors = results.filter((r) => r && 'error' in r);
            if (errors.length > 0) {
                this.logger.warn(`H3 encode had ${errors.length} errors: ${JSON.stringify(errors)}`);
            }
            this.logger.debug(`H3 encode completed: ${results.length} results (${cacheHits} from cache, ${uncachedOps.length} from service)`);
            return { results: results };
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.error(`Failed to encode H3: ${message}`);
            throw new Error(`GEO service H3 encode failed: ${message}`);
        }
    }
    async h3EncodeSingle(lat, lng, res = 9) {
        const response = await this.h3Encode({
            ops: [{ op: 'encode', lat, lng, res }],
        });
        const result = response.results[0];
        if ('error' in result) {
            throw new Error(`H3 encode failed: ${result.error}`);
        }
        if (result.op !== 'encode') {
            throw new Error(`Unexpected H3 result type: ${result.op}`);
        }
        return result.h3;
    }
    async geocodeForward(request) {
        try {
            this.logger.debug(`Geocoding forward: query="${request.query}", city=${request.city}, country=${request.country}`);
            this.validateGeocodeForwardRequest(request);
            const headers = await this.serviceTokenService.getServiceHeaders();
            const response = await this.httpService.post(`${this.baseUrl}/geocode`, request, {
                headers,
                timeout: this.GEOCODE_TIMEOUT_MS,
            });
            this.validateGeocodeForwardResponse(response);
            if (response.degradation) {
                this.logger.warn(`GEO geocode using degraded mode: engine=${response.engine}, degradation=${response.degradation}`);
            }
            this.logger.debug(`Geocode forward completed: ${response.results.length} results, engine=${response.engine}`);
            return response;
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.error(`Failed to geocode forward: ${message}`);
            throw new Error(`GEO service geocode forward failed: ${message}`);
        }
    }
    async geocodeReverse(request) {
        try {
            this.logger.debug(`Geocoding reverse: (${request.lat},${request.lng}), lang=${request.lang || 'es'}`);
            this.validateGeocodeReverseRequest(request);
            const headers = await this.serviceTokenService.getServiceHeaders();
            const response = await this.httpService.post(`${this.baseUrl}/geocode/reverse`, request, {
                headers,
                timeout: this.GEOCODE_TIMEOUT_MS,
            });
            this.validateGeocodeReverseResponse(response);
            if (response.degradation) {
                this.logger.warn(`GEO reverse geocode using degraded mode: engine=${response.engine}, degradation=${response.degradation}`);
            }
            this.logger.debug(`Geocode reverse completed: engine=${response.engine}`);
            return response;
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.error(`Failed to geocode reverse: ${message}`);
            throw new Error(`GEO service geocode reverse failed: ${message}`);
        }
    }
    validateEtaRequest(request) {
        if (!request.origins || request.origins.length === 0) {
            throw new Error('ETA request must have at least one origin');
        }
        if (!request.destinations || request.destinations.length === 0) {
            throw new Error('ETA request must have at least one destination');
        }
        if (!request.profile || !['car', 'moto'].includes(request.profile)) {
            throw new Error('ETA request must have valid profile (car or moto)');
        }
        if (!request.city || request.city.trim().length === 0) {
            throw new Error('ETA request must have city');
        }
        [...request.origins, ...request.destinations].forEach((coord, i) => {
            this.validateCoordinate(coord, `coordinate ${i}`);
        });
    }
    validateRouteRequest(request) {
        if (!request.origin) {
            throw new Error('Route request must have origin');
        }
        if (!request.destination) {
            throw new Error('Route request must have destination');
        }
        if (!request.profile || !['car', 'moto'].includes(request.profile)) {
            throw new Error('Route request must have valid profile (car or moto)');
        }
        if (!request.city || request.city.trim().length === 0) {
            throw new Error('Route request must have city');
        }
        this.validateCoordinate(request.origin, 'origin');
        this.validateCoordinate(request.destination, 'destination');
    }
    validateH3Request(request) {
        if (!request.ops || request.ops.length === 0) {
            throw new Error('H3 request must have at least one operation');
        }
        request.ops.forEach((op, i) => {
            if (op.op === 'encode') {
                if (typeof op.lat !== 'number' || typeof op.lng !== 'number') {
                    throw new Error(`H3 encode operation ${i} must have lat and lng`);
                }
                this.validateCoordinate({ lat: op.lat, lng: op.lng }, `H3 operation ${i}`);
            }
            else if (op.op === 'kRing') {
                if (!op.h3 || typeof op.h3 !== 'string') {
                    throw new Error(`H3 kRing operation ${i} must have h3 index`);
                }
            }
            else {
                throw new Error(`Unknown H3 operation type: ${op.op}`);
            }
        });
    }
    validateGeocodeForwardRequest(request) {
        if (!request.query || request.query.trim().length === 0) {
            throw new Error('Geocode forward request must have query');
        }
        if (!request.city || request.city.trim().length === 0) {
            throw new Error('Geocode forward request must have city');
        }
        if (!request.country || request.country.trim().length === 0) {
            throw new Error('Geocode forward request must have country');
        }
        if (request.limit !== undefined && (request.limit < 1 || request.limit > 10)) {
            throw new Error('Geocode forward request limit must be between 1 and 10');
        }
    }
    validateGeocodeReverseRequest(request) {
        this.validateCoordinate({ lat: request.lat, lng: request.lng }, 'geocode reverse');
        if (request.lang && !['es', 'en', 'pt'].includes(request.lang)) {
            throw new Error('Geocode reverse language must be es, en, or pt');
        }
    }
    validateCoordinate(coord, context) {
        if (typeof coord.lat !== 'number' || typeof coord.lng !== 'number') {
            throw new Error(`${context}: coordinates must be numbers`);
        }
        if (coord.lat < -90 || coord.lat > 90) {
            throw new Error(`${context}: latitude must be between -90 and 90`);
        }
        if (coord.lng < -180 || coord.lng > 180) {
            throw new Error(`${context}: longitude must be between -180 and 180`);
        }
    }
    validateEtaResponse(response) {
        if (!response.engine) {
            throw new Error('Invalid ETA response: missing engine');
        }
        if (!Array.isArray(response.pairs)) {
            throw new Error('Invalid ETA response: pairs must be array');
        }
        response.pairs.forEach((pair, i) => {
            if (typeof pair.duration_sec !== 'number' || typeof pair.distance_m !== 'number') {
                throw new Error(`Invalid ETA response: pair ${i} missing duration_sec or distance_m`);
            }
        });
    }
    validateRouteResponse(response) {
        if (!response.engine) {
            throw new Error('Invalid route response: missing engine');
        }
        if (typeof response.duration_sec !== 'number' || typeof response.distance_m !== 'number') {
            throw new Error('Invalid route response: missing duration_sec or distance_m');
        }
        if (!Array.isArray(response.waypoints)) {
            throw new Error('Invalid route response: waypoints must be array');
        }
        if (!Array.isArray(response.h3_path_res9)) {
            throw new Error('Invalid route response: h3_path_res9 must be array');
        }
    }
    validateH3Response(response) {
        if (!Array.isArray(response.results)) {
            throw new Error('Invalid H3 response: results must be array');
        }
    }
    validateGeocodeForwardResponse(response) {
        if (!response.engine) {
            throw new Error('Invalid geocode forward response: missing engine');
        }
        if (!Array.isArray(response.results)) {
            throw new Error('Invalid geocode forward response: results must be array');
        }
    }
    validateGeocodeReverseResponse(response) {
        if (!response.engine) {
            throw new Error('Invalid geocode reverse response: missing engine');
        }
        if (!response.label || typeof response.label !== 'string') {
            throw new Error('Invalid geocode reverse response: missing label');
        }
        if (!response.h3_res9 || typeof response.h3_res9 !== 'string') {
            throw new Error('Invalid geocode reverse response: missing h3_res9');
        }
    }
};
exports.GeoClient = GeoClient;
exports.GeoClient = GeoClient = GeoClient_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [http_service_js_1.HttpService,
        config_1.ConfigService,
        service_token_service_js_1.ServiceTokenService,
        token_bucket_rate_limiter_js_1.TokenBucketRateLimiter,
        h3_cache_service_js_1.H3CacheService])
], GeoClient);
//# sourceMappingURL=geo.client.js.map