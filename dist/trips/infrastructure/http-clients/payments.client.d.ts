import { ConfigService } from '@nestjs/config';
import { HttpService } from '../../../shared/http/http.service.js';
export type PaymentMethod = 'cash' | 'qr';
export type PaymentIntentStatus = 'requires_payment_method' | 'requires_capture' | 'succeeded';
export interface CreatePaymentIntentRequest {
    tripId: string;
    amount: number;
    currency: string;
    method: PaymentMethod;
}
export interface CreatePaymentIntentResponse {
    paymentIntentId: string;
    status: PaymentIntentStatus;
    clientSecret: string;
}
export interface GetPaymentIntentResponse {
    paymentIntentId: string;
    status: PaymentIntentStatus;
}
export declare class PaymentsClient {
    private readonly httpService;
    private readonly configService;
    private readonly logger;
    private readonly baseUrl;
    constructor(httpService: HttpService, configService: ConfigService);
    createIntent(request: CreatePaymentIntentRequest): Promise<CreatePaymentIntentResponse>;
    getIntent(id: string): Promise<GetPaymentIntentResponse>;
}
