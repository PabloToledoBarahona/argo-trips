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
var DriverSessionsClient_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DriverSessionsClient = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const http_service_js_1 = require("../../../shared/http/http.service.js");
const service_token_service_js_1 = require("../../../shared/auth/services/service-token.service.js");
const token_bucket_rate_limiter_js_1 = require("../../../shared/rate-limiter/token-bucket.rate-limiter.js");
const circuit_breaker_js_1 = require("../../../shared/circuit-breaker/circuit-breaker.js");
let DriverSessionsClient = DriverSessionsClient_1 = class DriverSessionsClient {
    httpService;
    configService;
    serviceTokenService;
    rateLimiter;
    logger = new common_1.Logger(DriverSessionsClient_1.name);
    baseUrl;
    sessionCircuitBreaker;
    nearbyCircuitBreaker;
    SESSION_TIMEOUT_MS = 3000;
    NEARBY_TIMEOUT_MS = 5000;
    constructor(httpService, configService, serviceTokenService, rateLimiter) {
        this.httpService = httpService;
        this.configService = configService;
        this.serviceTokenService = serviceTokenService;
        this.rateLimiter = rateLimiter;
        this.baseUrl =
            this.configService.get('DRIVER_SESSIONS_SERVICE_URL') ||
                'http://alb-argo-gateway-1317937741.us-east-2.elb.amazonaws.com/driver-sessions';
        this.sessionCircuitBreaker = new circuit_breaker_js_1.CircuitBreaker('driver-sessions-session', {
            failureThreshold: 5,
            successThreshold: 2,
            timeout: 60000,
            rollingWindow: 60000,
        });
        this.nearbyCircuitBreaker = new circuit_breaker_js_1.CircuitBreaker('driver-sessions-nearby', {
            failureThreshold: 5,
            successThreshold: 2,
            timeout: 60000,
            rollingWindow: 60000,
        });
        this.logger.log(`Driver Sessions Client initialized with base URL: ${this.baseUrl}`);
    }
    onModuleInit() {
        this.rateLimiter.createBucket('driver-sessions-get', 100, 100);
        this.rateLimiter.createBucket('driver-sessions-nearby', 50, 50);
        this.logger.log('Driver Sessions Client rate limiters initialized');
    }
    async getSession(driverId) {
        try {
            this.logger.debug(`Getting session for driver: ${driverId}`);
            this.validateDriverId(driverId);
            await this.rateLimiter.acquire('driver-sessions-get');
            const response = await this.sessionCircuitBreaker.execute(async () => {
                const headers = await this.serviceTokenService.getServiceHeaders();
                return await this.httpService.get(`${this.baseUrl}/sessions/${driverId}`, {
                    headers,
                    timeout: this.SESSION_TIMEOUT_MS,
                });
            });
            this.validateSessionResponse(response);
            this.logger.debug(`Driver session: ${driverId}, online=${response.online}, eligible=${response.eligibility.ok}, trip=${response.trip_id || 'none'}`);
            return response;
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.error(`Failed to get driver session for ${driverId}: ${message}`);
            throw new Error(`Driver Sessions service failed: ${message}`);
        }
    }
    async findNearbyDrivers(request) {
        try {
            this.logger.debug(`Finding nearby drivers: h3=${request.h3}, k=${request.k || 1}, limit=${request.limit || 50}`);
            this.validateNearbyRequest(request);
            await this.rateLimiter.acquire('driver-sessions-nearby');
            const params = new URLSearchParams({
                h3: request.h3,
                ...(request.k !== undefined && { k: request.k.toString() }),
                ...(request.limit !== undefined && { limit: request.limit.toString() }),
            });
            const response = await this.nearbyCircuitBreaker.execute(async () => {
                const headers = await this.serviceTokenService.getServiceHeaders();
                return await this.httpService.get(`${this.baseUrl}/sessions/nearby?${params.toString()}`, {
                    headers,
                    timeout: this.NEARBY_TIMEOUT_MS,
                });
            });
            this.validateNearbyResponse(response);
            this.logger.debug(`Found ${response.drivers.length} nearby drivers in ${response.queried_cells.length} cells`);
            return response;
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.error(`Failed to find nearby drivers: ${message}`);
            throw new Error(`Driver Sessions nearby search failed: ${message}`);
        }
    }
    validateDriverId(driverId) {
        if (!driverId || typeof driverId !== 'string' || driverId.trim().length === 0) {
            throw new Error('Invalid driverId: must be non-empty string');
        }
    }
    validateSessionResponse(response) {
        if (!response.driver_id || typeof response.driver_id !== 'string') {
            throw new Error('Invalid session response: missing driver_id');
        }
        if (typeof response.online !== 'boolean') {
            throw new Error('Invalid session response: missing online status');
        }
        if (!response.eligibility || typeof response.eligibility.ok !== 'boolean') {
            throw new Error('Invalid session response: missing eligibility');
        }
        if (response.last_loc !== null) {
            if (typeof response.last_loc.lat !== 'number' ||
                typeof response.last_loc.lng !== 'number' ||
                typeof response.last_loc.h3_res9 !== 'string') {
                throw new Error('Invalid session response: malformed last_loc');
            }
        }
    }
    validateNearbyRequest(request) {
        if (!request.h3 || typeof request.h3 !== 'string') {
            throw new Error('Invalid nearby request: h3 cell required');
        }
        if (request.h3.length !== 15) {
            throw new Error('Invalid nearby request: h3 must be resolution 9 (15 characters)');
        }
        if (request.k !== undefined && (request.k < 0 || request.k > 5)) {
            throw new Error('Invalid nearby request: k must be between 0 and 5');
        }
        if (request.limit !== undefined && (request.limit < 1 || request.limit > 100)) {
            throw new Error('Invalid nearby request: limit must be between 1 and 100');
        }
    }
    validateNearbyResponse(response) {
        if (!Array.isArray(response.drivers)) {
            throw new Error('Invalid nearby response: drivers must be array');
        }
        if (!Array.isArray(response.queried_cells)) {
            throw new Error('Invalid nearby response: queried_cells must be array');
        }
    }
};
exports.DriverSessionsClient = DriverSessionsClient;
exports.DriverSessionsClient = DriverSessionsClient = DriverSessionsClient_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [http_service_js_1.HttpService,
        config_1.ConfigService,
        service_token_service_js_1.ServiceTokenService,
        token_bucket_rate_limiter_js_1.TokenBucketRateLimiter])
], DriverSessionsClient);
//# sourceMappingURL=driver-sessions.client.js.map