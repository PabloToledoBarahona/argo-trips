import { OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
export declare class ServiceTokenService implements OnModuleInit {
    private readonly configService;
    private readonly httpService;
    private readonly logger;
    private readonly authServiceUrl;
    private readonly serviceEmail;
    private readonly servicePassword;
    private readonly deviceId;
    private cachedToken;
    private tokenRenewalTimer;
    private readonly RENEWAL_THRESHOLD_MS;
    private readonly AUTH_TIMEOUT_MS;
    constructor(configService: ConfigService, httpService: HttpService);
    onModuleInit(): Promise<void>;
    getServiceHeaders(): Promise<Record<string, string>>;
    private ensureValidToken;
    private fetchTokenFromAuth;
    private scheduleTokenRenewal;
    onModuleDestroy(): void;
}
