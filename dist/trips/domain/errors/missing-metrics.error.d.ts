export declare class MissingMetricsError extends Error {
    readonly tripId: string;
    readonly command: string;
    constructor(tripId: string, command: string);
}
