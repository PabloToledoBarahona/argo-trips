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
exports.PaymentsClient = exports.PaymentMethod = exports.PaymentIntentStatus = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const http_service_js_1 = require("../../../shared/http/http.service.js");
var PaymentIntentStatus;
(function (PaymentIntentStatus) {
    PaymentIntentStatus["PENDING"] = "PENDING";
    PaymentIntentStatus["PROCESSING"] = "PROCESSING";
    PaymentIntentStatus["SUCCEEDED"] = "SUCCEEDED";
    PaymentIntentStatus["FAILED"] = "FAILED";
    PaymentIntentStatus["CANCELED"] = "CANCELED";
    PaymentIntentStatus["REFUNDED"] = "REFUNDED";
})(PaymentIntentStatus || (exports.PaymentIntentStatus = PaymentIntentStatus = {}));
var PaymentMethod;
(function (PaymentMethod) {
    PaymentMethod["CARD"] = "CARD";
    PaymentMethod["QR"] = "QR";
    PaymentMethod["CASH"] = "CASH";
    PaymentMethod["WALLET"] = "WALLET";
})(PaymentMethod || (exports.PaymentMethod = PaymentMethod = {}));
let PaymentsClient = PaymentsClient_1 = class PaymentsClient {
    httpService;
    configService;
    logger = new common_1.Logger(PaymentsClient_1.name);
    baseUrl;
    timeout = 10000;
    constructor(httpService, configService) {
        this.httpService = httpService;
        this.configService = configService;
        this.baseUrl = this.configService.get('PAYMENTS_SERVICE_URL') || 'http://localhost:3007';
    }
    getErrorMessage(error) {
        if (error instanceof Error)
            return error.message;
        return String(error);
    }
    getErrorStack(error) {
        if (error instanceof Error)
            return this.getErrorStack(error);
        return undefined;
    }
    async createPaymentIntent(request, idempotencyKey) {
        try {
            this.logger.debug(`Creating payment intent for trip: ${request.tripId}, ` +
                `amount: ${request.amount} ${request.currency}`);
            const idemKey = idempotencyKey || `trip-${request.tripId}-${Date.now()}`;
            const headers = {
                'Idempotency-Key': idemKey,
            };
            const response = await this.httpService.post(`${this.baseUrl}/payments/intent`, request, {
                timeout: this.timeout,
                headers,
            });
            if (!response.paymentIntentId || !response.status) {
                throw new Error('Invalid payment intent response: missing required fields');
            }
            this.logger.debug(`Payment intent created: ${response.paymentIntentId}, ` +
                `status: ${response.status}, expires: ${response.expiresAt}`);
            return response;
        }
        catch (error) {
            this.logger.error(`Failed to create payment intent for trip ${request.tripId}: ${this.getErrorMessage(error)}`, this.getErrorStack(error));
            throw new Error(`Payments service create intent failed: ${this.getErrorMessage(error)}`);
        }
    }
    async getPaymentStatus(paymentIntentId) {
        try {
            this.logger.debug(`Getting payment status for: ${paymentIntentId}`);
            const response = await this.httpService.get(`${this.baseUrl}/payments/intent/${paymentIntentId}`, { timeout: this.timeout });
            if (!response.paymentIntentId || !response.status) {
                throw new Error('Invalid payment status response');
            }
            this.logger.debug(`Payment status: ${paymentIntentId}, status: ${response.status}, ` +
                `captured: ${response.amountCaptured || 0}/${response.amount}`);
            return response;
        }
        catch (error) {
            this.logger.error(`Failed to get payment status for ${paymentIntentId}: ${this.getErrorMessage(error)}`, this.getErrorStack(error));
            throw new Error(`Payments service get status failed: ${this.getErrorMessage(error)}`);
        }
    }
    async capturePayment(paymentIntentId, amount) {
        try {
            this.logger.debug(`Capturing payment: ${paymentIntentId}, amount: ${amount || 'full'}`);
            const request = {
                paymentIntentId,
                amount,
            };
            const response = await this.httpService.post(`${this.baseUrl}/payments/intent/${paymentIntentId}/capture`, request, { timeout: this.timeout });
            if (!response.paymentIntentId || response.status !== PaymentIntentStatus.SUCCEEDED) {
                throw new Error('Payment capture failed or invalid response');
            }
            this.logger.debug(`Payment captured: ${response.paymentIntentId}, ` +
                `amount: ${response.amountCaptured} ${response.currency}`);
            return response;
        }
        catch (error) {
            this.logger.error(`Failed to capture payment ${paymentIntentId}: ${this.getErrorMessage(error)}`, this.getErrorStack(error));
            throw new Error(`Payments service capture failed: ${this.getErrorMessage(error)}`);
        }
    }
    async refundPayment(request, idempotencyKey) {
        try {
            this.logger.debug(`Refunding payment: ${request.paymentIntentId}, ` +
                `amount: ${request.amount || 'full'}, reason: ${request.reason || 'none'}`);
            const idemKey = idempotencyKey || `refund-${request.paymentIntentId}-${Date.now()}`;
            const headers = {
                'Idempotency-Key': idemKey,
            };
            const response = await this.httpService.post(`${this.baseUrl}/payments/intent/${request.paymentIntentId}/refund`, request, {
                timeout: this.timeout,
                headers,
            });
            if (!response.refundId || !response.paymentIntentId) {
                throw new Error('Invalid refund response');
            }
            this.logger.debug(`Payment refunded: ${response.refundId}, ` +
                `amount: ${response.amount} ${response.currency}`);
            return response;
        }
        catch (error) {
            this.logger.error(`Failed to refund payment ${request.paymentIntentId}: ${this.getErrorMessage(error)}`, this.getErrorStack(error));
            throw new Error(`Payments service refund failed: ${this.getErrorMessage(error)}`);
        }
    }
    async cancelPaymentIntent(paymentIntentId) {
        try {
            this.logger.debug(`Canceling payment intent: ${paymentIntentId}`);
            await this.httpService.post(`${this.baseUrl}/payments/intent/${paymentIntentId}/cancel`, {}, { timeout: this.timeout });
            this.logger.debug(`Payment intent canceled: ${paymentIntentId}`);
        }
        catch (error) {
            this.logger.warn(`Failed to cancel payment intent ${paymentIntentId}: ${this.getErrorMessage(error)}`);
        }
    }
    async verifyPaymentCaptured(paymentIntentId) {
        try {
            const status = await this.getPaymentStatus(paymentIntentId);
            return (status.status === PaymentIntentStatus.SUCCEEDED &&
                status.amountCaptured !== undefined &&
                status.amountCaptured > 0);
        }
        catch (error) {
            this.logger.warn(`Failed to verify payment captured for ${paymentIntentId}: ${this.getErrorMessage(error)}`);
            return false;
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