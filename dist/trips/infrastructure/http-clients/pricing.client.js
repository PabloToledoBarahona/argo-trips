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
var PricingClient_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PricingClient = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const http_service_js_1 = require("../../../shared/http/http.service.js");
const service_token_service_js_1 = require("../../../shared/auth/services/service-token.service.js");
const token_bucket_rate_limiter_js_1 = require("../../../shared/rate-limiter/token-bucket.rate-limiter.js");
const circuit_breaker_js_1 = require("../../../shared/circuit-breaker/circuit-breaker.js");
let PricingClient = PricingClient_1 = class PricingClient {
    httpService;
    configService;
    serviceTokenService;
    rateLimiter;
    logger = new common_1.Logger(PricingClient_1.name);
    baseUrl;
    quoteCircuitBreaker;
    finalizeCircuitBreaker;
    QUOTE_TIMEOUT_MS = 5000;
    FINALIZE_TIMEOUT_MS = 10000;
    constructor(httpService, configService, serviceTokenService, rateLimiter) {
        this.httpService = httpService;
        this.configService = configService;
        this.serviceTokenService = serviceTokenService;
        this.rateLimiter = rateLimiter;
        this.baseUrl =
            this.configService.get('PRICING_SERVICE_URL') ||
                'http://alb-argo-gateway-1317937741.us-east-2.elb.amazonaws.com/pricing';
        this.quoteCircuitBreaker = new circuit_breaker_js_1.CircuitBreaker('pricing-quote', {
            failureThreshold: 5,
            successThreshold: 2,
            timeout: 60000,
            rollingWindow: 60000,
        });
        this.finalizeCircuitBreaker = new circuit_breaker_js_1.CircuitBreaker('pricing-finalize', {
            failureThreshold: 5,
            successThreshold: 2,
            timeout: 60000,
            rollingWindow: 60000,
        });
        this.logger.log(`Pricing Client initialized with base URL: ${this.baseUrl}`);
    }
    onModuleInit() {
        this.rateLimiter.createBucket('pricing-quote', 50, 50);
        this.rateLimiter.createBucket('pricing-finalize', 20, 20);
        this.logger.log('Pricing Client rate limiters initialized');
    }
    async quote(request) {
        this.logger.debug(`Requesting quote for city: ${request.city}, vehicle: ${request.vehicle_type}`);
        this.validateQuoteRequest(request);
        await this.rateLimiter.acquire('pricing-quote');
        const wrappedResponse = await this.quoteCircuitBreaker.execute(async () => {
            const headers = await this.serviceTokenService.getServiceHeaders();
            return await this.httpService.post(`${this.baseUrl}/quote`, request, {
                headers,
                timeout: this.QUOTE_TIMEOUT_MS,
            });
        });
        const response = wrappedResponse.data || wrappedResponse;
        this.validateQuoteResponse(response);
        if (response.degradation) {
            this.logger.warn(`Quote ${response.quote_id} returned with degradation mode: ${response.degradation}. Estimate may be less accurate.`);
        }
        this.logger.debug(`Quote received: ${response.quote_id}, est total: ${response.estimate_total} ${response.currency}, surge=${response.zone.surge}, degradation=${response.degradation ?? 'none'}`);
        return response;
    }
    async finalize(request) {
        this.logger.debug(`Finalizing pricing for trip: ${request.trip_id}, quote: ${request.quote_id}, status: ${request.status}`);
        this.validateFinalizeRequest(request);
        await this.rateLimiter.acquire('pricing-finalize');
        const wrappedResponse = await this.finalizeCircuitBreaker.execute(async () => {
            const headers = await this.serviceTokenService.getServiceHeaders();
            return await this.httpService.post(`${this.baseUrl}/finalize`, request, {
                headers,
                timeout: this.FINALIZE_TIMEOUT_MS,
            });
        });
        const response = wrappedResponse.data || wrappedResponse;
        this.validateFinalizeResponse(response);
        if (response.degradation) {
            this.logger.warn(`Finalize for trip ${response.trip_id} returned with degradation mode: ${response.degradation}`);
        }
        this.logger.debug(`Pricing finalized: trip ${response.trip_id}, total: ${response.total_final} ${response.currency}, surge=${response.surge_used}, min_fare_applied=${response.min_fare_applied}, degradation=${response.degradation ?? 'none'}`);
        return response;
    }
    validateQuoteRequest(request) {
        if (!request.origin || typeof request.origin.lat !== 'number' || typeof request.origin.lng !== 'number') {
            throw new Error('Invalid quote request: origin coordinates required');
        }
        if (!request.destination || typeof request.destination.lat !== 'number' || typeof request.destination.lng !== 'number') {
            throw new Error('Invalid quote request: destination coordinates required');
        }
        if (!request.vehicle_type || typeof request.vehicle_type !== 'string') {
            throw new Error('Invalid quote request: vehicle_type required');
        }
        if (!request.city || typeof request.city !== 'string') {
            throw new Error('Invalid quote request: city required');
        }
        if (request.origin.lat < -90 || request.origin.lat > 90) {
            throw new Error('Invalid quote request: origin.lat must be between -90 and 90');
        }
        if (request.origin.lng < -180 || request.origin.lng > 180) {
            throw new Error('Invalid quote request: origin.lng must be between -180 and 180');
        }
        if (request.destination.lat < -90 || request.destination.lat > 90) {
            throw new Error('Invalid quote request: destination.lat must be between -90 and 90');
        }
        if (request.destination.lng < -180 || request.destination.lng > 180) {
            throw new Error('Invalid quote request: destination.lng must be between -180 and 180');
        }
    }
    validateQuoteResponse(response) {
        if (!response.quote_id || typeof response.quote_id !== 'string') {
            throw new Error('Invalid quote response: missing quote_id');
        }
        if (typeof response.estimate_total !== 'number') {
            throw new Error('Invalid quote response: missing estimate_total');
        }
        if (!response.currency || typeof response.currency !== 'string') {
            throw new Error('Invalid quote response: missing currency');
        }
        if (!response.expires_at || typeof response.expires_at !== 'string') {
            throw new Error('Invalid quote response: missing expires_at');
        }
        if (!response.zone || typeof response.zone.h3_res7 !== 'string' || typeof response.zone.surge !== 'number') {
            throw new Error('Invalid quote response: missing or invalid zone information');
        }
    }
    validateFinalizeRequest(request) {
        if (!request.trip_id || typeof request.trip_id !== 'string') {
            throw new Error('Invalid finalize request: trip_id required');
        }
        if (!request.vehicle_type || typeof request.vehicle_type !== 'string') {
            throw new Error('Invalid finalize request: vehicle_type required');
        }
        if (!request.h3_res7 || typeof request.h3_res7 !== 'string') {
            throw new Error('Invalid finalize request: h3_res7 required');
        }
        if (!request.city || typeof request.city !== 'string') {
            throw new Error('Invalid finalize request: city required');
        }
        if (!request.status || (request.status !== 'completed' && request.status !== 'cancelled')) {
            throw new Error('Invalid finalize request: status must be "completed" or "cancelled"');
        }
        if (request.status === 'completed') {
            if (typeof request.distance_m_final !== 'number') {
                throw new Error('Invalid finalize request: distance_m_final required for completed trips');
            }
            if (typeof request.duration_s_final !== 'number') {
                throw new Error('Invalid finalize request: duration_s_final required for completed trips');
            }
        }
        if (request.status === 'cancelled') {
            if (!request.cancelled_at || typeof request.cancelled_at !== 'string') {
                throw new Error('Invalid finalize request: cancelled_at required for cancelled trips');
            }
        }
    }
    validateFinalizeResponse(response) {
        if (!response.trip_id || typeof response.trip_id !== 'string') {
            throw new Error('Invalid finalize response: missing trip_id');
        }
        if (typeof response.total_final !== 'number') {
            throw new Error('Invalid finalize response: missing total_final');
        }
        if (!response.currency || typeof response.currency !== 'string') {
            throw new Error('Invalid finalize response: missing currency');
        }
        if (typeof response.surge_used !== 'number') {
            throw new Error('Invalid finalize response: missing surge_used');
        }
        if (typeof response.min_fare_applied !== 'boolean') {
            throw new Error('Invalid finalize response: missing min_fare_applied');
        }
        if (typeof response.cancel_fee_applied !== 'boolean') {
            throw new Error('Invalid finalize response: missing cancel_fee_applied');
        }
        if (!response.pricing_rule_version || typeof response.pricing_rule_version !== 'string') {
            throw new Error('Invalid finalize response: missing pricing_rule_version');
        }
        if (!Array.isArray(response.taxes)) {
            throw new Error('Invalid finalize response: taxes must be an array');
        }
    }
};
exports.PricingClient = PricingClient;
exports.PricingClient = PricingClient = PricingClient_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [http_service_js_1.HttpService,
        config_1.ConfigService,
        service_token_service_js_1.ServiceTokenService,
        token_bucket_rate_limiter_js_1.TokenBucketRateLimiter])
], PricingClient);
//# sourceMappingURL=pricing.client.js.map