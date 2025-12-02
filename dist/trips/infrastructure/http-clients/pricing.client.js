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
const axios_1 = require("axios");
const http_service_js_1 = require("../../../shared/http/http.service.js");
let PricingClient = PricingClient_1 = class PricingClient {
    httpService;
    configService;
    logger = new common_1.Logger(PricingClient_1.name);
    baseUrl;
    maxRetries = 3;
    baseBackoffMs = 250;
    constructor(httpService, configService) {
        this.httpService = httpService;
        this.configService = configService;
        this.baseUrl = this.configService.get('PRICING_SERVICE_URL') || 'http://localhost:3006';
    }
    async quote(request) {
        this.logger.debug(`Requesting quote for city: ${request.city}, vehicle: ${request.vehicleType}`);
        const response = await this.executeWithRetry(() => this.httpService.post(`${this.baseUrl}/pricing/quote`, request), 'pricing quote');
        this.validateQuoteResponse(response);
        this.logger.debug(`Quote received: ${response.quoteId}, est total: ${response.estimateTotal} ${response.currency}, surge=${response.surgeMultiplier}`);
        return response;
    }
    async finalize(request) {
        this.logger.debug(`Finalizing pricing for trip: ${request.tripId}, quote: ${request.quoteId}`);
        const response = await this.executeWithRetry(() => this.httpService.post(`${this.baseUrl}/pricing/finalize`, request), 'pricing finalize');
        this.validateFinalizeResponse(response);
        this.logger.debug(`Pricing finalized: ${response.totalPrice} ${response.currency}, surge=${response.surgeMultiplier}`);
        return response;
    }
    validateQuoteResponse(response) {
        if (!response.quoteId) {
            throw new Error('Invalid quote response: missing quoteId');
        }
        if (typeof response.estimateTotal !== 'number' || typeof response.basePrice !== 'number') {
            throw new Error('Invalid quote response: missing price totals');
        }
        if (typeof response.surgeMultiplier !== 'number') {
            throw new Error('Invalid quote response: missing surge multiplier');
        }
        if (!response.breakdown) {
            throw new Error('Invalid quote response: missing breakdown');
        }
    }
    validateFinalizeResponse(response) {
        if (!response.quoteId && !response.tripId) {
            throw new Error('Invalid finalize response: missing identifiers');
        }
        if (typeof response.totalPrice !== 'number' || typeof response.basePrice !== 'number') {
            throw new Error('Invalid finalize response: missing price totals');
        }
        if (typeof response.surgeMultiplier !== 'number') {
            throw new Error('Invalid finalize response: missing surge multiplier');
        }
        if (!response.breakdown) {
            throw new Error('Invalid finalize response: missing breakdown');
        }
    }
    async executeWithRetry(fn, operation) {
        let attempt = 0;
        for (;;) {
            try {
                return await fn();
            }
            catch (error) {
                const retryable = this.isRetryableError(error);
                if (!retryable || attempt >= this.maxRetries) {
                    const message = error instanceof Error ? error.message : String(error);
                    this.logger.error(`Failed ${operation} after ${attempt + 1} attempts: ${message}`);
                    throw error;
                }
                attempt += 1;
                const delay = this.getBackoffDelay(attempt);
                this.logger.warn(`Retrying ${operation} (${attempt}/${this.maxRetries}) after ${delay}ms due to ${this.getErrorMessage(error)}`);
                await this.sleep(delay);
            }
        }
    }
    isRetryableError(error) {
        if ((0, axios_1.isAxiosError)(error)) {
            const status = error.response?.status;
            if (status === 429) {
                return true;
            }
            if (status && status >= 400 && status < 500) {
                return false;
            }
            if (!status || status >= 500) {
                return true;
            }
        }
        return true;
    }
    getBackoffDelay(attempt) {
        const jitter = Math.floor(Math.random() * 100);
        return Math.pow(2, attempt - 1) * this.baseBackoffMs + jitter;
    }
    sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
    getErrorMessage(error) {
        if ((0, axios_1.isAxiosError)(error)) {
            const status = error.response?.status;
            const statusText = error.response?.statusText;
            return status ? `${status}${statusText ? ` ${statusText}` : ''}` : error.message;
        }
        if (error instanceof Error) {
            return error.message;
        }
        return String(error);
    }
};
exports.PricingClient = PricingClient;
exports.PricingClient = PricingClient = PricingClient_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [http_service_js_1.HttpService,
        config_1.ConfigService])
], PricingClient);
//# sourceMappingURL=pricing.client.js.map