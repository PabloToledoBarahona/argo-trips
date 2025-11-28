export declare class DriverNotOnlineError extends Error {
    readonly driverId: string;
    readonly tripId: string;
    constructor(driverId: string, tripId: string);
}
