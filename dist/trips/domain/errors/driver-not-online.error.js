"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DriverNotOnlineError = void 0;
class DriverNotOnlineError extends Error {
    driverId;
    tripId;
    constructor(driverId, tripId) {
        super(`Driver ${driverId} is not online or not eligible for trip ${tripId}`);
        this.driverId = driverId;
        this.tripId = tripId;
        this.name = 'DriverNotOnlineError';
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.DriverNotOnlineError = DriverNotOnlineError;
//# sourceMappingURL=driver-not-online.error.js.map