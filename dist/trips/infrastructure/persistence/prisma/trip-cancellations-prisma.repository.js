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
exports.TripCancellationsPrismaRepository = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_js_1 = require("./prisma.service.js");
const client_1 = require("@prisma/client");
const cancel_reason_enum_js_1 = require("../../../domain/enums/cancel-reason.enum.js");
const cancel_side_enum_js_1 = require("../../../domain/enums/cancel-side.enum.js");
let TripCancellationsPrismaRepository = class TripCancellationsPrismaRepository {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async create(cancellation) {
        const prismaCancellation = await this.prisma.tripCancellation.create({
            data: {
                tripId: cancellation.tripId,
                side: this.mapCancelSideToPrisma(cancellation.side),
                reason: this.mapCancelReasonToPrisma(cancellation.reason),
                secondsSinceAssign: cancellation.secondsSinceAssign,
                feeAppliedDec: cancellation.feeAppliedDec,
            },
        });
        return {
            id: prismaCancellation.id,
            tripId: prismaCancellation.tripId,
            side: prismaCancellation.side,
            reason: prismaCancellation.reason,
            secondsSinceAssign: prismaCancellation.secondsSinceAssign ?? undefined,
            feeAppliedDec: prismaCancellation.feeAppliedDec ? Number(prismaCancellation.feeAppliedDec) : undefined,
            ts: prismaCancellation.ts,
        };
    }
    async findByTripId(tripId) {
        const prismaCancellations = await this.prisma.tripCancellation.findMany({
            where: { tripId },
            orderBy: { ts: 'desc' },
        });
        return prismaCancellations.map(cancellation => ({
            id: cancellation.id,
            tripId: cancellation.tripId,
            side: cancellation.side,
            reason: cancellation.reason,
            secondsSinceAssign: cancellation.secondsSinceAssign ?? undefined,
            feeAppliedDec: cancellation.feeAppliedDec ? Number(cancellation.feeAppliedDec) : undefined,
            ts: cancellation.ts,
        }));
    }
    mapCancelSideToPrisma(side) {
        if (side === cancel_side_enum_js_1.CancelSide.RIDER || side === 'rider')
            return client_1.TripCancelSide.rider;
        if (side === cancel_side_enum_js_1.CancelSide.DRIVER || side === 'driver')
            return client_1.TripCancelSide.driver;
        if (side === cancel_side_enum_js_1.CancelSide.SYSTEM || side === 'system')
            return client_1.TripCancelSide.system;
        return client_1.TripCancelSide.system;
    }
    mapCancelReasonToPrisma(reason) {
        const reasonMap = {
            [cancel_reason_enum_js_1.CancelReason.RIDER_CANCELLED]: client_1.TripCancelReason.RIDER_CANCELLED,
            [cancel_reason_enum_js_1.CancelReason.DRIVER_CANCELLED]: client_1.TripCancelReason.DRIVER_CANCELLED,
            [cancel_reason_enum_js_1.CancelReason.NO_SHOW]: client_1.TripCancelReason.NO_SHOW,
            [cancel_reason_enum_js_1.CancelReason.SYSTEM_TIMEOUT]: client_1.TripCancelReason.SYSTEM_TIMEOUT,
            [cancel_reason_enum_js_1.CancelReason.REASSIGN_EXHAUSTED]: client_1.TripCancelReason.REASSIGN_EXHAUSTED,
        };
        return reasonMap[reason] || client_1.TripCancelReason.SYSTEM_TIMEOUT;
    }
};
exports.TripCancellationsPrismaRepository = TripCancellationsPrismaRepository;
exports.TripCancellationsPrismaRepository = TripCancellationsPrismaRepository = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_js_1.PrismaService])
], TripCancellationsPrismaRepository);
//# sourceMappingURL=trip-cancellations-prisma.repository.js.map