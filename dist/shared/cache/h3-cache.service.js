"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var H3CacheService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.H3CacheService = void 0;
const common_1 = require("@nestjs/common");
const lru_cache_js_1 = require("./lru-cache.js");
let H3CacheService = H3CacheService_1 = class H3CacheService {
    logger = new common_1.Logger(H3CacheService_1.name);
    cache = new lru_cache_js_1.LRUCache(10000, 'h3-cache');
    CLEANUP_INTERVAL_MS = 300000;
    cleanupTimer;
    onModuleInit() {
        this.cleanupTimer = setInterval(() => {
            this.cache.cleanup();
        }, this.CLEANUP_INTERVAL_MS);
        this.logger.log('H3 cache service initialized with periodic cleanup');
    }
    onModuleDestroy() {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
        }
    }
    get(lat, lng, res) {
        const key = this.buildKey(lat, lng, res);
        const value = this.cache.get(key);
        if (value) {
            this.logger.debug(`H3 cache HIT: (${lat},${lng}) res=${res} → ${value}`);
        }
        return value;
    }
    set(lat, lng, res, h3Index) {
        const key = this.buildKey(lat, lng, res);
        this.cache.set(key, h3Index);
        this.logger.debug(`H3 cache SET: (${lat},${lng}) res=${res} → ${h3Index}`);
    }
    getMany(coordinates) {
        const results = new Map();
        for (const coord of coordinates) {
            const key = this.buildKey(coord.lat, coord.lng, coord.res);
            const value = this.cache.get(key);
            if (value) {
                results.set(key, value);
            }
        }
        return results;
    }
    setMany(entries) {
        for (const entry of entries) {
            this.set(entry.lat, entry.lng, entry.res, entry.h3Index);
        }
    }
    getStats() {
        return this.cache.getStats();
    }
    clear() {
        this.cache.clear();
        this.logger.log('H3 cache cleared');
    }
    buildKey(lat, lng, res) {
        const roundedLat = Math.round(lat * 1000000) / 1000000;
        const roundedLng = Math.round(lng * 1000000) / 1000000;
        return `${roundedLat},${roundedLng},${res}`;
    }
};
exports.H3CacheService = H3CacheService;
exports.H3CacheService = H3CacheService = H3CacheService_1 = __decorate([
    (0, common_1.Injectable)()
], H3CacheService);
//# sourceMappingURL=h3-cache.service.js.map