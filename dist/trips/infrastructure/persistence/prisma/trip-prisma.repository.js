"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TripPrismaRepository = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_js_1 = require("./prisma.service.js");
const trip_entity_js_1 = require("../../../domain/entities/trip.entity.js");
const cancel_side_enum_js_1 = require("../../../domain/enums/cancel-side.enum.js");
let TripPrismaRepository = class TripPrismaRepository {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async create(trip) {
        const data = {
            id: trip.id,
            riderId: trip.riderId,
            driverId: trip.driverId,
            vehicleType: trip.vehicleType,
            status: this.mapStatusToPrisma(trip.status),
            city: trip.city,
            originLat: trip.originLat,
            originLng: trip.originLng,
            originH3Res9: trip.originH3Res9,
            destLat: trip.destLat,
            destLng: trip.destLng,
            destH3Res9: trip.destH3Res9,
            requestedAt: trip.requestedAt,
            offeredAt: trip.offeredAt,
            assignedAt: trip.assignedAt,
            pickupStartedAt: trip.pickupStartedAt,
            inProgressAt: trip.inProgressAt,
            completedAt: trip.completedAt,
            paidAt: trip.paidAt,
            quoteId: trip.quoteId,
            cancelReason: trip.cancelReason ? this.mapCancelReasonToPrisma(trip.cancelReason) : null,
            cancelSide: trip.cancelSide ? this.mapCancelSideToPrisma(trip.cancelSide) : null,
            cancelAt: trip.cancelAt,
        };
        if (trip.pricingSnapshot !== undefined)
            data.pricingSnapshot = trip.pricingSnapshot;
        if (trip.paymentIntentId !== undefined)
            data.paymentIntentId = trip.paymentIntentId;
        if (trip.distance_m_est !== undefined)
            data.distanceMEst = trip.distance_m_est;
        if (trip.duration_s_est !== undefined)
            data.durationSEst = trip.duration_s_est;
        if (trip.distance_m_final !== undefined)
            data.distanceMFinal = trip.distance_m_final;
        if (trip.duration_s_final !== undefined)
            data.durationSFinal = trip.duration_s_final;
        const prismaTrip = await this.prisma.trip.create({ data });
        return this.mapToDomain(prismaTrip);
    }
    async findById(id) {
        const prismaTrip = await this.prisma.trip.findUnique({
            where: { id },
        });
        if (!prismaTrip) {
            return null;
        }
        return this.mapToDomain(prismaTrip);
    }
    async update(id, trip) {
        const updateData = {};
        if (trip.driverId !== undefined)
            updateData.driverId = trip.driverId;
        if (trip.status !== undefined)
            updateData.status = this.mapStatusToPrisma(trip.status);
        if (trip.offeredAt !== undefined)
            updateData.offeredAt = trip.offeredAt;
        if (trip.assignedAt !== undefined)
            updateData.assignedAt = trip.assignedAt;
        if (trip.pickupStartedAt !== undefined)
            updateData.pickupStartedAt = trip.pickupStartedAt;
        if (trip.inProgressAt !== undefined)
            updateData.inProgressAt = trip.inProgressAt;
        if (trip.completedAt !== undefined)
            updateData.completedAt = trip.completedAt;
        if (trip.paidAt !== undefined)
            updateData.paidAt = trip.paidAt;
        if (trip.quoteId !== undefined)
            updateData.quoteId = trip.quoteId;
        if (trip.pricingSnapshot !== undefined)
            updateData.pricingSnapshot = trip.pricingSnapshot;
        if (trip.paymentIntentId !== undefined)
            updateData.paymentIntentId = trip.paymentIntentId;
        if (trip.distance_m_est !== undefined)
            updateData.distanceMEst = trip.distance_m_est;
        if (trip.duration_s_est !== undefined)
            updateData.durationSEst = trip.duration_s_est;
        if (trip.distance_m_final !== undefined)
            updateData.distanceMFinal = trip.distance_m_final;
        if (trip.duration_s_final !== undefined)
            updateData.durationSFinal = trip.duration_s_final;
        if (trip.cancelReason !== undefined)
            updateData.cancelReason = trip.cancelReason ? this.mapCancelReasonToPrisma(trip.cancelReason) : null;
        if (trip.cancelSide !== undefined)
            updateData.cancelSide = trip.cancelSide ? this.mapCancelSideToPrisma(trip.cancelSide) : null;
        if (trip.cancelAt !== undefined)
            updateData.cancelAt = trip.cancelAt;
        const prismaTrip = await this.prisma.trip.update({
            where: { id },
            data: updateData,
        });
        return this.mapToDomain(prismaTrip);
    }
    async findByRiderId(riderId) {
        const prismaTrips = await this.prisma.trip.findMany({
            where: { riderId },
            orderBy: { requestedAt: 'desc' },
        });
        return prismaTrips.map(trip => this.mapToDomain(trip));
    }
    async findByDriverId(driverId) {
        const prismaTrips = await this.prisma.trip.findMany({
            where: { driverId },
            orderBy: { assignedAt: 'desc' },
        });
        return prismaTrips.map(trip => this.mapToDomain(trip));
    }
    mapToDomain(prismaTrip) {
        return new trip_entity_js_1.Trip({
            id: prismaTrip.id,
            riderId: prismaTrip.riderId,
            driverId: prismaTrip.driverId ?? undefined,
            vehicleType: prismaTrip.vehicleType,
            status: this.mapStatusToDomain(prismaTrip.status),
            city: prismaTrip.city,
            originLat: prismaTrip.originLat,
            originLng: prismaTrip.originLng,
            originH3Res9: prismaTrip.originH3Res9,
            destLat: prismaTrip.destLat,
            destLng: prismaTrip.destLng,
            destH3Res9: prismaTrip.destH3Res9,
            requestedAt: prismaTrip.requestedAt,
            offeredAt: prismaTrip.offeredAt ?? undefined,
            assignedAt: prismaTrip.assignedAt ?? undefined,
            pickupStartedAt: prismaTrip.pickupStartedAt ?? undefined,
            inProgressAt: prismaTrip.inProgressAt ?? undefined,
            completedAt: prismaTrip.completedAt ?? undefined,
            paidAt: prismaTrip.paidAt ?? undefined,
            quoteId: prismaTrip.quoteId ?? undefined,
            pricingSnapshot: prismaTrip.pricingSnapshot ? prismaTrip.pricingSnapshot : undefined,
            paymentIntentId: prismaTrip.paymentIntentId ?? undefined,
            distance_m_est: prismaTrip.distanceMEst ?? undefined,
            duration_s_est: prismaTrip.durationSEst ?? undefined,
            distance_m_final: prismaTrip.distanceMFinal ?? undefined,
            duration_s_final: prismaTrip.durationSFinal ?? undefined,
            cancelReason: prismaTrip.cancelReason ? this.mapCancelReasonToDomain(prismaTrip.cancelReason) : undefined,
            cancelSide: prismaTrip.cancelSide ? this.mapCancelSideToDomain(prismaTrip.cancelSide) : undefined,
            cancelAt: prismaTrip.cancelAt ?? undefined,
        });
    }
    mapStatusToPrisma(status) {
        return status;
    }
    mapStatusToDomain(status) {
        return status;
    }
    mapCancelReasonToPrisma(reason) {
        return reason;
    }
    mapCancelReasonToDomain(reason) {
        return reason;
    }
    mapCancelSideToPrisma(side) {
        const sideMap = {
            [cancel_side_enum_js_1.CancelSide.RIDER]: 'rider',
            [cancel_side_enum_js_1.CancelSide.DRIVER]: 'driver',
            [cancel_side_enum_js_1.CancelSide.SYSTEM]: 'system',
        };
        return sideMap[side];
    }
    mapCancelSideToDomain(side) {
        const sideMap = {
            'rider': cancel_side_enum_js_1.CancelSide.RIDER,
            'driver': cancel_side_enum_js_1.CancelSide.DRIVER,
            'system': cancel_side_enum_js_1.CancelSide.SYSTEM,
        };
        return sideMap[side];
    }
};
exports.TripPrismaRepository = TripPrismaRepository;
exports.TripPrismaRepository = TripPrismaRepository = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_js_1.PrismaService])
], TripPrismaRepository);
//# sourceMappingURL=trip-prisma.repository.js.map