import { PrismaService } from './prisma.service.js';
export interface TripCancellation {
    id: string;
    tripId: string;
    reason: string;
    side: string;
    notes?: string;
    compensationPct?: number;
    timestamp: Date;
}
export declare class TripCancellationsPrismaRepository {
    private readonly prisma;
    constructor(prisma: PrismaService);
    create(cancellation: Omit<TripCancellation, 'id'>): Promise<TripCancellation>;
    findByTripId(tripId: string): Promise<TripCancellation | null>;
}
