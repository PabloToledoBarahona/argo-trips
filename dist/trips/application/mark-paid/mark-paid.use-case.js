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
var MarkPaidUseCase_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MarkPaidUseCase = void 0;
const common_1 = require("@nestjs/common");
const trip_prisma_repository_js_1 = require("../../infrastructure/persistence/prisma/trip-prisma.repository.js");
const trip_audit_prisma_repository_js_1 = require("../../infrastructure/persistence/prisma/trip-audit-prisma.repository.js");
const payments_client_js_1 = require("../../infrastructure/http-clients/payments.client.js");
const trip_status_enum_js_1 = require("../../domain/enums/trip-status.enum.js");
let MarkPaidUseCase = MarkPaidUseCase_1 = class MarkPaidUseCase {
    tripRepository;
    auditRepository;
    paymentsClient;
    logger = new common_1.Logger(MarkPaidUseCase_1.name);
    constructor(tripRepository, auditRepository, paymentsClient) {
        this.tripRepository = tripRepository;
        this.auditRepository = auditRepository;
        this.paymentsClient = paymentsClient;
    }
    async execute(dto) {
        this.logger.debug(`Marking trip ${dto.tripId} as paid with payment intent ${dto.paymentIntentId}`);
        const trip = await this.tripRepository.findById(dto.tripId);
        if (!trip) {
            throw new common_1.NotFoundException(`Trip ${dto.tripId} not found`);
        }
        if (trip.status !== trip_status_enum_js_1.TripStatus.COMPLETED) {
            throw new common_1.BadRequestException(`Trip ${dto.tripId} must be in COMPLETED status to mark as paid, current status: ${trip.status}`);
        }
        if (trip.paymentIntentId !== dto.paymentIntentId) {
            throw new common_1.BadRequestException(`Payment intent ID mismatch. Trip has ${trip.paymentIntentId}, provided ${dto.paymentIntentId}`);
        }
        const paymentIntent = await this.paymentsClient.getIntent(dto.paymentIntentId);
        if (paymentIntent.status !== 'succeeded') {
            throw new common_1.BadRequestException(`Payment intent ${dto.paymentIntentId} is not succeeded, current status: ${paymentIntent.status}`);
        }
        const paidAt = new Date();
        const updatedTrip = await this.tripRepository.update(trip.id, {
            status: trip_status_enum_js_1.TripStatus.PAID,
            paidAt,
        });
        await this.auditRepository.create({
            tripId: trip.id,
            action: `Status changed from ${trip_status_enum_js_1.TripStatus.COMPLETED} to ${trip_status_enum_js_1.TripStatus.PAID}`,
            actorType: 'system',
            actorId: undefined,
            payload: {
                previousStatus: trip_status_enum_js_1.TripStatus.COMPLETED,
                newStatus: trip_status_enum_js_1.TripStatus.PAID,
                paymentIntentId: dto.paymentIntentId,
            },
        });
        this.logger.log(`Trip ${dto.tripId} marked as paid, payment intent: ${dto.paymentIntentId}`);
        return {
            id: updatedTrip.id,
            status: updatedTrip.status,
            paidAt: updatedTrip.paidAt,
            paymentIntentId: updatedTrip.paymentIntentId,
        };
    }
};
exports.MarkPaidUseCase = MarkPaidUseCase;
exports.MarkPaidUseCase = MarkPaidUseCase = MarkPaidUseCase_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [trip_prisma_repository_js_1.TripPrismaRepository,
        trip_audit_prisma_repository_js_1.TripAuditPrismaRepository,
        payments_client_js_1.PaymentsClient])
], MarkPaidUseCase);
//# sourceMappingURL=mark-paid.use-case.js.map