import { ConfigService } from '@nestjs/config';
import { HttpService } from '../../../shared/http/http.service.js';
export interface CreatePaymentIntentRequest {
    amount: number;
    currency: string;
    riderId: string;
    tripId: string;
    metadata?: Record<string, any>;
}
export interface CreatePaymentIntentResponse {
    paymentIntentId: string;
    status: string;
    clientSecret?: string;
}
export declare class PaymentsClient {
    private readonly httpService;
    private readonly configService;
    private readonly baseUrl;
    constructor(httpService: HttpService, configService: ConfigService);
    createPaymentIntent(request: CreatePaymentIntentRequest): Promise<CreatePaymentIntentResponse>;
    capturePayment(paymentIntentId: string): Promise<void>;
    refundPayment(paymentIntentId: string, amount?: number): Promise<void>;
}
