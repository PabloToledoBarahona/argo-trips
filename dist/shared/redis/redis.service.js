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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var RedisService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const ioredis_1 = __importDefault(require("ioredis"));
let RedisService = RedisService_1 = class RedisService {
    configService;
    logger = new common_1.Logger(RedisService_1.name);
    client;
    constructor(configService) {
        this.configService = configService;
        const redisUrl = this.configService.get('REDIS_URL');
        if (!redisUrl) {
            throw new Error('REDIS_URL is not configured');
        }
        this.client = new ioredis_1.default(redisUrl, {
            maxRetriesPerRequest: 3,
            retryStrategy: (times) => {
                const delay = Math.min(times * 50, 2000);
                return delay;
            },
        });
        this.client.on('connect', () => {
            this.logger.log('Redis connected');
        });
        this.client.on('error', (error) => {
            this.logger.error('Redis connection error', error);
        });
    }
    getClient() {
        return this.client;
    }
    async set(key, value, ttlSeconds) {
        if (ttlSeconds) {
            await this.client.setex(key, ttlSeconds, value);
        }
        else {
            await this.client.set(key, value);
        }
    }
    async get(key) {
        return await this.client.get(key);
    }
    async del(key) {
        await this.client.del(key);
    }
    async exists(key) {
        const result = await this.client.exists(key);
        return result === 1;
    }
    async setJson(key, value, ttlSeconds) {
        const serialized = JSON.stringify(value);
        await this.set(key, serialized, ttlSeconds);
    }
    async getJson(key) {
        const value = await this.get(key);
        if (!value)
            return null;
        return JSON.parse(value);
    }
    async setNx(key, value, ttlSeconds) {
        if (ttlSeconds) {
            const result = await this.client.set(key, value, 'EX', ttlSeconds, 'NX');
            return result === 'OK';
        }
        else {
            const result = await this.client.setnx(key, value);
            return result === 1;
        }
    }
    async onModuleDestroy() {
        await this.client.quit();
        this.logger.log('Redis connection closed');
    }
};
exports.RedisService = RedisService;
exports.RedisService = RedisService = RedisService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], RedisService);
//# sourceMappingURL=redis.service.js.map