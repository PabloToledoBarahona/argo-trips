"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthModule = void 0;
const common_1 = require("@nestjs/common");
const axios_1 = require("@nestjs/axios");
const jwt_payload_middleware_js_1 = require("./middleware/jwt-payload.middleware.js");
const service_token_service_js_1 = require("./services/service-token.service.js");
let AuthModule = class AuthModule {
    configure(consumer) {
        consumer
            .apply(jwt_payload_middleware_js_1.JwtPayloadMiddleware)
            .exclude({ path: 'health', method: common_1.RequestMethod.GET }, { path: 'healthz', method: common_1.RequestMethod.GET }, { path: 'trips/health', method: common_1.RequestMethod.GET }, { path: 'trips/healthz', method: common_1.RequestMethod.GET })
            .forRoutes('*');
    }
};
exports.AuthModule = AuthModule;
exports.AuthModule = AuthModule = __decorate([
    (0, common_1.Module)({
        imports: [
            axios_1.HttpModule.register({
                timeout: 5000,
                maxRedirects: 3,
            }),
        ],
        providers: [service_token_service_js_1.ServiceTokenService],
        exports: [service_token_service_js_1.ServiceTokenService],
    })
], AuthModule);
//# sourceMappingURL=auth.module.js.map