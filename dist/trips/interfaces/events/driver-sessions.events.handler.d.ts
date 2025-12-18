export declare class DriverSessionsEventsHandler {
    private readonly logger;
    handleDriverAvailabilityChanged(event: {
        driverId: string;
        available: boolean;
        timestamp: Date;
    }): Promise<void>;
    handleDriverLocationUpdated(event: any): Promise<void>;
}
