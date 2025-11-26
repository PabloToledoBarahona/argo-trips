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
Object.defineProperty(exports, "__esModule", { value: true });
exports.GeoClient = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const http_service_js_1 = require("../../../shared/http/http.service.js");
let GeoClient = class GeoClient {
    httpService;
    configService;
    baseUrl;
    constructor(httpService, configService) {
        this.httpService = httpService;
        this.configService = configService;
        this.baseUrl = this.configService.get('GEO_URL') || '';
    }
    async calculateDistance(request) {
        throw new Error('Not implemented');
    }
    async getH3Index(lat, lng, resolution) {
        throw new Error('Not implemented');
    }
};
exports.GeoClient = GeoClient;
exports.GeoClient = GeoClient = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [http_service_js_1.HttpService,
        config_1.ConfigService])
], GeoClient);
//# sourceMappingURL=geo.client.js.map