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
var PinCacheService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PinCacheService = void 0;
const common_1 = require("@nestjs/common");
const redis_service_js_1 = require("../../../shared/redis/redis.service.js");
const crypto_1 = require("crypto");
let PinCacheService = PinCacheService_1 = class PinCacheService {
    redisService;
    logger = new common_1.Logger(PinCacheService_1.name);
    MAX_ATTEMPTS = 3;
    BLOCK_TTL = 900;
    HASH_ITERATIONS = 100000;
    HASH_KEYLEN = 64;
    HASH_DIGEST = 'sha512';
    constructor(redisService) {
        this.redisService = redisService;
    }
    async setPin(tripId, pin, ttlSeconds) {
        try {
            const pinKey = `trip:${tripId}:pin`;
            const salt = (0, crypto_1.randomBytes)(16).toString('hex');
            const hash = (0, crypto_1.pbkdf2Sync)(pin, salt, this.HASH_ITERATIONS, this.HASH_KEYLEN, this.HASH_DIGEST).toString('hex');
            const storedValue = `${salt}:${hash}`;
            await this.redisService.set(pinKey, storedValue, ttlSeconds);
            await this.clearAttempts(tripId);
            this.logger.debug(`PIN set for trip: ${tripId}, TTL: ${ttlSeconds}s`);
        }
        catch (error) {
            this.logger.error(`Failed to set PIN for trip ${tripId}`, error);
            throw error;
        }
    }
    async validatePin(tripId, pin) {
        try {
            const blocked = await this.isBlocked(tripId);
            if (blocked) {
                this.logger.warn(`PIN validation blocked for trip: ${tripId}`);
                return false;
            }
            const pinKey = `trip:${tripId}:pin`;
            const storedValue = await this.redisService.get(pinKey);
            if (!storedValue) {
                this.logger.warn(`No PIN found for trip: ${tripId}`);
                return false;
            }
            const [salt, storedHash] = storedValue.split(':');
            if (!salt || !storedHash) {
                this.logger.error(`Invalid PIN format for trip: ${tripId}`);
                return false;
            }
            const hash = (0, crypto_1.pbkdf2Sync)(pin, salt, this.HASH_ITERATIONS, this.HASH_KEYLEN, this.HASH_DIGEST).toString('hex');
            const isValid = hash === storedHash;
            if (isValid) {
                await this.clearAttempts(tripId);
                this.logger.debug(`PIN validated successfully for trip: ${tripId}`);
                return true;
            }
            else {
                await this.incrementAttempts(tripId);
                const attempts = await this.getAttempts(tripId);
                this.logger.warn(`Invalid PIN for trip: ${tripId}, attempts: ${attempts}/${this.MAX_ATTEMPTS}`);
                if (attempts >= this.MAX_ATTEMPTS) {
                    await this.blockTrip(tripId);
                    this.logger.warn(`Trip blocked due to max PIN attempts: ${tripId}`);
                }
                return false;
            }
        }
        catch (error) {
            this.logger.error(`Failed to validate PIN for trip ${tripId}`, error);
            return false;
        }
    }
    async isBlocked(tripId) {
        try {
            const blockedKey = `trip:${tripId}:pin:blocked`;
            const blocked = await this.redisService.get(blockedKey);
            return blocked === 'true';
        }
        catch (error) {
            this.logger.error(`Failed to check if trip ${tripId} is blocked`, error);
            return false;
        }
    }
    async clearPin(tripId) {
        try {
            const pinKey = `trip:${tripId}:pin`;
            const attemptsKey = `trip:${tripId}:pin:attempts`;
            const blockedKey = `trip:${tripId}:pin:blocked`;
            await Promise.all([
                this.redisService.del(pinKey),
                this.redisService.del(attemptsKey),
                this.redisService.del(blockedKey),
            ]);
            this.logger.debug(`PIN data cleared for trip: ${tripId}`);
        }
        catch (error) {
            this.logger.error(`Failed to clear PIN for trip ${tripId}`, error);
            throw error;
        }
    }
    async getAttempts(tripId) {
        const attemptsKey = `trip:${tripId}:pin:attempts`;
        const attempts = await this.redisService.get(attemptsKey);
        return attempts ? parseInt(attempts, 10) : 0;
    }
    async incrementAttempts(tripId) {
        const attemptsKey = `trip:${tripId}:pin:attempts`;
        const currentAttempts = await this.getAttempts(tripId);
        const newAttempts = currentAttempts + 1;
        await this.redisService.set(attemptsKey, newAttempts.toString(), this.BLOCK_TTL);
    }
    async clearAttempts(tripId) {
        const attemptsKey = `trip:${tripId}:pin:attempts`;
        const blockedKey = `trip:${tripId}:pin:blocked`;
        await Promise.all([
            this.redisService.del(attemptsKey),
            this.redisService.del(blockedKey),
        ]);
    }
    async blockTrip(tripId) {
        const blockedKey = `trip:${tripId}:pin:blocked`;
        await this.redisService.set(blockedKey, 'true', this.BLOCK_TTL);
    }
};
exports.PinCacheService = PinCacheService;
exports.PinCacheService = PinCacheService = PinCacheService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [redis_service_js_1.RedisService])
], PinCacheService);
//# sourceMappingURL=pin-cache.service.js.map