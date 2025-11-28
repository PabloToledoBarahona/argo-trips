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
let PricingClient = PricingClient_1 = class PricingClient {
    httpService;
    configService;
    logger = new common_1.Logger(PricingClient_1.name);
    baseUrl;
    timeout = 5000;
    constructor(httpService, configService) {
        this.httpService = httpService;
        this.configService = configService;
        this.baseUrl = this.configService.get('PRICING_SERVICE_URL') || 'http://localhost:3006';
    }
    getErrorMessage(error) {
        if (error instanceof Error)
            return error.message;
        return String(error);
    }
    getErrorStack(error) {
        if (error instanceof Error)
            return error.stack;
        return undefined;
    }
    async quoteTrip(request) {
        try {
            this.logger.debug(`Requesting quote for trip: ${request.city}, ${request.vehicleType}`);
            const response = await this.httpService.post(`${this.baseUrl}/pricing/quote`, request, { timeout: this.timeout });
            if (!response.quoteId || !response.pricingDetails) {
                throw new Error('Invalid quote response: missing required fields');
            }
            this.logger.debug(`Quote received: ${response.quoteId}, total: ${response.pricingDetails.totalPrice}`);
            return response;
        }
        catch (error) {
            this.logger.error(`Failed to get pricing quote: ${this.getErrorMessage(error)}`, this.getErrorStack(error));
            throw new Error(`Pricing service unavailable: ${this.getErrorMessage(error)}`);
        }
    }
    async finalizeTrip(request) {
        try {
            this.logger.debug(`Finalizing pricing for trip: ${request.tripId}, canceled: ${request.cancel?.is_canceled || false}`);
            const response = await this.httpService.post(`${this.baseUrl}/pricing/finalize`, request, { timeout: this.timeout });
            if (!response.finalSnapshot || !response.quoteId) {
                throw new Error('Invalid finalize response: missing required fields');
            }
            this.logger.debug(`Pricing finalized: ${response.quoteId}, total: ${response.finalSnapshot.totalPrice}`);
            if (response.cancelFee) {
                this.logger.debug(`Cancel fee applied: ${response.cancelFee.cancelFeeApplied}, free: ${response.cancelFee.isFreeCancel}`);
            }
            return response;
        }
        catch (error) {
            this.logger.error(`Failed to finalize pricing: ${this.getErrorMessage(error)}`, this.getErrorStack(error));
            throw new Error(`Pricing finalize failed: ${this.getErrorMessage(error)}`);
        }
    }
    async validateQuote(quoteId) {
        try {
            this.logger.debug(`Validating quote: ${quoteId}`);
            const response = await this.httpService.get(`${this.baseUrl}/pricing/quote/${quoteId}/validate`, { timeout: this.timeout });
            return response.valid;
        }
        catch (error) {
            this.logger.warn(`Quote validation failed for ${quoteId}: ${this.getErrorMessage(error)}`);
            return false;
        }
    }
};
exports.PricingClient = PricingClient;
exports.PricingClient = PricingClient = PricingClient_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [http_service_js_1.HttpService,
        config_1.ConfigService])
], PricingClient);
//# sourceMappingURL=pricing.client.js.map