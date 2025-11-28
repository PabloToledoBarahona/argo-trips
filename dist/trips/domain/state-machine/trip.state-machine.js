"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var TripStateMachine_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TripStateMachine = void 0;
const common_1 = require("@nestjs/common");
const trip_entity_js_1 = require("../entities/trip.entity.js");
const trip_command_type_js_1 = require("../types/trip-command.type.js");
const trip_status_enum_js_1 = require("../enums/trip-status.enum.js");
const cancel_side_enum_js_1 = require("../enums/cancel-side.enum.js");
const index_js_1 = require("../errors/index.js");
let TripStateMachine = class TripStateMachine {
    static { TripStateMachine_1 = this; }
    static MAX_PICKUP_DISTANCE_METERS = 80;
    transition(trip, command, context) {
        const newTrip = new trip_entity_js_1.Trip({ ...trip });
        const timestamp = context.timestamp || new Date();
        switch (command) {
            case trip_command_type_js_1.TripCommand.REQUEST:
                return this.handleRequest(newTrip, context, timestamp);
            case trip_command_type_js_1.TripCommand.OFFER:
                return this.handleOffer(newTrip, context, timestamp);
            case trip_command_type_js_1.TripCommand.ASSIGN:
                return this.handleAssign(newTrip, context, timestamp);
            case trip_command_type_js_1.TripCommand.START_PICKUP:
                return this.handleStartPickup(newTrip, context, timestamp);
            case trip_command_type_js_1.TripCommand.START:
                return this.handleStart(newTrip, context, timestamp);
            case trip_command_type_js_1.TripCommand.COMPLETE:
                return this.handleComplete(newTrip, context, timestamp);
            case trip_command_type_js_1.TripCommand.CANCEL:
                return this.handleCancel(newTrip, context, timestamp);
            case trip_command_type_js_1.TripCommand.MARK_PAID:
                return this.handleMarkPaid(newTrip, context, timestamp);
            default:
                throw new index_js_1.InvalidTransitionError(trip.status, command, 'Unknown command');
        }
    }
    handleRequest(trip, context, timestamp) {
        trip.status = trip_status_enum_js_1.TripStatus.REQUESTED;
        trip.requestedAt = timestamp;
        if (context.quoteId) {
            trip.quoteId = context.quoteId;
        }
        return trip;
    }
    handleOffer(trip, context, timestamp) {
        if (trip.status === trip_status_enum_js_1.TripStatus.OFFERED) {
            return trip;
        }
        this.validateTransition(trip.status, trip_status_enum_js_1.TripStatus.OFFERED, trip_command_type_js_1.TripCommand.OFFER);
        if (trip.status !== trip_status_enum_js_1.TripStatus.REQUESTED) {
            throw new index_js_1.InvalidTransitionError(trip.status, trip_command_type_js_1.TripCommand.OFFER, trip_status_enum_js_1.TripStatus.OFFERED);
        }
        trip.status = trip_status_enum_js_1.TripStatus.OFFERED;
        trip.offeredAt = timestamp;
        if (context.quoteId) {
            trip.quoteId = context.quoteId;
        }
        return trip;
    }
    handleAssign(trip, context, timestamp) {
        if (!context.driverId) {
            throw new index_js_1.InvalidTransitionError(trip.status, trip_command_type_js_1.TripCommand.ASSIGN, 'Driver ID is required');
        }
        if (trip.status === trip_status_enum_js_1.TripStatus.ASSIGNED &&
            trip.driverId === context.driverId) {
            return trip;
        }
        if (trip.status !== trip_status_enum_js_1.TripStatus.REQUESTED &&
            trip.status !== trip_status_enum_js_1.TripStatus.OFFERED) {
            throw new index_js_1.InvalidTransitionError(trip.status, trip_command_type_js_1.TripCommand.ASSIGN, trip_status_enum_js_1.TripStatus.ASSIGNED);
        }
        if (trip.driverId && trip.driverId !== context.driverId) {
            throw new index_js_1.AlreadyAssignedError(trip.id, trip.driverId, context.driverId);
        }
        if (context.driverOnline === false) {
            throw new index_js_1.DriverNotOnlineError(context.driverId, trip.id);
        }
        if (trip.status === trip_status_enum_js_1.TripStatus.OFFERED && context.offerExpired === true) {
            throw new index_js_1.OfferExpiredError(trip.id, trip.offeredAt);
        }
        this.validateActorAuthorization(context, 'driver', context.driverId, trip_command_type_js_1.TripCommand.ASSIGN);
        trip.status = trip_status_enum_js_1.TripStatus.ASSIGNED;
        trip.driverId = context.driverId;
        trip.assignedAt = timestamp;
        return trip;
    }
    handleStartPickup(trip, context, timestamp) {
        if (trip.status === trip_status_enum_js_1.TripStatus.PICKUP_STARTED) {
            return trip;
        }
        if (trip.status !== trip_status_enum_js_1.TripStatus.ASSIGNED) {
            throw new index_js_1.InvalidTransitionError(trip.status, trip_command_type_js_1.TripCommand.START_PICKUP, trip_status_enum_js_1.TripStatus.PICKUP_STARTED);
        }
        if (!context.driverId || context.driverId !== trip.driverId) {
            throw new index_js_1.UnauthorizedActorError('driver', context.driverId, `driver:${trip.driverId}`, trip_command_type_js_1.TripCommand.START_PICKUP);
        }
        this.validatePIN(trip, context);
        this.validateDistanceToOrigin(trip, context);
        this.validateActorAuthorization(context, 'driver', trip.driverId, trip_command_type_js_1.TripCommand.START_PICKUP);
        trip.status = trip_status_enum_js_1.TripStatus.PICKUP_STARTED;
        trip.pickupStartedAt = timestamp;
        return trip;
    }
    handleStart(trip, context, timestamp) {
        if (trip.status === trip_status_enum_js_1.TripStatus.IN_PROGRESS) {
            return trip;
        }
        if (trip.status !== trip_status_enum_js_1.TripStatus.PICKUP_STARTED) {
            throw new index_js_1.InvalidTransitionError(trip.status, trip_command_type_js_1.TripCommand.START, trip_status_enum_js_1.TripStatus.IN_PROGRESS);
        }
        if (!context.driverId || context.driverId !== trip.driverId) {
            throw new index_js_1.UnauthorizedActorError('driver', context.driverId, `driver:${trip.driverId}`, trip_command_type_js_1.TripCommand.START);
        }
        this.validateActorAuthorization(context, 'driver', trip.driverId, trip_command_type_js_1.TripCommand.START);
        trip.status = trip_status_enum_js_1.TripStatus.IN_PROGRESS;
        trip.inProgressAt = timestamp;
        return trip;
    }
    handleComplete(trip, context, timestamp) {
        if (trip.status === trip_status_enum_js_1.TripStatus.COMPLETED) {
            return trip;
        }
        if (trip.status !== trip_status_enum_js_1.TripStatus.IN_PROGRESS) {
            throw new index_js_1.InvalidTransitionError(trip.status, trip_command_type_js_1.TripCommand.COMPLETE, trip_status_enum_js_1.TripStatus.COMPLETED);
        }
        if (!context.driverId || context.driverId !== trip.driverId) {
            throw new index_js_1.UnauthorizedActorError('driver', context.driverId, `driver:${trip.driverId}`, trip_command_type_js_1.TripCommand.COMPLETE);
        }
        if (!context.metrics) {
            throw new index_js_1.MissingMetricsError(trip.id, trip_command_type_js_1.TripCommand.COMPLETE);
        }
        if (!context.pricingResult) {
            throw new index_js_1.MissingPricingSnapshotError(trip.id, trip_command_type_js_1.TripCommand.COMPLETE);
        }
        this.validateActorAuthorization(context, 'driver', trip.driverId, trip_command_type_js_1.TripCommand.COMPLETE);
        trip.status = trip_status_enum_js_1.TripStatus.COMPLETED;
        trip.completedAt = timestamp;
        trip.distance_m_final = context.metrics.distance_m;
        trip.duration_s_final = context.metrics.duration_s;
        trip.pricingSnapshot = context.pricingResult.snapshot;
        trip.quoteId = context.pricingResult.quoteId;
        if (context.pricingResult.snapshot) {
            if (context.paymentIntentId) {
                trip.paymentIntentId = context.paymentIntentId;
            }
        }
        return trip;
    }
    handleCancel(trip, context, timestamp) {
        if (trip.status === trip_status_enum_js_1.TripStatus.CANCELED) {
            return trip;
        }
        const cancellableStates = [
            trip_status_enum_js_1.TripStatus.REQUESTED,
            trip_status_enum_js_1.TripStatus.OFFERED,
            trip_status_enum_js_1.TripStatus.ASSIGNED,
            trip_status_enum_js_1.TripStatus.PICKUP_STARTED,
            trip_status_enum_js_1.TripStatus.IN_PROGRESS,
        ];
        if (!cancellableStates.includes(trip.status)) {
            throw new index_js_1.InvalidTransitionError(trip.status, trip_command_type_js_1.TripCommand.CANCEL, trip_status_enum_js_1.TripStatus.CANCELED);
        }
        if (!context.side || !context.reason) {
            throw new index_js_1.InvalidTransitionError(trip.status, trip_command_type_js_1.TripCommand.CANCEL, 'Cancel side and reason are required');
        }
        this.validateCancelAuthorization(trip, context);
        if (!context.pricingResult) {
            throw new index_js_1.MissingPricingSnapshotError(trip.id, trip_command_type_js_1.TripCommand.CANCEL);
        }
        trip.status = trip_status_enum_js_1.TripStatus.CANCELED;
        trip.cancelAt = timestamp;
        trip.cancelSide = context.side;
        trip.cancelReason = context.reason;
        trip.pricingSnapshot = context.pricingResult.snapshot;
        if (context.paymentIntentId) {
            trip.paymentIntentId = context.paymentIntentId;
        }
        return trip;
    }
    handleMarkPaid(trip, context, timestamp) {
        if (trip.status === trip_status_enum_js_1.TripStatus.PAID) {
            return trip;
        }
        if (trip.status !== trip_status_enum_js_1.TripStatus.COMPLETED) {
            throw new index_js_1.InvalidStateForPaymentError(trip.id, trip.status);
        }
        if (!context.paymentResult) {
            throw new index_js_1.PaymentNotCapturedError(trip.id, trip.paymentIntentId);
        }
        trip.status = trip_status_enum_js_1.TripStatus.PAID;
        trip.paidAt = timestamp;
        trip.paymentIntentId = context.paymentResult.paymentIntentId;
        return trip;
    }
    validateTransition(currentStatus, targetStatus, command) {
        const validTransitions = {
            [trip_status_enum_js_1.TripStatus.REQUESTED]: [
                trip_status_enum_js_1.TripStatus.OFFERED,
                trip_status_enum_js_1.TripStatus.ASSIGNED,
                trip_status_enum_js_1.TripStatus.CANCELED,
            ],
            [trip_status_enum_js_1.TripStatus.OFFERED]: [trip_status_enum_js_1.TripStatus.ASSIGNED, trip_status_enum_js_1.TripStatus.CANCELED],
            [trip_status_enum_js_1.TripStatus.ASSIGNED]: [
                trip_status_enum_js_1.TripStatus.PICKUP_STARTED,
                trip_status_enum_js_1.TripStatus.CANCELED,
            ],
            [trip_status_enum_js_1.TripStatus.PICKUP_STARTED]: [
                trip_status_enum_js_1.TripStatus.IN_PROGRESS,
                trip_status_enum_js_1.TripStatus.CANCELED,
            ],
            [trip_status_enum_js_1.TripStatus.IN_PROGRESS]: [trip_status_enum_js_1.TripStatus.COMPLETED, trip_status_enum_js_1.TripStatus.CANCELED],
            [trip_status_enum_js_1.TripStatus.COMPLETED]: [trip_status_enum_js_1.TripStatus.PAID],
            [trip_status_enum_js_1.TripStatus.PAID]: [],
            [trip_status_enum_js_1.TripStatus.CANCELED]: [],
        };
        const allowedTransitions = validTransitions[currentStatus] || [];
        if (!allowedTransitions.includes(targetStatus)) {
            throw new index_js_1.InvalidTransitionError(currentStatus, command, targetStatus);
        }
    }
    validatePIN(trip, context) {
        if (!context.pin) {
            throw new index_js_1.InvalidPINError(trip.id);
        }
    }
    validateDistanceToOrigin(trip, context) {
        if (context.distanceToOriginMeters === undefined) {
            throw new index_js_1.RadiusTooLargeError(trip.id, Infinity, TripStateMachine_1.MAX_PICKUP_DISTANCE_METERS);
        }
        if (context.distanceToOriginMeters >
            TripStateMachine_1.MAX_PICKUP_DISTANCE_METERS) {
            throw new index_js_1.RadiusTooLargeError(trip.id, context.distanceToOriginMeters, TripStateMachine_1.MAX_PICKUP_DISTANCE_METERS);
        }
    }
    validateActorAuthorization(context, expectedType, expectedId, command) {
        if (!context.actor) {
            return;
        }
        if (context.actor.type !== expectedType) {
            throw new index_js_1.UnauthorizedActorError(context.actor.type, context.actor.id, expectedType, command);
        }
        if (expectedId && context.actor.id !== expectedId) {
            throw new index_js_1.UnauthorizedActorError(context.actor.type, context.actor.id, `${expectedType}:${expectedId}`, command);
        }
    }
    validateCancelAuthorization(trip, context) {
        if (!context.side) {
            return;
        }
        if (context.actor) {
            switch (context.side) {
                case cancel_side_enum_js_1.CancelSide.RIDER:
                    if (context.actor.type !== 'rider') {
                        throw new index_js_1.UnauthorizedActorError(context.actor.type, context.actor.id, 'rider', trip_command_type_js_1.TripCommand.CANCEL);
                    }
                    if (context.actor.id !== trip.riderId) {
                        throw new index_js_1.UnauthorizedActorError(context.actor.type, context.actor.id, `rider:${trip.riderId}`, trip_command_type_js_1.TripCommand.CANCEL);
                    }
                    break;
                case cancel_side_enum_js_1.CancelSide.DRIVER:
                    if (context.actor.type !== 'driver') {
                        throw new index_js_1.UnauthorizedActorError(context.actor.type, context.actor.id, 'driver', trip_command_type_js_1.TripCommand.CANCEL);
                    }
                    if (trip.driverId && context.actor.id !== trip.driverId) {
                        throw new index_js_1.UnauthorizedActorError(context.actor.type, context.actor.id, `driver:${trip.driverId}`, trip_command_type_js_1.TripCommand.CANCEL);
                    }
                    break;
                case cancel_side_enum_js_1.CancelSide.SYSTEM:
                    if (context.actor.type !== 'system') {
                        throw new index_js_1.UnauthorizedActorError(context.actor.type, context.actor.id, 'system', trip_command_type_js_1.TripCommand.CANCEL);
                    }
                    break;
            }
        }
    }
};
exports.TripStateMachine = TripStateMachine;
exports.TripStateMachine = TripStateMachine = TripStateMachine_1 = __decorate([
    (0, common_1.Injectable)()
], TripStateMachine);
//# sourceMappingURL=trip.state-machine.js.map