"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoggerModule = void 0;
const common_1 = require("@nestjs/common");
const nestjs_pino_1 = require("nestjs-pino");
const logger_service_js_1 = require("./logger.service.js");
let LoggerModule = class LoggerModule {
};
exports.LoggerModule = LoggerModule;
exports.LoggerModule = LoggerModule = __decorate([
    (0, common_1.Module)({
        imports: [
            nestjs_pino_1.LoggerModule.forRoot({
                pinoHttp: {
                    transport: process.env.NODE_ENV !== 'production'
                        ? {
                            target: 'pino-pretty',
                            options: {
                                colorize: true,
                                translateTime: 'HH:MM:ss Z',
                                ignore: 'pid,hostname',
                            },
                        }
                        : undefined,
                    level: process.env.LOG_LEVEL || 'info',
                    serializers: {
                        req: (req) => ({
                            method: req.method,
                            url: req.url,
                            headers: req.headers,
                        }),
                        res: (res) => ({
                            statusCode: res.statusCode,
                        }),
                    },
                },
            }),
        ],
        providers: [logger_service_js_1.LoggerService],
        exports: [logger_service_js_1.LoggerService],
    })
], LoggerModule);
//# sourceMappingURL=logger.module.js.map