import { PrismaService } from './prisma.service.js';
export interface TripAudit {
    id: string;
    tripId: string;
    action: string;
    actorType: string;
    actorId?: string;
    payload: any;
    ip?: string;
    ts: Date;
}
export declare class TripAuditPrismaRepository {
    private readonly prisma;
    constructor(prisma: PrismaService);
    create(audit: Omit<TripAudit, 'id' | 'ts'>): Promise<TripAudit>;
    findByTripId(tripId: string): Promise<TripAudit[]>;
    private mapActorTypeToPrisma;
}
