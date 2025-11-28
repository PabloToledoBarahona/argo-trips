"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MissingMetricsError = void 0;
class MissingMetricsError extends Error {
    tripId;
    command;
    constructor(tripId, command) {
        super(`Missing required metrics for ${command} on trip ${tripId}. Final distance and duration are required.`);
        this.tripId = tripId;
        this.command = command;
        this.name = 'MissingMetricsError';
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.MissingMetricsError = MissingMetricsError;
//# sourceMappingURL=missing-metrics.error.js.map