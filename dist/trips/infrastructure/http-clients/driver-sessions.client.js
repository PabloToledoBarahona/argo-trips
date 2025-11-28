"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var DriverSessionsClient_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DriverSessionsClient = exports.DriverSessionStatus = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const http_service_js_1 = require("../../../shared/http/http.service.js");
var DriverSessionStatus;
(function (DriverSessionStatus) {
    DriverSessionStatus["ONLINE"] = "ONLINE";
    DriverSessionStatus["OFFLINE"] = "OFFLINE";
    DriverSessionStatus["IN_TRIP"] = "IN_TRIP";
    DriverSessionStatus["PAUSED"] = "PAUSED";
})(DriverSessionStatus || (exports.DriverSessionStatus = DriverSessionStatus = {}));
let DriverSessionsClient = DriverSessionsClient_1 = class DriverSessionsClient {
    httpService;
    configService;
    logger = new common_1.Logger(DriverSessionsClient_1.name);
    baseUrl;
    timeout = 5000;
    constructor(httpService, configService) {
        this.httpService = httpService;
        this.configService = configService;
        this.baseUrl = this.configService.get('DRIVER_SESSIONS_SERVICE_URL') || 'http://localhost:3003';
    }
    getErrorMessage(error) {
        if (error instanceof Error)
            return error.message;
        return String(error);
    }
    getErrorStack(error) {
        if (error instanceof Error)
            return error.stack;
        return undefined;
    }
    async getDriverSessionStatus(driverId) {
        try {
            this.logger.debug(`Getting driver session status for driver: ${driverId}`);
            const response = await this.httpService.get(`${this.baseUrl}/sessions/driver/${driverId}/status`, { timeout: this.timeout });
            if (!response.driverId || typeof response.isOnline !== 'boolean') {
                throw new Error('Invalid driver session response: missing required fields');
            }
            this.logger.debug(`Driver session status: ${driverId}, online=${response.isOnline}, ` +
                `available=${response.isAvailable}, status=${response.status}`);
            return response;
        }
        catch (error) {
            this.logger.error(`Failed to get driver session status for ${driverId}: ${this.getErrorMessage(error)}`, this.getErrorStack(error));
            throw new Error(`Driver Sessions service unavailable: ${this.getErrorMessage(error)}`);
        }
    }
    async isDriverOnline(driverId) {
        try {
            const session = await this.getDriverSessionStatus(driverId);
            return session.isOnline && session.status !== DriverSessionStatus.IN_TRIP;
        }
        catch (error) {
            this.logger.warn(`Failed to check driver online status for ${driverId}: ${this.getErrorMessage(error)}`);
            return false;
        }
    }
    async isDriverAvailable(driverId) {
        try {
            const session = await this.getDriverSessionStatus(driverId);
            return session.isOnline && session.isAvailable && session.status === DriverSessionStatus.ONLINE;
        }
        catch (error) {
            this.logger.warn(`Failed to check driver availability for ${driverId}: ${this.getErrorMessage(error)}`);
            return false;
        }
    }
    async getDriverLocation(driverId) {
        try {
            this.logger.debug(`Getting driver location for: ${driverId}`);
            const response = await this.httpService.get(`${this.baseUrl}/sessions/driver/${driverId}/location`, { timeout: this.timeout });
            if (!response.location || typeof response.location.lat !== 'number') {
                this.logger.warn(`Invalid location response for driver ${driverId}`);
                return null;
            }
            return response.location;
        }
        catch (error) {
            this.logger.warn(`Failed to get driver location for ${driverId}: ${this.getErrorMessage(error)}`);
            return null;
        }
    }
    async batchGetDriverSessions(driverIds) {
        try {
            this.logger.debug(`Getting batch driver sessions for ${driverIds.length} drivers`);
            const response = await this.httpService.post(`${this.baseUrl}/sessions/batch/status`, { driverIds }, { timeout: this.timeout });
            if (!Array.isArray(response.sessions)) {
                throw new Error('Invalid batch sessions response');
            }
            this.logger.debug(`Batch sessions retrieved: ${response.sessions.length} found, ${response.notFound?.length || 0} not found`);
            return response;
        }
        catch (error) {
            this.logger.error(`Failed to get batch driver sessions: ${this.getErrorMessage(error)}`, this.getErrorStack(error));
            throw new Error(`Driver Sessions batch request failed: ${this.getErrorMessage(error)}`);
        }
    }
    async validateDriverForTrip(driverId, requiredCity) {
        try {
            const session = await this.getDriverSessionStatus(driverId);
            if (!session.isOnline) {
                return {
                    valid: false,
                    reason: 'Driver is offline',
                };
            }
            if (session.status === DriverSessionStatus.IN_TRIP) {
                return {
                    valid: false,
                    reason: 'Driver is already in a trip',
                };
            }
            if (!session.isAvailable) {
                return {
                    valid: false,
                    reason: 'Driver is not available',
                };
            }
            if (requiredCity && session.city && session.city !== requiredCity) {
                return {
                    valid: false,
                    reason: `Driver is in different city: ${session.city}`,
                };
            }
            if (session.lastUpdate) {
                const lastUpdateTime = new Date(session.lastUpdate).getTime();
                const now = Date.now();
                const secondsSinceUpdate = (now - lastUpdateTime) / 1000;
                if (secondsSinceUpdate > 60) {
                    return {
                        valid: false,
                        reason: `Driver session stale: ${Math.round(secondsSinceUpdate)}s since last update`,
                    };
                }
            }
            return { valid: true };
        }
        catch (error) {
            this.logger.error(`Failed to validate driver for trip: ${this.getErrorMessage(error)}`, this.getErrorStack(error));
            return {
                valid: false,
                reason: `Validation failed: ${this.getErrorMessage(error)}`,
            };
        }
    }
};
exports.DriverSessionsClient = DriverSessionsClient;
exports.DriverSessionsClient = DriverSessionsClient = DriverSessionsClient_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [http_service_js_1.HttpService,
        config_1.ConfigService])
], DriverSessionsClient);
//# sourceMappingURL=driver-sessions.client.js.map