import { OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
export declare class RedisService implements OnModuleDestroy {
    private readonly configService;
    private readonly logger;
    private client;
    constructor(configService: ConfigService);
    getClient(): Redis;
    set(key: string, value: string, ttlSeconds?: number): Promise<void>;
    get(key: string): Promise<string | null>;
    del(key: string): Promise<void>;
    exists(key: string): Promise<boolean>;
    setJson(key: string, value: any, ttlSeconds?: number): Promise<void>;
    getJson<T>(key: string): Promise<T | null>;
    setNx(key: string, value: string, ttlSeconds?: number): Promise<boolean>;
    onModuleDestroy(): Promise<void>;
}
