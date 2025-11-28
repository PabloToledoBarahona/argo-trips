export declare class RadiusTooLargeError extends Error {
    readonly tripId: string;
    readonly actualDistance: number;
    readonly maxDistance: number;
    constructor(tripId: string, actualDistance: number, maxDistance?: number);
}
