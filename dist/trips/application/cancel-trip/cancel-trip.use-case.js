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
var CancelTripUseCase_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CancelTripUseCase = void 0;
const common_1 = require("@nestjs/common");
const trip_prisma_repository_js_1 = require("../../infrastructure/persistence/prisma/trip-prisma.repository.js");
const trip_audit_prisma_repository_js_1 = require("../../infrastructure/persistence/prisma/trip-audit-prisma.repository.js");
const trip_cancellations_prisma_repository_js_1 = require("../../infrastructure/persistence/prisma/trip-cancellations-prisma.repository.js");
const pin_cache_service_js_1 = require("../../infrastructure/redis/pin-cache.service.js");
const timer_service_js_1 = require("../../infrastructure/redis/timer.service.js");
const trip_status_enum_js_1 = require("../../domain/enums/trip-status.enum.js");
let CancelTripUseCase = CancelTripUseCase_1 = class CancelTripUseCase {
    tripRepository;
    auditRepository;
    cancellationsRepository;
    pinCacheService;
    timerService;
    logger = new common_1.Logger(CancelTripUseCase_1.name);
    constructor(tripRepository, auditRepository, cancellationsRepository, pinCacheService, timerService) {
        this.tripRepository = tripRepository;
        this.auditRepository = auditRepository;
        this.cancellationsRepository = cancellationsRepository;
        this.pinCacheService = pinCacheService;
        this.timerService = timerService;
    }
    async execute(dto) {
        this.logger.debug(`Canceling trip ${dto.tripId}, reason: ${dto.reason}, side: ${dto.side}`);
        const trip = await this.tripRepository.findById(dto.tripId);
        if (!trip) {
            throw new common_1.NotFoundException(`Trip ${dto.tripId} not found`);
        }
        if (trip.status === trip_status_enum_js_1.TripStatus.COMPLETED || trip.status === trip_status_enum_js_1.TripStatus.PAID) {
            throw new common_1.BadRequestException(`Trip ${dto.tripId} cannot be canceled from status ${trip.status}`);
        }
        if (trip.status === trip_status_enum_js_1.TripStatus.CANCELED) {
            this.logger.warn(`Trip ${dto.tripId} is already canceled`);
            return {
                id: trip.id,
                status: trip.status,
                cancelAt: trip.cancelAt,
                cancelReason: trip.cancelReason,
                cancelSide: trip.cancelSide,
            };
        }
        const cancelAt = new Date();
        const updatedTrip = await this.tripRepository.update(trip.id, {
            status: trip_status_enum_js_1.TripStatus.CANCELED,
            cancelAt,
            cancelReason: dto.reason,
            cancelSide: dto.side,
        });
        try {
            await this.pinCacheService.clearPin(trip.id);
        }
        catch (error) {
            this.logger.warn(`Failed to clear PIN for trip ${trip.id}:`, error);
        }
        try {
            await this.timerService.clearOfferExpiry(trip.id);
            await this.timerService.clearNoShow(trip.id);
        }
        catch (error) {
            this.logger.warn(`Failed to clear timers for trip ${trip.id}:`, error);
        }
        await this.auditRepository.create({
            tripId: trip.id,
            action: `Status changed from ${trip.status} to ${trip_status_enum_js_1.TripStatus.CANCELED}`,
            actorType: dto.side,
            actorId: dto.side === 'rider' ? trip.riderId : trip.driverId,
            payload: {
                previousStatus: trip.status,
                newStatus: trip_status_enum_js_1.TripStatus.CANCELED,
                reason: dto.reason,
                notes: dto.notes,
            },
        });
        let secondsSinceAssign;
        if (trip.assignedAt) {
            secondsSinceAssign = Math.floor((cancelAt.getTime() - trip.assignedAt.getTime()) / 1000);
        }
        const cancellationRecord = await this.cancellationsRepository.create({
            tripId: trip.id,
            reason: dto.reason,
            side: dto.side,
            secondsSinceAssign,
            feeAppliedDec: 0,
        });
        this.logger.log(`Trip ${dto.tripId} canceled by ${dto.side}, reason: ${dto.reason}`);
        return {
            id: updatedTrip.id,
            status: updatedTrip.status,
            cancelAt: updatedTrip.cancelAt,
            cancelReason: updatedTrip.cancelReason,
            cancelSide: updatedTrip.cancelSide,
        };
    }
};
exports.CancelTripUseCase = CancelTripUseCase;
exports.CancelTripUseCase = CancelTripUseCase = CancelTripUseCase_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [trip_prisma_repository_js_1.TripPrismaRepository,
        trip_audit_prisma_repository_js_1.TripAuditPrismaRepository,
        trip_cancellations_prisma_repository_js_1.TripCancellationsPrismaRepository,
        pin_cache_service_js_1.PinCacheService,
        timer_service_js_1.TimerService])
], CancelTripUseCase);
//# sourceMappingURL=cancel-trip.use-case.js.map