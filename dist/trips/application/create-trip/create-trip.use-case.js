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
const vehicle_type_mapper_js_1 = require("../shared/vehicle-type.mapper.js");
const geo_profile_mapper_js_1 = require("../shared/geo-profile.mapper.js");
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
        const originCoordinates = { lat: dto.originLat, lng: dto.originLng };
        const destinationCoordinates = { lat: dto.destLat, lng: dto.destLng };
        let originH3Res7;
        let originH3Res9;
        let destH3Res7;
        let destH3Res9;
        let distanceMeters;
        let durationSeconds;
        const geoProfile = (0, geo_profile_mapper_js_1.mapToGeoProfile)(dto.vehicleType);
        try {
            const h3Response = await this.geoClient.h3Encode({
                ops: [
                    { op: 'encode', lat: dto.originLat, lng: dto.originLng, res: 9 },
                    { op: 'encode', lat: dto.originLat, lng: dto.originLng, res: 7 },
                    { op: 'encode', lat: dto.destLat, lng: dto.destLng, res: 9 },
                    { op: 'encode', lat: dto.destLat, lng: dto.destLng, res: 7 },
                ],
            });
            const [originRes9Result, originRes7Result, destRes9Result, destRes7Result] = h3Response.results;
            if (originRes9Result.op === 'encode' && !('error' in originRes9Result)) {
                originH3Res9 = originRes9Result.h3;
            }
            if (originRes7Result.op === 'encode' && !('error' in originRes7Result)) {
                originH3Res7 = originRes7Result.h3;
            }
            if (destRes9Result.op === 'encode' && !('error' in destRes9Result)) {
                destH3Res9 = destRes9Result.h3;
            }
            if (destRes7Result.op === 'encode' && !('error' in destRes7Result)) {
                destH3Res7 = destRes7Result.h3;
            }
        }
        catch (error) {
            this.logger.error(`Failed to resolve H3 indexes for trip ${tripId}: ${this.formatError(error)}`);
        }
        try {
            const routeResponse = await this.geoClient.route({
                origin: originCoordinates,
                destination: destinationCoordinates,
                profile: geoProfile,
                city: dto.city,
                include_polyline: false,
                alternatives: 0,
            });
            distanceMeters = routeResponse.distance_m;
            durationSeconds = routeResponse.duration_sec;
            this.logger.debug(`Route calculated for trip ${tripId}: ${distanceMeters}m, ${durationSeconds}s, engine=${routeResponse.engine}`);
        }
        catch (error) {
            this.logger.error(`GEO route failed for trip ${tripId}: ${this.formatError(error)}. Will use Pricing service fallback.`);
        }
        const resolvedOriginH3Res9 = originH3Res9 ?? dto.originH3Res9;
        const resolvedDestH3Res9 = destH3Res9 ?? dto.destH3Res9;
        if (!resolvedOriginH3Res9 || !resolvedDestH3Res9) {
            throw new common_1.BadRequestException('Missing origin/destination H3 indices');
        }
        const pricingVehicleType = (0, vehicle_type_mapper_js_1.mapToPricingVehicleType)(dto.vehicleType);
        const quoteRequest = {
            city: dto.city,
            vehicleType: pricingVehicleType,
            riderId: dto.riderId,
            origin: {
                lat: dto.originLat,
                lng: dto.originLng,
                h3_res7: originH3Res7,
                h3_res9: resolvedOriginH3Res9,
            },
            destination: {
                lat: dto.destLat,
                lng: dto.destLng,
                h3_res7: destH3Res7,
                h3_res9: resolvedDestH3Res9,
            },
            distance_m: distanceMeters,
            duration_s: durationSeconds,
        };
        let quoteResponse;
        try {
            quoteResponse = await this.pricingClient.quote(quoteRequest);
        }
        catch (error) {
            this.logger.error(`Pricing quote failed for trip ${tripId}: ${this.formatError(error)}`);
            throw new common_1.BadRequestException('Unable to retrieve pricing quote');
        }
        distanceMeters = distanceMeters ?? quoteResponse.distanceMeters;
        durationSeconds = durationSeconds ?? quoteResponse.durationSeconds;
        const trip = new trip_entity_js_1.Trip({
            id: tripId,
            riderId: dto.riderId,
            vehicleType: pricingVehicleType,
            status: trip_status_enum_js_1.TripStatus.REQUESTED,
            city: dto.city,
            originLat: dto.originLat,
            originLng: dto.originLng,
            originH3Res9: resolvedOriginH3Res9,
            destLat: dto.destLat,
            destLng: dto.destLng,
            destH3Res9: resolvedDestH3Res9,
            requestedAt: new Date(),
            quoteId: quoteResponse.quoteId,
            distance_m_est: distanceMeters,
            duration_s_est: durationSeconds,
            pricingSnapshot: this.buildQuoteSnapshot(quoteResponse),
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
        this.logger.log(`Trip created: ${tripId}, quote: ${quoteResponse.quoteId}, est total: ${quoteResponse.estimateTotal} ${quoteResponse.currency}, surge=${quoteResponse.surgeMultiplier}`);
        return {
            id: savedTrip.id,
            status: savedTrip.status,
            riderId: savedTrip.riderId,
            vehicleType: savedTrip.vehicleType,
            requestedAt: savedTrip.requestedAt,
            quoteId: quoteResponse.quoteId,
            estimateTotal: quoteResponse.estimateTotal,
            basePrice: quoteResponse.basePrice,
            surgeMultiplier: quoteResponse.surgeMultiplier,
            currency: quoteResponse.currency,
            breakdown: {
                distancePrice: quoteResponse.breakdown.distancePrice,
                timePrice: quoteResponse.breakdown.timePrice,
                serviceFee: quoteResponse.breakdown.serviceFee,
                specialCharges: quoteResponse.breakdown.specialCharges,
            },
            distanceMeters: quoteResponse.distanceMeters,
            durationSeconds: quoteResponse.durationSeconds,
        };
    }
    buildQuoteSnapshot(quote) {
        const breakdown = quote.breakdown ?? {
            distancePrice: 0,
            timePrice: 0,
            serviceFee: 0,
        };
        return {
            basePrice: quote.basePrice,
            surgeMultiplier: quote.surgeMultiplier,
            totalPrice: quote.estimateTotal,
            currency: quote.currency,
            breakdown: {
                distancePrice: breakdown.distancePrice ?? 0,
                timePrice: breakdown.timePrice ?? 0,
                serviceFee: breakdown.serviceFee ?? 0,
                specialCharges: breakdown.specialCharges,
            },
        };
    }
    formatError(error) {
        return error instanceof Error ? error.message : String(error);
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