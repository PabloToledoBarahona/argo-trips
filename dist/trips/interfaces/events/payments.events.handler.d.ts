export interface PaymentCapturedEvent {
    paymentIntentId: string;
    tripId: string;
    amount: number;
    currency: string;
    capturedAt: Date;
}
export declare class PaymentsEventsHandler {
    private readonly logger;
    handlePaymentCaptured(event: PaymentCapturedEvent): Promise<void>;
    handlePaymentFailed(event: any): Promise<void>;
    handlePaymentRefunded(event: any): Promise<void>;
}
