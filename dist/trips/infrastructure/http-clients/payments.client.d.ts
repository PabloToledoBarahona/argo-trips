import { ConfigService } from '@nestjs/config';
import { HttpService } from '../../../shared/http/http.service.js';
export declare enum PaymentIntentStatus {
    PENDING = "PENDING",
    PROCESSING = "PROCESSING",
    SUCCEEDED = "SUCCEEDED",
    FAILED = "FAILED",
    CANCELED = "CANCELED",
    REFUNDED = "REFUNDED"
}
export declare enum PaymentMethod {
    CARD = "CARD",
    QR = "QR",
    CASH = "CASH",
    WALLET = "WALLET"
}
export interface CreatePaymentIntentRequest {
    tripId: string;
    riderId: string;
    amount: number;
    currency: string;
    quoteId?: string;
    paymentMethod?: PaymentMethod;
    description?: string;
    metadata?: Record<string, any>;
}
export interface CreatePaymentIntentResponse {
    paymentIntentId: string;
    status: PaymentIntentStatus;
    amount: number;
    currency: string;
    clientSecret?: string;
    qrCode?: string;
    expiresAt: string;
    createdAt: string;
}
export interface GetPaymentStatusResponse {
    paymentIntentId: string;
    status: PaymentIntentStatus;
    amount: number;
    amountCaptured?: number;
    currency: string;
    tripId: string;
    riderId: string;
    paymentMethod?: PaymentMethod;
    capturedAt?: string;
    failureReason?: string;
    metadata?: Record<string, any>;
}
export interface CapturePaymentRequest {
    paymentIntentId: string;
    amount?: number;
}
export interface CapturePaymentResponse {
    paymentIntentId: string;
    status: PaymentIntentStatus;
    amountCaptured: number;
    currency: string;
    capturedAt: string;
}
export interface RefundPaymentRequest {
    paymentIntentId: string;
    amount?: number;
    reason?: string;
    metadata?: Record<string, any>;
}
export interface RefundPaymentResponse {
    refundId: string;
    paymentIntentId: string;
    status: string;
    amount: number;
    currency: string;
    refundedAt: string;
}
export declare class PaymentsClient {
    private readonly httpService;
    private readonly configService;
    private readonly logger;
    private readonly baseUrl;
    private readonly timeout;
    constructor(httpService: HttpService, configService: ConfigService);
    private getErrorMessage;
    private getErrorStack;
    createPaymentIntent(request: CreatePaymentIntentRequest, idempotencyKey?: string): Promise<CreatePaymentIntentResponse>;
    getPaymentStatus(paymentIntentId: string): Promise<GetPaymentStatusResponse>;
    capturePayment(paymentIntentId: string, amount?: number): Promise<CapturePaymentResponse>;
    refundPayment(request: RefundPaymentRequest, idempotencyKey?: string): Promise<RefundPaymentResponse>;
    cancelPaymentIntent(paymentIntentId: string): Promise<void>;
    verifyPaymentCaptured(paymentIntentId: string): Promise<boolean>;
}
