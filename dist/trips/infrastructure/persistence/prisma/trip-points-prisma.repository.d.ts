import { PrismaService } from './prisma.service.js';
export interface TripPoint {
    id: string;
    tripId: string;
    phase: string;
    lat: number;
    lng: number;
    h3Res9: string;
    speedMps?: number;
    headingDeg?: number;
    ts: Date;
}
export declare class TripPointsPrismaRepository {
    private readonly prisma;
    constructor(prisma: PrismaService);
    create(point: Omit<TripPoint, 'id'>): Promise<TripPoint>;
    createMany(points: Omit<TripPoint, 'id'>[]): Promise<number>;
    findByTripId(tripId: string, phase?: string): Promise<TripPoint[]>;
    countByTripId(tripId: string, phase?: string): Promise<number>;
    private mapToDomain;
    private mapPhaseToPrisma;
}
