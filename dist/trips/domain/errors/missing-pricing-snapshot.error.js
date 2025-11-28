"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MissingPricingSnapshotError = void 0;
class MissingPricingSnapshotError extends Error {
    tripId;
    command;
    constructor(tripId, command) {
        super(`Missing pricing snapshot from Pricing/finalize for ${command} on trip ${tripId}`);
        this.tripId = tripId;
        this.command = command;
        this.name = 'MissingPricingSnapshotError';
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.MissingPricingSnapshotError = MissingPricingSnapshotError;
//# sourceMappingURL=missing-pricing-snapshot.error.js.map