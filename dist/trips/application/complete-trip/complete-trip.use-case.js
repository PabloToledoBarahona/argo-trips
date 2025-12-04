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
var CompleteTripUseCase_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompleteTripUseCase = void 0;
const common_1 = require("@nestjs/common");
const trip_prisma_repository_js_1 = require("../../infrastructure/persistence/prisma/trip-prisma.repository.js");
const trip_audit_prisma_repository_js_1 = require("../../infrastructure/persistence/prisma/trip-audit-prisma.repository.js");
const pricing_client_js_1 = require("../../infrastructure/http-clients/pricing.client.js");
const payments_client_js_1 = require("../../infrastructure/http-clients/payments.client.js");
const trip_status_enum_js_1 = require("../../domain/enums/trip-status.enum.js");
const vehicle_type_mapper_js_1 = require("../shared/vehicle-type.mapper.js");
let CompleteTripUseCase = CompleteTripUseCase_1 = class CompleteTripUseCase {
    tripRepository;
    auditRepository;
    pricingClient;
    paymentsClient;
    logger = new common_1.Logger(CompleteTripUseCase_1.name);
    constructor(tripRepository, auditRepository, pricingClient, paymentsClient) {
        this.tripRepository = tripRepository;
        this.auditRepository = auditRepository;
        this.pricingClient = pricingClient;
        this.paymentsClient = paymentsClient;
    }
    async execute(dto) {
        this.logger.debug(`Completing trip ${dto.tripId}`);
        const trip = await this.tripRepository.findById(dto.tripId);
        if (!trip) {
            throw new common_1.NotFoundException(`Trip ${dto.tripId} not found`);
        }
        if (trip.status !== trip_status_enum_js_1.TripStatus.IN_PROGRESS) {
            throw new common_1.BadRequestException(`Trip ${dto.tripId} must be in IN_PROGRESS status to complete, current status: ${trip.status}`);
        }
        if (!trip.quoteId) {
            throw new common_1.BadRequestException(`Trip ${dto.tripId} is missing quoteId`);
        }
        const distance_m_final = dto.distance_m_final ?? trip.distance_m_est ?? 0;
        const duration_s_final = dto.duration_s_final ?? trip.duration_s_est ?? 0;
        const pricingVehicleType = (0, vehicle_type_mapper_js_1.mapToPricingVehicleType)(trip.vehicleType);
        let finalPricing;
        try {
            finalPricing = await this.pricingClient.finalize({
                quoteId: trip.quoteId,
                tripId: trip.id,
                city: trip.city,
                vehicleType: pricingVehicleType,
                distance_m_final,
                duration_s_final,
            });
        }
        catch (error) {
            this.logger.error(`Pricing finalize failed for trip ${trip.id}: ${this.formatError(error)}`);
            throw new common_1.BadRequestException('Unable to finalize trip pricing');
        }
        const paymentIntent = await this.paymentsClient.createIntent({
            tripId: trip.id,
            amount: finalPricing.totalPrice,
            currency: finalPricing.currency,
            method: 'card',
        });
        const completedAt = new Date();
        const updatedTrip = await this.tripRepository.update(trip.id, {
            status: trip_status_enum_js_1.TripStatus.COMPLETED,
            completedAt,
            distance_m_final,
            duration_s_final,
            paymentIntentId: paymentIntent.paymentIntentId,
            pricingSnapshot: this.buildFinalizeSnapshot(finalPricing),
        });
        await this.auditRepository.create({
            tripId: trip.id,
            action: `Status changed from ${trip_status_enum_js_1.TripStatus.IN_PROGRESS} to ${trip_status_enum_js_1.TripStatus.COMPLETED}`,
            actorType: 'driver',
            actorId: trip.driverId,
            payload: {
                previousStatus: trip_status_enum_js_1.TripStatus.IN_PROGRESS,
                newStatus: trip_status_enum_js_1.TripStatus.COMPLETED,
                distance_m_final,
                duration_s_final,
                totalPrice: finalPricing.totalPrice,
                quoteId: trip.quoteId,
                surgeMultiplier: finalPricing.surgeMultiplier,
                paymentIntentId: paymentIntent.paymentIntentId,
            },
        });
        this.logger.log(`Trip ${dto.tripId} completed (quote ${trip.quoteId}), final price: ${finalPricing.totalPrice} ${finalPricing.currency}, surge=${finalPricing.surgeMultiplier}, payment intent: ${paymentIntent.paymentIntentId}`);
        return {
            id: updatedTrip.id,
            status: updatedTrip.status,
            completedAt: updatedTrip.completedAt,
            distance_m_final: updatedTrip.distance_m_final,
            duration_s_final: updatedTrip.duration_s_final,
            totalPrice: finalPricing.totalPrice,
            basePrice: finalPricing.basePrice,
            surgeMultiplier: finalPricing.surgeMultiplier,
            currency: finalPricing.currency,
            breakdown: {
                distancePrice: finalPricing.breakdown.distancePrice,
                timePrice: finalPricing.breakdown.timePrice,
                serviceFee: finalPricing.breakdown.serviceFee,
                specialCharges: finalPricing.breakdown.specialCharges,
            },
            paymentIntentId: paymentIntent.paymentIntentId,
        };
    }
    buildFinalizeSnapshot(finalPricing) {
        const breakdown = finalPricing.breakdown ?? {
            distancePrice: 0,
            timePrice: 0,
            serviceFee: 0,
        };
        return {
            basePrice: finalPricing.basePrice,
            surgeMultiplier: finalPricing.surgeMultiplier,
            totalPrice: finalPricing.totalPrice,
            currency: finalPricing.currency,
            breakdown: {
                distancePrice: breakdown.distancePrice ?? 0,
                timePrice: breakdown.timePrice ?? 0,
                serviceFee: breakdown.serviceFee ?? 0,
                specialCharges: breakdown.specialCharges ?? finalPricing.specialCharges,
            },
            taxes: finalPricing.taxes,
        };
    }
    formatError(error) {
        return error instanceof Error ? error.message : String(error);
    }
};
exports.CompleteTripUseCase = CompleteTripUseCase;
exports.CompleteTripUseCase = CompleteTripUseCase = CompleteTripUseCase_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [trip_prisma_repository_js_1.TripPrismaRepository,
        trip_audit_prisma_repository_js_1.TripAuditPrismaRepository,
        pricing_client_js_1.PricingClient,
        payments_client_js_1.PaymentsClient])
], CompleteTripUseCase);
//# sourceMappingURL=complete-trip.use-case.js.map