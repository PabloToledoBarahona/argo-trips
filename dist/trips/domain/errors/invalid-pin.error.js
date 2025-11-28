"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InvalidPINError = void 0;
class InvalidPINError extends Error {
    tripId;
    attemptsRemaining;
    constructor(tripId, attemptsRemaining) {
        super(`Invalid PIN for trip ${tripId}${attemptsRemaining !== undefined
            ? `. Attempts remaining: ${attemptsRemaining}`
            : ''}`);
        this.tripId = tripId;
        this.attemptsRemaining = attemptsRemaining;
        this.name = 'InvalidPINError';
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.InvalidPINError = InvalidPINError;
//# sourceMappingURL=invalid-pin.error.js.map