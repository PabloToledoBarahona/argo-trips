"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentNotCapturedError = void 0;
class PaymentNotCapturedError extends Error {
    tripId;
    paymentIntentId;
    constructor(tripId, paymentIntentId) {
        super(`Payment not captured for trip ${tripId}${paymentIntentId ? ` (Intent: ${paymentIntentId})` : ''}. Cannot mark as PAID without payment confirmation.`);
        this.tripId = tripId;
        this.paymentIntentId = paymentIntentId;
        this.name = 'PaymentNotCapturedError';
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.PaymentNotCapturedError = PaymentNotCapturedError;
//# sourceMappingURL=payment-not-captured.error.js.map