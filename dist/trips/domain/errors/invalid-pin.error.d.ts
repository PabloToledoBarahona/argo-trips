export declare class InvalidPINError extends Error {
    readonly tripId: string;
    readonly attemptsRemaining?: number | undefined;
    constructor(tripId: string, attemptsRemaining?: number | undefined);
}
