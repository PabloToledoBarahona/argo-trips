export declare class TripsJobsProcessor {
    private readonly logger;
    processNoShowCheck(tripId: string): Promise<void>;
    processOfferExpiration(tripId: string): Promise<void>;
    processPickupTimeout(tripId: string): Promise<void>;
    processReassignment(tripId: string): Promise<void>;
}
