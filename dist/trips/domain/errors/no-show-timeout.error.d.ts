export declare class NoShowTimeoutError extends Error {
    readonly tripId: string;
    readonly pickupStartedAt: Date;
    constructor(tripId: string, pickupStartedAt: Date);
}
