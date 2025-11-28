"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RadiusTooLargeError = void 0;
class RadiusTooLargeError extends Error {
    tripId;
    actualDistance;
    maxDistance;
    constructor(tripId, actualDistance, maxDistance = 80) {
        super(`Driver is too far from pickup location for trip ${tripId}. Distance: ${actualDistance}m, Max allowed: ${maxDistance}m`);
        this.tripId = tripId;
        this.actualDistance = actualDistance;
        this.maxDistance = maxDistance;
        this.name = 'RadiusTooLargeError';
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.RadiusTooLargeError = RadiusTooLargeError;
//# sourceMappingURL=radius-too-large.error.js.map