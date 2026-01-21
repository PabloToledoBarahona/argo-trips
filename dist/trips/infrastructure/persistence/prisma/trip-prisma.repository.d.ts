import { PrismaService } from './prisma.service.js';
import { Trip } from '../../../domain/entities/trip.entity.js';
export declare class TripPrismaRepository {
    private readonly prisma;
    constructor(prisma: PrismaService);
    create(trip: Trip): Promise<Trip>;
    findById(id: string): Promise<Trip | null>;
    update(id: string, trip: Partial<Trip>): Promise<Trip>;
    findByRiderId(riderId: string): Promise<Trip[]>;
    findByDriverId(driverId: string): Promise<Trip[]>;
    private mapToDomain;
    private mapStatusToPrisma;
    private mapStatusToDomain;
    private mapCancelReasonToPrisma;
    private mapCancelReasonToDomain;
    private mapCancelSideToPrisma;
    private mapCancelSideToDomain;
    private mapPaymentMethodToPrisma;
    private mapPaymentMethodToDomain;
}
