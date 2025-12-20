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
var ServiceTokenService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServiceTokenService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const axios_1 = require("@nestjs/axios");
const rxjs_1 = require("rxjs");
let ServiceTokenService = ServiceTokenService_1 = class ServiceTokenService {
    configService;
    httpService;
    logger = new common_1.Logger(ServiceTokenService_1.name);
    authServiceUrl;
    serviceEmail;
    servicePassword;
    deviceId;
    cachedToken = null;
    tokenRenewalTimer = null;
    RENEWAL_THRESHOLD_MS = 5 * 60 * 1000;
    AUTH_TIMEOUT_MS = 5000;
    constructor(configService, httpService) {
        this.configService = configService;
        this.httpService = httpService;
        this.authServiceUrl = this.configService.get('AUTH_SERVICE_URL') ||
            'http://alb-argo-gateway-1317937741.us-east-2.elb.amazonaws.com/auth';
        this.serviceEmail = this.configService.get('SERVICE_EMAIL') ||
            'service-trips@argo.internal';
        this.servicePassword = this.configService.get('SERVICE_PASSWORD') ||
            'S3rv1c3Tr1ps!2024#Secure';
        this.deviceId = this.configService.get('SERVICE_ID') || 'argo-trips';
    }
    async onModuleInit() {
        try {
            await this.ensureValidToken();
            this.logger.log('Service token initialized successfully');
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.warn(`Failed to initialize service token: ${message}. Will retry on first use.`);
        }
    }
    async getServiceHeaders() {
        const token = await this.ensureValidToken();
        return {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        };
    }
    async ensureValidToken() {
        const now = Date.now();
        if (this.cachedToken &&
            this.cachedToken.expiresAt > now + this.RENEWAL_THRESHOLD_MS) {
            return this.cachedToken.token;
        }
        this.logger.debug('Fetching new service token from auth service');
        try {
            const token = await this.fetchTokenFromAuth();
            this.logger.log('Service token refreshed successfully');
            return token;
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            const stack = error instanceof Error ? error.stack : undefined;
            this.logger.error(`Failed to fetch service token: ${message}`, stack);
            if (this.cachedToken) {
                this.logger.warn('Using expired token as fallback');
                return this.cachedToken.token;
            }
            throw new Error('Unable to obtain service authentication token');
        }
    }
    async fetchTokenFromAuth() {
        try {
            const response = await (0, rxjs_1.firstValueFrom)(this.httpService.post(`${this.authServiceUrl}/admin/login`, {
                email: this.serviceEmail,
                password: this.servicePassword,
                device_id: this.deviceId,
            }, {
                timeout: this.AUTH_TIMEOUT_MS,
                headers: {
                    'Content-Type': 'application/json',
                },
            }));
            const { access_token, expires_in } = response.data;
            if (!access_token) {
                throw new Error('Auth service did not return access_token');
            }
            const expiresAt = Date.now() + expires_in * 1000;
            this.cachedToken = {
                token: access_token,
                expiresAt,
            };
            this.scheduleTokenRenewal(expiresAt);
            return access_token;
        }
        catch (error) {
            if (error?.response) {
                throw new Error(`Auth service returned ${error.response.status}: ${JSON.stringify(error.response.data)}`);
            }
            throw error instanceof Error ? error : new Error(String(error));
        }
    }
    scheduleTokenRenewal(expiresAt) {
        if (this.tokenRenewalTimer) {
            clearTimeout(this.tokenRenewalTimer);
        }
        const renewAt = expiresAt - this.RENEWAL_THRESHOLD_MS;
        const delay = Math.max(0, renewAt - Date.now());
        this.tokenRenewalTimer = setTimeout(async () => {
            this.logger.debug('Auto-renewing service token');
            try {
                await this.ensureValidToken();
            }
            catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                this.logger.error(`Auto-renewal failed: ${message}. Will retry on next request.`);
            }
        }, delay);
        this.logger.debug(`Token auto-renewal scheduled in ${Math.round(delay / 1000)}s`);
    }
    onModuleDestroy() {
        if (this.tokenRenewalTimer) {
            clearTimeout(this.tokenRenewalTimer);
        }
    }
};
exports.ServiceTokenService = ServiceTokenService;
exports.ServiceTokenService = ServiceTokenService = ServiceTokenService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        axios_1.HttpService])
], ServiceTokenService);
//# sourceMappingURL=service-token.service.js.map