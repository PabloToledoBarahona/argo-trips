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
var AcceptTripUseCase_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AcceptTripUseCase = void 0;
const common_1 = require("@nestjs/common");
const trip_prisma_repository_js_1 = require("../../infrastructure/persistence/prisma/trip-prisma.repository.js");
const trip_audit_prisma_repository_js_1 = require("../../infrastructure/persistence/prisma/trip-audit-prisma.repository.js");
const driver_sessions_client_js_1 = require("../../infrastructure/http-clients/driver-sessions.client.js");
const geo_client_js_1 = require("../../infrastructure/http-clients/geo.client.js");
const pin_cache_service_js_1 = require("../../infrastructure/redis/pin-cache.service.js");
const timer_service_js_1 = require("../../infrastructure/redis/timer.service.js");
const trip_status_enum_js_1 = require("../../domain/enums/trip-status.enum.js");
const geo_profile_mapper_js_1 = require("../shared/geo-profile.mapper.js");
let AcceptTripUseCase = AcceptTripUseCase_1 = class AcceptTripUseCase {
    tripRepository;
    auditRepository;
    driverSessionsClient;
    geoClient;
    pinCacheService;
    timerService;
    logger = new common_1.Logger(AcceptTripUseCase_1.name);
    PIN_TTL_SECONDS = 900;
    RIDER_NO_SHOW_SECONDS = 300;
    constructor(tripRepository, auditRepository, driverSessionsClient, geoClient, pinCacheService, timerService) {
        this.tripRepository = tripRepository;
        this.auditRepository = auditRepository;
        this.driverSessionsClient = driverSessionsClient;
        this.geoClient = geoClient;
        this.pinCacheService = pinCacheService;
        this.timerService = timerService;
    }
    async execute(dto) {
        this.logger.debug(`Driver ${dto.driverId} accepting trip ${dto.tripId}`);
        const trip = await this.tripRepository.findById(dto.tripId);
        if (!trip) {
            throw new common_1.NotFoundException(`Trip ${dto.tripId} not found`);
        }
        if (trip.status !== trip_status_enum_js_1.TripStatus.REQUESTED && trip.status !== trip_status_enum_js_1.TripStatus.OFFERED) {
            throw new common_1.BadRequestException(`Trip ${dto.tripId} cannot be accepted from status ${trip.status}`);
        }
        const driverSession = await this.driverSessionsClient.getSession(dto.driverId);
        if (!driverSession.online) {
            throw new common_1.BadRequestException(`Driver ${dto.driverId} is not online`);
        }
        if (!driverSession.eligibility.ok) {
            throw new common_1.BadRequestException(`Driver ${dto.driverId} is not eligible: ${driverSession.eligibility.status}`);
        }
        if (!driverSession.last_loc) {
            throw new common_1.BadRequestException(`Driver ${dto.driverId} has no location data available`);
        }
        const geoProfile = (0, geo_profile_mapper_js_1.mapToGeoProfile)(trip.vehicleType);
        const etaResponse = await this.geoClient.eta({
            origins: [
                {
                    lat: driverSession.last_loc.lat,
                    lng: driverSession.last_loc.lng,
                },
            ],
            destinations: [{ lat: trip.originLat, lng: trip.originLng }],
            profile: geoProfile,
            city: trip.city,
        });
        const etaPair = etaResponse.pairs[0];
        if (!etaPair) {
            throw new common_1.BadRequestException('Failed to calculate ETA: no results from GEO service');
        }
        const etaSeconds = etaPair.duration_sec;
        const etaDistance = etaPair.distance_m;
        this.logger.debug(`ETA calculated for driver ${dto.driverId} to pickup: ${etaSeconds}s, ${etaDistance}m, engine=${etaResponse.engine}`);
        const pin = this.generatePin();
        await this.pinCacheService.setPin(trip.id, pin, this.PIN_TTL_SECONDS);
        await this.timerService.setRiderNoShow(trip.id, this.RIDER_NO_SHOW_SECONDS);
        this.logger.log(`PIN generated for trip ${trip.id} (not logged for security)`);
        const assignedAt = new Date();
        const updatedTrip = await this.tripRepository.update(trip.id, {
            driverId: dto.driverId,
            status: trip_status_enum_js_1.TripStatus.ASSIGNED,
            assignedAt,
        });
        await this.auditRepository.create({
            tripId: trip.id,
            action: `Status changed from ${trip.status} to ${trip_status_enum_js_1.TripStatus.ASSIGNED}`,
            actorType: 'driver',
            actorId: dto.driverId,
            payload: {
                previousStatus: trip.status,
                newStatus: trip_status_enum_js_1.TripStatus.ASSIGNED,
                etaSeconds,
                etaDistanceMeters: etaDistance,
                geoEngine: etaResponse.engine,
                geoDegradation: etaResponse.degradation,
            },
        });
        this.logger.log(`Trip ${trip.id} accepted by driver ${dto.driverId}, ETA: ${etaSeconds}s (${etaDistance}m)`);
        return {
            id: updatedTrip.id,
            status: updatedTrip.status,
            driverId: updatedTrip.driverId,
            assignedAt: updatedTrip.assignedAt,
        };
    }
    generatePin() {
        return Math.floor(1000 + Math.random() * 9000).toString();
    }
};
exports.AcceptTripUseCase = AcceptTripUseCase;
exports.AcceptTripUseCase = AcceptTripUseCase = AcceptTripUseCase_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [trip_prisma_repository_js_1.TripPrismaRepository,
        trip_audit_prisma_repository_js_1.TripAuditPrismaRepository,
        driver_sessions_client_js_1.DriverSessionsClient,
        geo_client_js_1.GeoClient,
        pin_cache_service_js_1.PinCacheService,
        timer_service_js_1.TimerService])
], AcceptTripUseCase);
//# sourceMappingURL=accept-trip.use-case.js.map