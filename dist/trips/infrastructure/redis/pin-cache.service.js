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
exports.PinCacheService = void 0;
const common_1 = require("@nestjs/common");
const redis_service_js_1 = require("../../../shared/redis/redis.service.js");
let PinCacheService = class PinCacheService {
    redisService;
    PIN_TTL = 900;
    constructor(redisService) {
        this.redisService = redisService;
    }
    async storePin(tripId, pin) {
        const key = `trip:pin:${tripId}`;
        await this.redisService.set(key, pin, this.PIN_TTL);
    }
    async getPin(tripId) {
        const key = `trip:pin:${tripId}`;
        return await this.redisService.get(key);
    }
    async verifyPin(tripId, pin) {
        const storedPin = await this.getPin(tripId);
        return storedPin === pin;
    }
    async deletePin(tripId) {
        const key = `trip:pin:${tripId}`;
        await this.redisService.del(key);
    }
    generatePin() {
        return Math.floor(1000 + Math.random() * 9000).toString();
    }
};
exports.PinCacheService = PinCacheService;
exports.PinCacheService = PinCacheService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [redis_service_js_1.RedisService])
], PinCacheService);
//# sourceMappingURL=pin-cache.service.js.map