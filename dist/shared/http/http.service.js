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
var HttpService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.HttpService = void 0;
const common_1 = require("@nestjs/common");
const axios_1 = require("@nestjs/axios");
const rxjs_1 = require("rxjs");
let HttpService = HttpService_1 = class HttpService {
    httpService;
    logger = new common_1.Logger(HttpService_1.name);
    DEFAULT_TIMEOUT = 10000;
    DEFAULT_RETRIES = 2;
    constructor(httpService) {
        this.httpService = httpService;
    }
    async get(url, config) {
        try {
            const response = await (0, rxjs_1.firstValueFrom)(this.httpService.get(url, config).pipe((0, rxjs_1.timeout)(config?.timeout || this.DEFAULT_TIMEOUT), (0, rxjs_1.retry)(this.DEFAULT_RETRIES), (0, rxjs_1.catchError)((error) => {
                this.logger.error(`HTTP GET error: ${url}`, error);
                throw error;
            })));
            return response.data;
        }
        catch (error) {
            this.logger.error(`HTTP GET failed: ${url}`, error);
            throw error;
        }
    }
    async post(url, data, config) {
        try {
            const response = await (0, rxjs_1.firstValueFrom)(this.httpService.post(url, data, config).pipe((0, rxjs_1.timeout)(config?.timeout || this.DEFAULT_TIMEOUT), (0, rxjs_1.retry)(this.DEFAULT_RETRIES), (0, rxjs_1.catchError)((error) => {
                this.logger.error(`HTTP POST error: ${url}`, error);
                throw error;
            })));
            return response.data;
        }
        catch (error) {
            this.logger.error(`HTTP POST failed: ${url}`, error);
            throw error;
        }
    }
    async patch(url, data, config) {
        try {
            const response = await (0, rxjs_1.firstValueFrom)(this.httpService.patch(url, data, config).pipe((0, rxjs_1.timeout)(config?.timeout || this.DEFAULT_TIMEOUT), (0, rxjs_1.retry)(this.DEFAULT_RETRIES), (0, rxjs_1.catchError)((error) => {
                this.logger.error(`HTTP PATCH error: ${url}`, error);
                throw error;
            })));
            return response.data;
        }
        catch (error) {
            this.logger.error(`HTTP PATCH failed: ${url}`, error);
            throw error;
        }
    }
    async delete(url, config) {
        try {
            const response = await (0, rxjs_1.firstValueFrom)(this.httpService.delete(url, config).pipe((0, rxjs_1.timeout)(config?.timeout || this.DEFAULT_TIMEOUT), (0, rxjs_1.retry)(this.DEFAULT_RETRIES), (0, rxjs_1.catchError)((error) => {
                this.logger.error(`HTTP DELETE error: ${url}`, error);
                throw error;
            })));
            return response.data;
        }
        catch (error) {
            this.logger.error(`HTTP DELETE failed: ${url}`, error);
            throw error;
        }
    }
};
exports.HttpService = HttpService;
exports.HttpService = HttpService = HttpService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [axios_1.HttpService])
], HttpService);
//# sourceMappingURL=http.service.js.map