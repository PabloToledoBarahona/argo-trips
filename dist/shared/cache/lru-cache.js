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
var LRUCache_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.LRUCache = void 0;
const common_1 = require("@nestjs/common");
let LRUCache = LRUCache_1 = class LRUCache {
    maxSize;
    name;
    logger = new common_1.Logger(LRUCache_1.name);
    cache = new Map();
    hits = 0;
    misses = 0;
    constructor(maxSize = 10000, name = 'default') {
        this.maxSize = maxSize;
        this.name = name;
        this.logger.log(`LRU cache initialized: ${name} (max size: ${maxSize})`);
    }
    get(key) {
        const entry = this.cache.get(key);
        if (!entry) {
            this.misses++;
            return undefined;
        }
        if (entry.expiry && Date.now() > entry.expiry) {
            this.cache.delete(key);
            this.misses++;
            return undefined;
        }
        this.cache.delete(key);
        this.cache.set(key, entry);
        this.hits++;
        return entry.value;
    }
    set(key, value, ttlMs) {
        if (this.cache.has(key)) {
            this.cache.delete(key);
        }
        if (this.cache.size >= this.maxSize) {
            const firstKey = this.cache.keys().next().value;
            if (firstKey !== undefined) {
                this.cache.delete(firstKey);
                this.logger.debug(`LRU cache ${this.name}: Evicted oldest entry (${firstKey})`);
            }
        }
        const expiry = ttlMs ? Date.now() + ttlMs : undefined;
        this.cache.set(key, { value, expiry });
    }
    has(key) {
        const entry = this.cache.get(key);
        if (!entry) {
            return false;
        }
        if (entry.expiry && Date.now() > entry.expiry) {
            this.cache.delete(key);
            return false;
        }
        return true;
    }
    delete(key) {
        this.cache.delete(key);
    }
    clear() {
        this.cache.clear();
        this.hits = 0;
        this.misses = 0;
        this.logger.log(`LRU cache ${this.name}: Cleared`);
    }
    getStats() {
        const total = this.hits + this.misses;
        const hitRate = total > 0 ? this.hits / total : 0;
        return {
            size: this.cache.size,
            maxSize: this.maxSize,
            hits: this.hits,
            misses: this.misses,
            hitRate,
        };
    }
    cleanup() {
        const now = Date.now();
        let removed = 0;
        for (const [key, entry] of this.cache.entries()) {
            if (entry.expiry && now > entry.expiry) {
                this.cache.delete(key);
                removed++;
            }
        }
        if (removed > 0) {
            this.logger.debug(`LRU cache ${this.name}: Cleaned up ${removed} expired entries`);
        }
    }
    size() {
        return this.cache.size;
    }
};
exports.LRUCache = LRUCache;
exports.LRUCache = LRUCache = LRUCache_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [Number, String])
], LRUCache);
//# sourceMappingURL=lru-cache.js.map