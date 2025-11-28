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
var TimerService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TimerService = void 0;
const common_1 = require("@nestjs/common");
const redis_service_js_1 = require("../../../shared/redis/redis.service.js");
let TimerService = TimerService_1 = class TimerService {
    redisService;
    logger = new common_1.Logger(TimerService_1.name);
    constructor(redisService) {
        this.redisService = redisService;
    }
    async setOfferExpiry(tripId, expirySeconds) {
        try {
            const key = `trip:${tripId}:offer_expiry`;
            const expiresAt = Date.now() + expirySeconds * 1000;
            await this.redisService.set(key, expiresAt.toString(), expirySeconds);
            this.logger.debug(`Offer expiry set for trip: ${tripId}, expires in ${expirySeconds}s`);
        }
        catch (error) {
            this.logger.error(`Failed to set offer expiry for trip ${tripId}`, error);
            throw error;
        }
    }
    async isOfferExpired(tripId) {
        try {
            const key = `trip:${tripId}:offer_expiry`;
            const expiresAtStr = await this.redisService.get(key);
            if (!expiresAtStr) {
                return true;
            }
            const expiresAt = parseInt(expiresAtStr, 10);
            const now = Date.now();
            return now >= expiresAt;
        }
        catch (error) {
            this.logger.error(`Failed to check offer expiry for trip ${tripId}`, error);
            return true;
        }
    }
    async clearOfferExpiry(tripId) {
        try {
            const key = `trip:${tripId}:offer_expiry`;
            await this.redisService.del(key);
            this.logger.debug(`Offer expiry cleared for trip: ${tripId}`);
        }
        catch (error) {
            this.logger.error(`Failed to clear offer expiry for trip ${tripId}`, error);
        }
    }
    async setRiderNoShow(tripId, noShowSeconds) {
        try {
            const key = `trip:${tripId}:rider_ns`;
            const expiresAt = Date.now() + noShowSeconds * 1000;
            await this.redisService.set(key, expiresAt.toString(), noShowSeconds);
            this.logger.debug(`Rider no-show timer set for trip: ${tripId}, expires in ${noShowSeconds}s`);
        }
        catch (error) {
            this.logger.error(`Failed to set rider no-show timer for trip ${tripId}`, error);
            throw error;
        }
    }
    async isRiderNoShow(tripId) {
        try {
            const key = `trip:${tripId}:rider_ns`;
            const expiresAtStr = await this.redisService.get(key);
            if (!expiresAtStr) {
                return false;
            }
            const expiresAt = parseInt(expiresAtStr, 10);
            const now = Date.now();
            return now >= expiresAt;
        }
        catch (error) {
            this.logger.error(`Failed to check rider no-show for trip ${tripId}`, error);
            return false;
        }
    }
    async setDriverNoShow(tripId, noShowSeconds) {
        try {
            const key = `trip:${tripId}:driver_ns`;
            const expiresAt = Date.now() + noShowSeconds * 1000;
            await this.redisService.set(key, expiresAt.toString(), noShowSeconds);
            this.logger.debug(`Driver no-show timer set for trip: ${tripId}, expires in ${noShowSeconds}s`);
        }
        catch (error) {
            this.logger.error(`Failed to set driver no-show timer for trip ${tripId}`, error);
            throw error;
        }
    }
    async isDriverNoShow(tripId) {
        try {
            const key = `trip:${tripId}:driver_ns`;
            const expiresAtStr = await this.redisService.get(key);
            if (!expiresAtStr) {
                return false;
            }
            const expiresAt = parseInt(expiresAtStr, 10);
            const now = Date.now();
            return now >= expiresAt;
        }
        catch (error) {
            this.logger.error(`Failed to check driver no-show for trip ${tripId}`, error);
            return false;
        }
    }
    async clearNoShow(tripId) {
        try {
            const riderKey = `trip:${tripId}:rider_ns`;
            const driverKey = `trip:${tripId}:driver_ns`;
            await Promise.all([
                this.redisService.del(riderKey),
                this.redisService.del(driverKey),
            ]);
            this.logger.debug(`No-show timers cleared for trip: ${tripId}`);
        }
        catch (error) {
            this.logger.error(`Failed to clear no-show timers for trip ${tripId}`, error);
        }
    }
};
exports.TimerService = TimerService;
exports.TimerService = TimerService = TimerService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [redis_service_js_1.RedisService])
], TimerService);
//# sourceMappingURL=timer.service.js.map