export declare class InvalidStateForPaymentError extends Error {
    readonly tripId: string;
    readonly currentStatus: string;
    constructor(tripId: string, currentStatus: string);
}
