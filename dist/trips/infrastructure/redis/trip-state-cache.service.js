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
exports.TripStateCacheService = void 0;
const common_1 = require("@nestjs/common");
const redis_service_js_1 = require("../../../shared/redis/redis.service.js");
let TripStateCacheService = class TripStateCacheService {
    redisService;
    CACHE_TTL = 3600;
    constructor(redisService) {
        this.redisService = redisService;
    }
    async cacheTrip(trip) {
        const key = `trip:state:${trip.id}`;
        await this.redisService.setJson(key, trip, this.CACHE_TTL);
    }
    async getTrip(tripId) {
        const key = `trip:state:${tripId}`;
        return await this.redisService.getJson(key);
    }
    async invalidateTrip(tripId) {
        const key = `trip:state:${tripId}`;
        await this.redisService.del(key);
    }
};
exports.TripStateCacheService = TripStateCacheService;
exports.TripStateCacheService = TripStateCacheService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [redis_service_js_1.RedisService])
], TripStateCacheService);
//# sourceMappingURL=trip-state-cache.service.js.map