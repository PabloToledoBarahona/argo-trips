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
exports.TimerService = void 0;
const common_1 = require("@nestjs/common");
const redis_service_js_1 = require("../../../shared/redis/redis.service.js");
let TimerService = class TimerService {
    redisService;
    constructor(redisService) {
        this.redisService = redisService;
    }
    async setTimer(timer) {
        const key = `trip:timer:${timer.type}:${timer.tripId}`;
        const ttl = Math.floor((timer.expiresAt.getTime() - Date.now()) / 1000);
        await this.redisService.setJson(key, timer, ttl);
    }
    async getTimer(tripId, type) {
        const key = `trip:timer:${type}:${tripId}`;
        return await this.redisService.getJson(key);
    }
    async cancelTimer(tripId, type) {
        const key = `trip:timer:${type}:${tripId}`;
        await this.redisService.del(key);
    }
    async hasExpired(tripId, type) {
        const timer = await this.getTimer(tripId, type);
        if (!timer)
            return false;
        return new Date() > new Date(timer.expiresAt);
    }
};
exports.TimerService = TimerService;
exports.TimerService = TimerService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [redis_service_js_1.RedisService])
], TimerService);
//# sourceMappingURL=timer.service.js.map