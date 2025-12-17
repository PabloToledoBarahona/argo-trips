import { ConfigService } from '@nestjs/config';
export declare class ServiceTokenService {
    private readonly configService;
    private readonly serviceId;
    constructor(configService: ConfigService);
    generateServicePayload(): string;
    getServiceHeaders(): Record<string, string>;
}
