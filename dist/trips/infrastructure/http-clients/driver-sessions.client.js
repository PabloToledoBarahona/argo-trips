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
exports.DriverSessionsClient = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const http_service_js_1 = require("../../../shared/http/http.service.js");
let DriverSessionsClient = DriverSessionsClient_1 = class DriverSessionsClient {
    httpService;
    configService;
    logger = new common_1.Logger(DriverSessionsClient_1.name);
    baseUrl;
    constructor(httpService, configService) {
        this.httpService = httpService;
        this.configService = configService;
        this.baseUrl = this.configService.get('DRIVER_SESSIONS_SERVICE_URL') || 'http://localhost:3003';
    }
    async getSession(driverId) {
        try {
            this.logger.debug(`Getting session for driver: ${driverId}`);
            const response = await this.httpService.get(`${this.baseUrl}/sessions/${driverId}`);
            if (!response.driverId || typeof response.isOnline !== 'boolean') {
                throw new Error('Invalid session response: missing required fields');
            }
            this.logger.debug(`Driver session: ${driverId}, online=${response.isOnline}, vehicle=${response.vehicleType}`);
            return response;
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.error(`Failed to get driver session: ${message}`);
            throw new Error(`Driver Sessions service failed: ${message}`);
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