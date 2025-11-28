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
var PaymentsClient_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentsClient = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const http_service_js_1 = require("../../../shared/http/http.service.js");
let PaymentsClient = PaymentsClient_1 = class PaymentsClient {
    httpService;
    configService;
    logger = new common_1.Logger(PaymentsClient_1.name);
    baseUrl;
    constructor(httpService, configService) {
        this.httpService = httpService;
        this.configService = configService;
        this.baseUrl = this.configService.get('PAYMENTS_SERVICE_URL') || 'http://localhost:3007';
    }
    async createIntent(request) {
        try {
            this.logger.debug(`Creating payment intent for trip: ${request.tripId}, amount: ${request.amount} ${request.currency}`);
            const response = await this.httpService.post(`${this.baseUrl}/payments/intents`, request);
            if (!response.paymentIntentId || !response.status || !response.clientSecret) {
                throw new Error('Invalid payment intent response: missing required fields');
            }
            this.logger.debug(`Payment intent created: ${response.paymentIntentId}, status: ${response.status}`);
            return response;
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.error(`Failed to create payment intent: ${message}`);
            throw new Error(`Payments service create intent failed: ${message}`);
        }
    }
    async getIntent(id) {
        try {
            this.logger.debug(`Getting payment intent: ${id}`);
            const response = await this.httpService.get(`${this.baseUrl}/payments/intents/${id}`);
            if (!response.paymentIntentId || !response.status) {
                throw new Error('Invalid payment intent response: missing required fields');
            }
            this.logger.debug(`Payment intent: ${id}, status: ${response.status}`);
            return response;
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.error(`Failed to get payment intent: ${message}`);
            throw new Error(`Payments service get intent failed: ${message}`);
        }
    }
};
exports.PaymentsClient = PaymentsClient;
exports.PaymentsClient = PaymentsClient = PaymentsClient_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [http_service_js_1.HttpService,
        config_1.ConfigService])
], PaymentsClient);
//# sourceMappingURL=payments.client.js.map