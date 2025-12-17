"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CircuitBreaker = exports.CircuitState = void 0;
const common_1 = require("@nestjs/common");
var CircuitState;
(function (CircuitState) {
    CircuitState["CLOSED"] = "CLOSED";
    CircuitState["OPEN"] = "OPEN";
    CircuitState["HALF_OPEN"] = "HALF_OPEN";
})(CircuitState || (exports.CircuitState = CircuitState = {}));
class CircuitBreaker {
    name;
    config;
    logger = new common_1.Logger(CircuitBreaker.name);
    state = CircuitState.CLOSED;
    failures = 0;
    successes = 0;
    lastFailureTime = 0;
    nextAttemptTime = 0;
    failureTimestamps = [];
    constructor(name, config = {
        failureThreshold: 5,
        successThreshold: 2,
        timeout: 60000,
        rollingWindow: 60000,
    }) {
        this.name = name;
        this.config = config;
        this.logger.log(`Circuit breaker initialized: ${name} (failure threshold: ${config.failureThreshold}, timeout: ${config.timeout}ms)`);
    }
    async execute(fn) {
        if (this.state === CircuitState.OPEN && Date.now() >= this.nextAttemptTime) {
            this.logger.log(`Circuit breaker ${this.name}: Moving to HALF_OPEN state`);
            this.state = CircuitState.HALF_OPEN;
            this.successes = 0;
        }
        if (this.state === CircuitState.OPEN) {
            const waitTime = Math.ceil((this.nextAttemptTime - Date.now()) / 1000);
            throw new Error(`Circuit breaker ${this.name} is OPEN. Retry in ${waitTime}s. Service may be unavailable.`);
        }
        try {
            const result = await fn();
            this.onSuccess();
            return result;
        }
        catch (error) {
            this.onFailure();
            throw error;
        }
    }
    async tryExecute(fn, fallback) {
        try {
            return await this.execute(fn);
        }
        catch (error) {
            if (this.state === CircuitState.OPEN) {
                this.logger.warn(`Circuit breaker ${this.name} is OPEN, using fallback. Error: ${error instanceof Error ? error.message : String(error)}`);
                return fallback;
            }
            throw error;
        }
    }
    getState() {
        return this.state;
    }
    getStats() {
        return {
            state: this.state,
            failures: this.failures,
            successes: this.successes,
            recentFailures: this.getRecentFailureCount(),
            lastFailureTime: this.lastFailureTime,
            nextAttemptTime: this.nextAttemptTime,
        };
    }
    reset() {
        this.state = CircuitState.CLOSED;
        this.failures = 0;
        this.successes = 0;
        this.failureTimestamps.length = 0;
        this.lastFailureTime = 0;
        this.nextAttemptTime = 0;
        this.logger.log(`Circuit breaker ${this.name}: Manually reset to CLOSED`);
    }
    onSuccess() {
        this.failures = 0;
        if (this.state === CircuitState.HALF_OPEN) {
            this.successes++;
            this.logger.debug(`Circuit breaker ${this.name}: Success in HALF_OPEN (${this.successes}/${this.config.successThreshold})`);
            if (this.successes >= this.config.successThreshold) {
                this.logger.log(`Circuit breaker ${this.name}: Moving to CLOSED state (service recovered)`);
                this.state = CircuitState.CLOSED;
                this.successes = 0;
                this.failureTimestamps.length = 0;
            }
        }
    }
    onFailure() {
        this.failures++;
        this.lastFailureTime = Date.now();
        this.failureTimestamps.push(this.lastFailureTime);
        const windowStart = Date.now() - this.config.rollingWindow;
        while (this.failureTimestamps.length > 0 && this.failureTimestamps[0] < windowStart) {
            this.failureTimestamps.shift();
        }
        const recentFailures = this.failureTimestamps.length;
        this.logger.warn(`Circuit breaker ${this.name}: Failure recorded (${recentFailures}/${this.config.failureThreshold} in rolling window)`);
        if (this.state === CircuitState.HALF_OPEN ||
            recentFailures >= this.config.failureThreshold) {
            this.state = CircuitState.OPEN;
            this.nextAttemptTime = Date.now() + this.config.timeout;
            this.successes = 0;
            this.logger.error(`Circuit breaker ${this.name}: Moving to OPEN state. Will retry in ${this.config.timeout}ms`);
        }
    }
    getRecentFailureCount() {
        const windowStart = Date.now() - this.config.rollingWindow;
        return this.failureTimestamps.filter((ts) => ts >= windowStart).length;
    }
}
exports.CircuitBreaker = CircuitBreaker;
//# sourceMappingURL=circuit-breaker.js.map