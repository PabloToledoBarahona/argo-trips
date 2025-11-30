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
var StartTripUseCase_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.StartTripUseCase = void 0;
const common_1 = require("@nestjs/common");
const trip_prisma_repository_js_1 = require("../../infrastructure/persistence/prisma/trip-prisma.repository.js");
const trip_audit_prisma_repository_js_1 = require("../../infrastructure/persistence/prisma/trip-audit-prisma.repository.js");
const timer_service_js_1 = require("../../infrastructure/redis/timer.service.js");
const trip_status_enum_js_1 = require("../../domain/enums/trip-status.enum.js");
let StartTripUseCase = StartTripUseCase_1 = class StartTripUseCase {
    tripRepository;
    auditRepository;
    timerService;
    logger = new common_1.Logger(StartTripUseCase_1.name);
    constructor(tripRepository, auditRepository, timerService) {
        this.tripRepository = tripRepository;
        this.auditRepository = auditRepository;
        this.timerService = timerService;
    }
    async execute(dto) {
        this.logger.debug(`Starting trip ${dto.tripId}`);
        const trip = await this.tripRepository.findById(dto.tripId);
        if (!trip) {
            throw new common_1.NotFoundException(`Trip ${dto.tripId} not found`);
        }
        if (trip.status !== trip_status_enum_js_1.TripStatus.PICKUP_STARTED) {
            throw new common_1.BadRequestException(`Trip ${dto.tripId} must be in PICKUP_STARTED status to start, current status: ${trip.status}`);
        }
        const inProgressAt = new Date();
        const updatedTrip = await this.tripRepository.update(trip.id, {
            status: trip_status_enum_js_1.TripStatus.IN_PROGRESS,
            inProgressAt,
        });
        await this.timerService.clearNoShow(trip.id);
        await this.auditRepository.create({
            tripId: trip.id,
            action: `Status changed from ${trip_status_enum_js_1.TripStatus.PICKUP_STARTED} to ${trip_status_enum_js_1.TripStatus.IN_PROGRESS}`,
            actorType: 'driver',
            actorId: trip.driverId,
            payload: {
                previousStatus: trip_status_enum_js_1.TripStatus.PICKUP_STARTED,
                newStatus: trip_status_enum_js_1.TripStatus.IN_PROGRESS,
            },
        });
        this.logger.log(`Trip ${dto.tripId} started, status changed to IN_PROGRESS`);
        return {
            id: updatedTrip.id,
            status: updatedTrip.status,
            inProgressAt: updatedTrip.inProgressAt,
        };
    }
};
exports.StartTripUseCase = StartTripUseCase;
exports.StartTripUseCase = StartTripUseCase = StartTripUseCase_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [trip_prisma_repository_js_1.TripPrismaRepository,
        trip_audit_prisma_repository_js_1.TripAuditPrismaRepository,
        timer_service_js_1.TimerService])
], StartTripUseCase);
//# sourceMappingURL=start-trip.use-case.js.map