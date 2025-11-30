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
var CreateTripUseCase_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateTripUseCase = void 0;
const common_1 = require("@nestjs/common");
const uuid_1 = require("uuid");
const trip_prisma_repository_js_1 = require("../../infrastructure/persistence/prisma/trip-prisma.repository.js");
const trip_audit_prisma_repository_js_1 = require("../../infrastructure/persistence/prisma/trip-audit-prisma.repository.js");
const geo_client_js_1 = require("../../infrastructure/http-clients/geo.client.js");
const pricing_client_js_1 = require("../../infrastructure/http-clients/pricing.client.js");
const trip_entity_js_1 = require("../../domain/entities/trip.entity.js");
const trip_status_enum_js_1 = require("../../domain/enums/trip-status.enum.js");
let CreateTripUseCase = CreateTripUseCase_1 = class CreateTripUseCase {
    tripRepository;
    auditRepository;
    geoClient;
    pricingClient;
    logger = new common_1.Logger(CreateTripUseCase_1.name);
    constructor(tripRepository, auditRepository, geoClient, pricingClient) {
        this.tripRepository = tripRepository;
        this.auditRepository = auditRepository;
        this.geoClient = geoClient;
        this.pricingClient = pricingClient;
    }
    async execute(dto) {
        this.logger.debug(`Creating trip for rider: ${dto.riderId}`);
        const tripId = (0, uuid_1.v4)();
        const distanceResponse = await this.geoClient.distance({ lat: dto.originLat, lng: dto.originLng }, { lat: dto.destLat, lng: dto.destLng });
        const quoteResponse = await this.pricingClient.quote({
            riderId: dto.riderId,
            vehicleType: dto.vehicleType,
            origin: {
                lat: dto.originLat,
                lng: dto.originLng,
                h3_res9: dto.originH3Res9,
            },
            destination: {
                lat: dto.destLat,
                lng: dto.destLng,
                h3_res9: dto.destH3Res9,
            },
        });
        const trip = new trip_entity_js_1.Trip({
            id: tripId,
            riderId: dto.riderId,
            vehicleType: dto.vehicleType,
            status: trip_status_enum_js_1.TripStatus.REQUESTED,
            city: dto.city,
            originLat: dto.originLat,
            originLng: dto.originLng,
            originH3Res9: dto.originH3Res9,
            destLat: dto.destLat,
            destLng: dto.destLng,
            destH3Res9: dto.destH3Res9,
            requestedAt: new Date(),
            quoteId: quoteResponse.quoteId,
            distance_m_est: distanceResponse.distanceMeters,
            duration_s_est: distanceResponse.durationSeconds,
            pricingSnapshot: {
                basePrice: quoteResponse.baseFare,
                surgeMultiplier: quoteResponse.breakdown.dynamicMultiplier,
                totalPrice: quoteResponse.totalPrice,
                currency: quoteResponse.currency,
                breakdown: {
                    distancePrice: quoteResponse.breakdown.distancePrice,
                    timePrice: quoteResponse.breakdown.timePrice,
                    serviceFee: quoteResponse.breakdown.serviceFee,
                },
            },
        });
        const savedTrip = await this.tripRepository.create(trip);
        await this.auditRepository.create({
            tripId: savedTrip.id,
            action: `Status changed to ${trip_status_enum_js_1.TripStatus.REQUESTED}`,
            actorType: 'rider',
            actorId: dto.riderId,
            payload: {
                status: trip_status_enum_js_1.TripStatus.REQUESTED,
                quoteId: quoteResponse.quoteId,
            },
        });
        this.logger.log(`Trip created: ${tripId}, quote: ${quoteResponse.quoteId}`);
        return {
            id: savedTrip.id,
            status: savedTrip.status,
            riderId: savedTrip.riderId,
            vehicleType: savedTrip.vehicleType,
            requestedAt: savedTrip.requestedAt,
        };
    }
};
exports.CreateTripUseCase = CreateTripUseCase;
exports.CreateTripUseCase = CreateTripUseCase = CreateTripUseCase_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [trip_prisma_repository_js_1.TripPrismaRepository,
        trip_audit_prisma_repository_js_1.TripAuditPrismaRepository,
        geo_client_js_1.GeoClient,
        pricing_client_js_1.PricingClient])
], CreateTripUseCase);
//# sourceMappingURL=create-trip.use-case.js.map