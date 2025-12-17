"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Trip = void 0;
class Trip {
    id;
    riderId;
    driverId;
    vehicleType;
    status;
    city;
    originLat;
    originLng;
    originH3Res9;
    originH3Res7;
    destLat;
    destLng;
    destH3Res9;
    destH3Res7;
    requestedAt;
    offeredAt;
    assignedAt;
    pickupStartedAt;
    inProgressAt;
    completedAt;
    paidAt;
    quoteId;
    pricingSnapshot;
    paymentIntentId;
    distance_m_est;
    duration_s_est;
    distance_m_final;
    duration_s_final;
    cancelReason;
    cancelSide;
    cancelAt;
    constructor(data) {
        Object.assign(this, data);
    }
}
exports.Trip = Trip;
//# sourceMappingURL=trip.entity.js.map