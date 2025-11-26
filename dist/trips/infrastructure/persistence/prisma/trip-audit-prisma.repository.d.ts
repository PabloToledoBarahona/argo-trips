import { PrismaService } from './prisma.service.js';
export interface TripAudit {
    id: string;
    tripId: string;
    action: string;
    previousStatus?: string;
    newStatus: string;
    performedBy: string;
    performedByType: string;
    metadata?: any;
    timestamp: Date;
}
export declare class TripAuditPrismaRepository {
    private readonly prisma;
    constructor(prisma: PrismaService);
    create(audit: Omit<TripAudit, 'id'>): Promise<TripAudit>;
    findByTripId(tripId: string): Promise<TripAudit[]>;
}
