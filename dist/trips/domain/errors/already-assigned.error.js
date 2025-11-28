"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AlreadyAssignedError = void 0;
class AlreadyAssignedError extends Error {
    tripId;
    existingDriverId;
    attemptedDriverId;
    constructor(tripId, existingDriverId, attemptedDriverId) {
        super(`Trip ${tripId} is already assigned to driver ${existingDriverId}. Cannot assign to ${attemptedDriverId}`);
        this.tripId = tripId;
        this.existingDriverId = existingDriverId;
        this.attemptedDriverId = attemptedDriverId;
        this.name = 'AlreadyAssignedError';
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.AlreadyAssignedError = AlreadyAssignedError;
//# sourceMappingURL=already-assigned.error.js.map