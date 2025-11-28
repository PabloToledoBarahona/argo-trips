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
    constructor(httpService, configService) {
        this.httpService = httpService;
        this.configService = configService;
        this.baseUrl = this.configService.get('PRICING_SERVICE_URL') || 'http://localhost:3006';
    }
    async quote(request) {
        try {
            this.logger.debug(`Requesting quote for rider: ${request.riderId}, vehicle: ${request.vehicleType}`);
            const response = await this.httpService.post(`${this.baseUrl}/pricing/quote`, request);
            if (!response.quoteId || !response.totalPrice) {
                throw new Error('Invalid quote response: missing required fields');
            }
            this.logger.debug(`Quote received: ${response.quoteId}, total: ${response.totalPrice} ${response.currency}`);
            return response;
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.error(`Failed to get pricing quote: ${message}`);
            throw new Error(`Pricing service quote failed: ${message}`);
        }
    }
    async finalize(request) {
        try {
            this.logger.debug(`Finalizing pricing for trip: ${request.tripId}, quote: ${request.quoteId}`);
            const response = await this.httpService.post(`${this.baseUrl}/pricing/finalize`, request);
            if (typeof response.finalPrice !== 'number' || !response.currency) {
                throw new Error('Invalid finalize response: missing required fields');
            }
            this.logger.debug(`Pricing finalized: ${response.finalPrice} ${response.currency}`);
            return response;
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.error(`Failed to finalize pricing: ${message}`);
            throw new Error(`Pricing service finalize failed: ${message}`);
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