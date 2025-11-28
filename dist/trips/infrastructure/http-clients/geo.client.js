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
    timeout = 5000;
    MAX_PICKUP_RADIUS_METERS = 80;
    constructor(httpService, configService) {
        this.httpService = httpService;
        this.configService = configService;
        this.baseUrl = this.configService.get('GEO_SERVICE_URL') || 'http://localhost:3010';
    }
    getErrorMessage(error) {
        if (error instanceof Error)
            return this.getErrorMessage(error);
        return String(error);
    }
    getErrorStack(error) {
        if (error instanceof Error)
            return error.stack;
        return undefined;
    }
    async validateRadius(request) {
        try {
            const maxDistance = request.maxDistanceMeters || this.MAX_PICKUP_RADIUS_METERS;
            this.logger.debug(`Validating radius: origin(${request.origin.lat},${request.origin.lng}), ` +
                `driver(${request.driverLocation.lat},${request.driverLocation.lng}), max: ${maxDistance}m`);
            const response = await this.httpService.post(`${this.baseUrl}/geo/validate-radius`, {
                origin: request.origin,
                target: request.driverLocation,
                maxDistanceMeters: maxDistance,
            }, { timeout: this.timeout });
            if (typeof response.isWithinRadius !== 'boolean' || typeof response.distanceMeters !== 'number') {
                throw new Error('Invalid validate-radius response: missing required fields');
            }
            this.logger.debug(`Radius validation result: within=${response.isWithinRadius}, distance=${response.distanceMeters}m`);
            return response;
        }
        catch (error) {
            this.logger.error(`Failed to validate radius: ${this.getErrorMessage(error)}`, this.getErrorStack(error));
            throw new Error(`Geo service radius validation failed: ${this.getErrorMessage(error)}`);
        }
    }
    async calculateDistance(origin, destination) {
        try {
            this.logger.debug(`Calculating distance between (${origin.lat},${origin.lng}) and (${destination.lat},${destination.lng})`);
            const response = await this.httpService.post(`${this.baseUrl}/geo/distance`, { origin, destination }, { timeout: this.timeout });
            if (typeof response.distanceMeters !== 'number') {
                throw new Error('Invalid distance response');
            }
            return response.distanceMeters;
        }
        catch (error) {
            this.logger.error(`Failed to calculate distance: ${this.getErrorMessage(error)}`, this.getErrorStack(error));
            throw new Error(`Geo service distance calculation failed: ${this.getErrorMessage(error)}`);
        }
    }
    async getETA(request) {
        try {
            this.logger.debug(`Getting ETA: origin(${request.origin.lat},${request.origin.lng}), ` +
                `dest(${request.destination.lat},${request.destination.lng}), mode: ${request.mode || 'driving'}`);
            const response = await this.httpService.post(`${this.baseUrl}/geo/eta`, {
                origin: request.origin,
                destination: request.destination,
                mode: request.mode || 'driving',
            }, { timeout: this.timeout });
            if (typeof response.etaSeconds !== 'number' || typeof response.distanceMeters !== 'number') {
                throw new Error('Invalid ETA response: missing required fields');
            }
            this.logger.debug(`ETA calculated: ${response.etaSeconds}s, distance: ${response.distanceMeters}m`);
            return response;
        }
        catch (error) {
            this.logger.error(`Failed to get ETA: ${this.getErrorMessage(error)}`, this.getErrorStack(error));
            throw new Error(`Geo service ETA calculation failed: ${this.getErrorMessage(error)}`);
        }
    }
    async getRoute(request) {
        try {
            this.logger.debug(`Getting route: origin(${request.origin.lat},${request.origin.lng}), ` +
                `dest(${request.destination.lat},${request.destination.lng})`);
            const response = await this.httpService.post(`${this.baseUrl}/geo/route`, {
                origin: request.origin,
                destination: request.destination,
                includePoints: request.includePoints || false,
            }, { timeout: this.timeout });
            if (typeof response.distance_m_est !== 'number' || typeof response.duration_s_est !== 'number') {
                throw new Error('Invalid route response: missing required fields');
            }
            this.logger.debug(`Route calculated: distance=${response.distance_m_est}m, duration=${response.duration_s_est}s, ` +
                `points: ${response.points?.length || 0}`);
            return response;
        }
        catch (error) {
            this.logger.error(`Failed to get route: ${this.getErrorMessage(error)}`, this.getErrorStack(error));
            throw new Error(`Geo service route calculation failed: ${this.getErrorMessage(error)}`);
        }
    }
    async encodeH3(lat, lng, resolution) {
        try {
            this.logger.debug(`Encoding H3: lat=${lat}, lng=${lng}, res=${resolution}`);
            const response = await this.httpService.post(`${this.baseUrl}/geo/h3/encode`, { lat, lng, resolution }, { timeout: this.timeout });
            if (!response.h3Index) {
                throw new Error('Invalid H3 encode response: missing h3Index');
            }
            this.logger.debug(`H3 encoded: ${response.h3Index}`);
            return response.h3Index;
        }
        catch (error) {
            this.logger.error(`Failed to encode H3: ${this.getErrorMessage(error)}`, this.getErrorStack(error));
            throw new Error(`Geo service H3 encoding failed: ${this.getErrorMessage(error)}`);
        }
    }
    async decodeH3(h3Index) {
        try {
            this.logger.debug(`Decoding H3: ${h3Index}`);
            const response = await this.httpService.post(`${this.baseUrl}/geo/h3/decode`, { h3Index }, { timeout: this.timeout });
            if (typeof response.lat !== 'number' || typeof response.lng !== 'number') {
                throw new Error('Invalid H3 decode response: missing coordinates');
            }
            return { lat: response.lat, lng: response.lng };
        }
        catch (error) {
            this.logger.error(`Failed to decode H3: ${this.getErrorMessage(error)}`, this.getErrorStack(error));
            throw new Error(`Geo service H3 decoding failed: ${this.getErrorMessage(error)}`);
        }
    }
    async batchEncodeH3(coordinates, resolution) {
        try {
            this.logger.debug(`Batch encoding ${coordinates.length} coordinates at resolution ${resolution}`);
            const response = await this.httpService.post(`${this.baseUrl}/geo/h3/batch-encode`, { coordinates, resolution }, { timeout: this.timeout });
            if (!Array.isArray(response.h3Indices)) {
                throw new Error('Invalid batch encode response');
            }
            return response.h3Indices;
        }
        catch (error) {
            this.logger.error(`Failed to batch encode H3: ${this.getErrorMessage(error)}`, this.getErrorStack(error));
            throw new Error(`Geo service batch H3 encoding failed: ${this.getErrorMessage(error)}`);
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