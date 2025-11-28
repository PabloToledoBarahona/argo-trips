"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NoShowTimeoutError = void 0;
class NoShowTimeoutError extends Error {
    tripId;
    pickupStartedAt;
    constructor(tripId, pickupStartedAt) {
        super(`No-show timeout for trip ${tripId}. Pickup started at ${pickupStartedAt.toISOString()} but rider did not board.`);
        this.tripId = tripId;
        this.pickupStartedAt = pickupStartedAt;
        this.name = 'NoShowTimeoutError';
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.NoShowTimeoutError = NoShowTimeoutError;
//# sourceMappingURL=no-show-timeout.error.js.map