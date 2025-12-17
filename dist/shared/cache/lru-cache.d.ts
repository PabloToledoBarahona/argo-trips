export declare class LRUCache<T> {
    private readonly maxSize;
    private readonly name;
    private readonly logger;
    private readonly cache;
    private hits;
    private misses;
    constructor(maxSize?: number, name?: string);
    get(key: string): T | undefined;
    set(key: string, value: T, ttlMs?: number): void;
    has(key: string): boolean;
    delete(key: string): void;
    clear(): void;
    getStats(): {
        size: number;
        maxSize: number;
        hits: number;
        misses: number;
        hitRate: number;
    };
    cleanup(): void;
    size(): number;
}
