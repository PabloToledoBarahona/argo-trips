export interface DriverAvailabilityChangedEvent {
    driverId: string;
    available: boolean;
    timestamp: Date;
}
export declare class DriverSessionsEventsHandler {
    private readonly logger;
    handleDriverAvailabilityChanged(event: DriverAvailabilityChangedEvent): Promise<void>;
    handleDriverLocationUpdated(event: any): Promise<void>;
}
