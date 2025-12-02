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
var GeoClient_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.GeoClient = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const http_service_js_1 = require("../../../shared/http/http.service.js");
let GeoClient = GeoClient_1 = class GeoClient {
    httpService;
    configService;
    logger = new common_1.Logger(GeoClient_1.name);
    baseUrl;
    constructor(httpService, configService) {
        this.httpService = httpService;
        this.configService = configService;
        this.baseUrl = this.configService.get('GEO_SERVICE_URL') || 'http://localhost:3010';
    }
    async distance(origin, destination) {
        try {
            this.logger.debug(`Calculating distance from (${origin.lat},${origin.lng}) to (${destination.lat},${destination.lng})`);
            const response = await this.httpService.post(`${this.baseUrl}/geo/distance`, { origin, destination });
            if (typeof response.distanceMeters !== 'number' || typeof response.durationSeconds !== 'number') {
                throw new Error('Invalid distance response: missing required fields');
            }
            this.logger.debug(`Distance calculated: ${response.distanceMeters}m, duration: ${response.durationSeconds}s`);
            return response;
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.error(`Failed to calculate distance: ${message}`);
            throw new Error(`Geo service distance failed: ${message}`);
        }
    }
    async eta(origin, destination) {
        try {
            this.logger.debug(`Calculating ETA from (${origin.lat},${origin.lng}) to (${destination.lat},${destination.lng})`);
            const response = await this.httpService.post(`${this.baseUrl}/geo/eta`, { origin, destination });
            if (typeof response.etaSeconds !== 'number') {
                throw new Error('Invalid ETA response: missing required fields');
            }
            this.logger.debug(`ETA calculated: ${response.etaSeconds}s`);
            return response;
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.error(`Failed to calculate ETA: ${message}`);
            throw new Error(`Geo service ETA failed: ${message}`);
        }
    }
    async h3(lat, lng) {
        try {
            this.logger.debug(`Converting coordinates to H3: (${lat},${lng})`);
            const response = await this.httpService.post(`${this.baseUrl}/geo/h3`, { lat, lng });
            if (!response.h3_res9 && !response.h3_res7) {
                throw new Error('Invalid H3 response: missing h3 index fields');
            }
            this.logger.debug(`H3 index res9=${response.h3_res9}, res7=${response.h3_res7 ?? 'n/a'}`);
            return response;
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.error(`Failed to convert to H3: ${message}`);
            throw new Error(`Geo service H3 failed: ${message}`);
        }
    }
};
exports.GeoClient = GeoClient;
exports.GeoClient = GeoClient = GeoClient_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [http_service_js_1.HttpService,
        config_1.ConfigService])
], GeoClient);
//# sourceMappingURL=geo.client.js.map