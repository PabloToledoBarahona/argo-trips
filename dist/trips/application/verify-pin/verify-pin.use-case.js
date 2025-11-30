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
var VerifyPinUseCase_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.VerifyPinUseCase = void 0;
const common_1 = require("@nestjs/common");
const trip_prisma_repository_js_1 = require("../../infrastructure/persistence/prisma/trip-prisma.repository.js");
const trip_audit_prisma_repository_js_1 = require("../../infrastructure/persistence/prisma/trip-audit-prisma.repository.js");
const pin_cache_service_js_1 = require("../../infrastructure/redis/pin-cache.service.js");
const timer_service_js_1 = require("../../infrastructure/redis/timer.service.js");
const trip_status_enum_js_1 = require("../../domain/enums/trip-status.enum.js");
let VerifyPinUseCase = VerifyPinUseCase_1 = class VerifyPinUseCase {
    tripRepository;
    auditRepository;
    pinCacheService;
    timerService;
    logger = new common_1.Logger(VerifyPinUseCase_1.name);
    DRIVER_NO_SHOW_SECONDS = 600;
    constructor(tripRepository, auditRepository, pinCacheService, timerService) {
        this.tripRepository = tripRepository;
        this.auditRepository = auditRepository;
        this.pinCacheService = pinCacheService;
        this.timerService = timerService;
    }
    async execute(dto) {
        this.logger.debug(`Verifying PIN for trip ${dto.tripId}`);
        const trip = await this.tripRepository.findById(dto.tripId);
        if (!trip) {
            throw new common_1.NotFoundException(`Trip ${dto.tripId} not found`);
        }
        if (trip.status !== trip_status_enum_js_1.TripStatus.ASSIGNED) {
            throw new common_1.BadRequestException(`Trip ${dto.tripId} must be in ASSIGNED status to verify PIN, current status: ${trip.status}`);
        }
        const isBlocked = await this.pinCacheService.isBlocked(dto.tripId);
        if (isBlocked) {
            this.logger.warn(`PIN verification blocked for trip ${dto.tripId} due to max attempts`);
            throw new common_1.BadRequestException('PIN verification blocked due to too many failed attempts');
        }
        const isValid = await this.pinCacheService.validatePin(dto.tripId, dto.pin);
        if (!isValid) {
            this.logger.warn(`Invalid PIN attempt for trip ${dto.tripId}`);
            return {
                verified: false,
                tripId: dto.tripId,
            };
        }
        const pickupStartedAt = new Date();
        await this.tripRepository.update(trip.id, {
            status: trip_status_enum_js_1.TripStatus.PICKUP_STARTED,
            pickupStartedAt,
        });
        await this.timerService.clearNoShow(trip.id);
        await this.timerService.setDriverNoShow(trip.id, this.DRIVER_NO_SHOW_SECONDS);
        await this.pinCacheService.clearPin(trip.id);
        await this.auditRepository.create({
            tripId: trip.id,
            action: `Status changed from ${trip_status_enum_js_1.TripStatus.ASSIGNED} to ${trip_status_enum_js_1.TripStatus.PICKUP_STARTED}`,
            actorType: 'rider',
            actorId: trip.riderId,
            payload: {
                previousStatus: trip_status_enum_js_1.TripStatus.ASSIGNED,
                newStatus: trip_status_enum_js_1.TripStatus.PICKUP_STARTED,
                pinVerified: true,
            },
        });
        this.logger.log(`PIN verified for trip ${dto.tripId}, status changed to PICKUP_STARTED`);
        return {
            verified: true,
            tripId: dto.tripId,
        };
    }
};
exports.VerifyPinUseCase = VerifyPinUseCase;
exports.VerifyPinUseCase = VerifyPinUseCase = VerifyPinUseCase_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [trip_prisma_repository_js_1.TripPrismaRepository,
        trip_audit_prisma_repository_js_1.TripAuditPrismaRepository,
        pin_cache_service_js_1.PinCacheService,
        timer_service_js_1.TimerService])
], VerifyPinUseCase);
//# sourceMappingURL=verify-pin.use-case.js.map