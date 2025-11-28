export declare class OfferExpiredError extends Error {
    readonly tripId: string;
    readonly offeredAt?: Date | undefined;
    constructor(tripId: string, offeredAt?: Date | undefined);
}
