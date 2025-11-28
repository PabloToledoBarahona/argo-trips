"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InvalidStateForPaymentError = void 0;
class InvalidStateForPaymentError extends Error {
    tripId;
    currentStatus;
    constructor(tripId, currentStatus) {
        super(`Trip ${tripId} is in status ${currentStatus}. Payment can only be marked on COMPLETED trips.`);
        this.tripId = tripId;
        this.currentStatus = currentStatus;
        this.name = 'InvalidStateForPaymentError';
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.InvalidStateForPaymentError = InvalidStateForPaymentError;
//# sourceMappingURL=invalid-state-for-payment.error.js.map