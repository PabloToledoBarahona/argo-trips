import { PrismaService } from './prisma.service.js';
export interface TripCancellation {
    id: string;
    tripId: string;
    side: string;
    reason: string;
    secondsSinceAssign?: number;
    feeAppliedDec?: number;
    ts: Date;
}
export declare class TripCancellationsPrismaRepository {
    private readonly prisma;
    constructor(prisma: PrismaService);
    create(cancellation: Omit<TripCancellation, 'id' | 'ts'>): Promise<TripCancellation>;
    findByTripId(tripId: string): Promise<TripCancellation[]>;
    private mapCancelSideToPrisma;
    private mapCancelReasonToPrisma;
}
