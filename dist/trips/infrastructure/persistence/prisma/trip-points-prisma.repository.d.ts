import { PrismaService } from './prisma.service.js';
export interface TripPoint {
    id: string;
    tripId: string;
    lat: number;
    lng: number;
    timestamp: Date;
    source: string;
    metadata?: any;
}
export declare class TripPointsPrismaRepository {
    private readonly prisma;
    constructor(prisma: PrismaService);
    create(point: Omit<TripPoint, 'id'>): Promise<TripPoint>;
    findByTripId(tripId: string): Promise<TripPoint[]>;
}
