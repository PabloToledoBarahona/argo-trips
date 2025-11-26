"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TripStateMachine = void 0;
const common_1 = require("@nestjs/common");
const trip_entity_js_1 = require("../entities/trip.entity.js");
const trip_command_type_js_1 = require("../types/trip-command.type.js");
const trip_status_enum_js_1 = require("../enums/trip-status.enum.js");
let TripStateMachine = class TripStateMachine {
    transition(trip, command, context) {
        const newTrip = new trip_entity_js_1.Trip({ ...trip });
        const timestamp = context.timestamp || new Date();
        switch (command) {
            case trip_command_type_js_1.TripCommand.REQUEST:
                this.validateTransition(trip.status, trip_status_enum_js_1.TripStatus.REQUESTED);
                newTrip.status = trip_status_enum_js_1.TripStatus.REQUESTED;
                newTrip.requestedAt = timestamp;
                break;
            case trip_command_type_js_1.TripCommand.OFFER:
                this.validateTransition(trip.status, trip_status_enum_js_1.TripStatus.OFFERED);
                newTrip.status = trip_status_enum_js_1.TripStatus.OFFERED;
                newTrip.offeredAt = timestamp;
                if (context.quoteId)
                    newTrip.quoteId = context.quoteId;
                break;
            case trip_command_type_js_1.TripCommand.ASSIGN:
                this.validateTransition(trip.status, trip_status_enum_js_1.TripStatus.ASSIGNED);
                if (!context.driverId) {
                    throw new common_1.BadRequestException('Driver ID is required for assignment');
                }
                newTrip.status = trip_status_enum_js_1.TripStatus.ASSIGNED;
                newTrip.driverId = context.driverId;
                newTrip.assignedAt = timestamp;
                break;
            case trip_command_type_js_1.TripCommand.START_PICKUP:
                this.validateTransition(trip.status, trip_status_enum_js_1.TripStatus.PICKUP_STARTED);
                newTrip.status = trip_status_enum_js_1.TripStatus.PICKUP_STARTED;
                newTrip.pickupStartedAt = timestamp;
                break;
            case trip_command_type_js_1.TripCommand.START:
                this.validateTransition(trip.status, trip_status_enum_js_1.TripStatus.IN_PROGRESS);
                newTrip.status = trip_status_enum_js_1.TripStatus.IN_PROGRESS;
                newTrip.inProgressAt = timestamp;
                break;
            case trip_command_type_js_1.TripCommand.COMPLETE:
                this.validateTransition(trip.status, trip_status_enum_js_1.TripStatus.COMPLETED);
                newTrip.status = trip_status_enum_js_1.TripStatus.COMPLETED;
                newTrip.completedAt = timestamp;
                if (context.metrics) {
                    newTrip.distance_m_final = context.metrics.distance_m;
                    newTrip.duration_s_final = context.metrics.duration_s;
                }
                break;
            case trip_command_type_js_1.TripCommand.MARK_PAID:
                this.validateTransition(trip.status, trip_status_enum_js_1.TripStatus.PAID);
                newTrip.status = trip_status_enum_js_1.TripStatus.PAID;
                newTrip.paidAt = timestamp;
                if (context.paymentIntentId) {
                    newTrip.paymentIntentId = context.paymentIntentId;
                }
                break;
            case trip_command_type_js_1.TripCommand.CANCEL:
                newTrip.status = trip_status_enum_js_1.TripStatus.CANCELED;
                newTrip.cancelAt = timestamp;
                if (context.reason)
                    newTrip.cancelReason = context.reason;
                if (context.side)
                    newTrip.cancelSide = context.side;
                break;
            default:
                throw new common_1.BadRequestException(`Unknown command: ${command}`);
        }
        return newTrip;
    }
    validateTransition(currentStatus, targetStatus) {
        const validTransitions = {
            [trip_status_enum_js_1.TripStatus.REQUESTED]: [trip_status_enum_js_1.TripStatus.OFFERED, trip_status_enum_js_1.TripStatus.CANCELED],
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
            throw new common_1.BadRequestException(`Invalid transition from ${currentStatus} to ${targetStatus}`);
        }
    }
};
exports.TripStateMachine = TripStateMachine;
exports.TripStateMachine = TripStateMachine = __decorate([
    (0, common_1.Injectable)()
], TripStateMachine);
//# sourceMappingURL=trip.state-machine.js.map