"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JwtPayloadMiddleware = void 0;
const common_1 = require("@nestjs/common");
let JwtPayloadMiddleware = class JwtPayloadMiddleware {
    use(req, res, next) {
        const jwtPayload = req.headers['x-jwt-payload'];
        if (!jwtPayload) {
            throw new common_1.UnauthorizedException('Missing X-JWT-Payload header');
        }
        try {
            const decoded = Buffer.from(jwtPayload, 'base64').toString('utf-8');
            const payload = JSON.parse(decoded);
            if (!payload.sub || !payload.roles || !Array.isArray(payload.roles)) {
                throw new common_1.UnauthorizedException('Invalid JWT payload structure');
            }
            let identityType = 'rider';
            if (payload.roles.includes('admin')) {
                identityType = 'admin';
            }
            else if (payload.roles.includes('driver')) {
                identityType = 'driver';
            }
            else if (payload.roles.includes('rider')) {
                identityType = 'rider';
            }
            const user = {
                sub: payload.sub,
                roles: payload.roles,
                identityType: payload.identityType || identityType,
                deviceId: payload.did || payload.deviceId,
            };
            req.user = user;
            next();
        }
        catch (error) {
            throw new common_1.UnauthorizedException('Invalid JWT payload');
        }
    }
};
exports.JwtPayloadMiddleware = JwtPayloadMiddleware;
exports.JwtPayloadMiddleware = JwtPayloadMiddleware = __decorate([
    (0, common_1.Injectable)()
], JwtPayloadMiddleware);
//# sourceMappingURL=jwt-payload.middleware.js.map