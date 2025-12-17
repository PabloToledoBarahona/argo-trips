export declare enum CircuitState {
    CLOSED = "CLOSED",
    OPEN = "OPEN",
    HALF_OPEN = "HALF_OPEN"
}
export interface CircuitBreakerConfig {
    failureThreshold: number;
    successThreshold: number;
    timeout: number;
    rollingWindow: number;
}
export declare class CircuitBreaker {
    private readonly name;
    private readonly config;
    private readonly logger;
    private state;
    private failures;
    private successes;
    private lastFailureTime;
    private nextAttemptTime;
    private readonly failureTimestamps;
    constructor(name: string, config?: CircuitBreakerConfig);
    execute<T>(fn: () => Promise<T>): Promise<T>;
    tryExecute<T>(fn: () => Promise<T>, fallback: T): Promise<T>;
    getState(): CircuitState;
    getStats(): {
        state: CircuitState;
        failures: number;
        successes: number;
        recentFailures: number;
        lastFailureTime: number;
        nextAttemptTime: number;
    };
    reset(): void;
    private onSuccess;
    private onFailure;
    private getRecentFailureCount;
}
