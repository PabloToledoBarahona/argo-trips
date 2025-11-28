export declare class PaymentNotCapturedError extends Error {
    readonly tripId: string;
    readonly paymentIntentId?: string | undefined;
    constructor(tripId: string, paymentIntentId?: string | undefined);
}
