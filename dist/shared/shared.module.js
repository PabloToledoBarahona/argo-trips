"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SharedModule = void 0;
const common_1 = require("@nestjs/common");
const http_module_js_1 = require("./http/http.module.js");
const redis_module_js_1 = require("./redis/redis.module.js");
const logger_module_js_1 = require("./logger/logger.module.js");
const auth_module_js_1 = require("./auth/auth.module.js");
const idempotency_module_js_1 = require("./idempotency/idempotency.module.js");
const rate_limiter_module_js_1 = require("./rate-limiter/rate-limiter.module.js");
const cache_module_js_1 = require("./cache/cache.module.js");
let SharedModule = class SharedModule {
};
exports.SharedModule = SharedModule;
exports.SharedModule = SharedModule = __decorate([
    (0, common_1.Module)({
        imports: [
            http_module_js_1.HttpModule,
            redis_module_js_1.RedisModule,
            logger_module_js_1.LoggerModule,
            auth_module_js_1.AuthModule,
            idempotency_module_js_1.IdempotencyModule,
            rate_limiter_module_js_1.RateLimiterModule,
            cache_module_js_1.CacheModule,
        ],
        exports: [
            http_module_js_1.HttpModule,
            redis_module_js_1.RedisModule,
            logger_module_js_1.LoggerModule,
            auth_module_js_1.AuthModule,
            idempotency_module_js_1.IdempotencyModule,
            rate_limiter_module_js_1.RateLimiterModule,
            cache_module_js_1.CacheModule,
        ],
    })
], SharedModule);
//# sourceMappingURL=shared.module.js.map