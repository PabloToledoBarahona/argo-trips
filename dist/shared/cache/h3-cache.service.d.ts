import { OnModuleInit } from '@nestjs/common';
export declare class H3CacheService implements OnModuleInit {
    private readonly logger;
    private readonly cache;
    private readonly CLEANUP_INTERVAL_MS;
    private cleanupTimer?;
    onModuleInit(): void;
    onModuleDestroy(): void;
    get(lat: number, lng: number, res: number): string | undefined;
    set(lat: number, lng: number, res: number, h3Index: string): void;
    getMany(coordinates: Array<{
        lat: number;
        lng: number;
        res: number;
    }>): Map<string, string>;
    setMany(entries: Array<{
        lat: number;
        lng: number;
        res: number;
        h3Index: string;
    }>): void;
    getStats(): {
        size: number;
        maxSize: number;
        hits: number;
        misses: number;
        hitRate: number;
    };
    clear(): void;
    private buildKey;
}
