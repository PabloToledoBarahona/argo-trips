"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OfferExpiredError = void 0;
class OfferExpiredError extends Error {
    tripId;
    offeredAt;
    constructor(tripId, offeredAt) {
        super(`Offer for trip ${tripId} has expired${offeredAt ? ` (offered at: ${offeredAt.toISOString()})` : ''}`);
        this.tripId = tripId;
        this.offeredAt = offeredAt;
        this.name = 'OfferExpiredError';
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.OfferExpiredError = OfferExpiredError;
//# sourceMappingURL=offer-expired.error.js.map