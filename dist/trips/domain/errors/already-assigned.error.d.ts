export declare class AlreadyAssignedError extends Error {
    readonly tripId: string;
    readonly existingDriverId: string;
    readonly attemptedDriverId: string;
    constructor(tripId: string, existingDriverId: string, attemptedDriverId: string);
}
