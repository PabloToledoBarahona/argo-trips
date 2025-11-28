export declare class MissingPricingSnapshotError extends Error {
    readonly tripId: string;
    readonly command: string;
    constructor(tripId: string, command: string);
}
