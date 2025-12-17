import { Logger } from '@nestjs/common';

/**
 * Circuit Breaker States
 *
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Circuit is open, requests fail fast
 * - HALF_OPEN: Testing if service recovered, limited requests allowed
 */
export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

/**
 * Circuit Breaker Configuration
 */
export interface CircuitBreakerConfig {
  /** Failure threshold to open circuit (default: 5) */
  failureThreshold: number;
  /** Success threshold to close circuit from half-open (default: 2) */
  successThreshold: number;
  /** Timeout in ms before attempting recovery (default: 60000) */
  timeout: number;
  /** Rolling window in ms for failure counting (default: 60000) */
  rollingWindow: number;
}

/**
 * Circuit Breaker Pattern Implementation (Utility Class)
 *
 * Prevents cascading failures by stopping requests to failing services.
 * After a threshold of failures, the circuit "opens" and fails fast.
 * After a timeout, enters "half-open" state to test recovery.
 *
 * This is a utility class that should be instantiated directly with `new`.
 * Each circuit breaker instance maintains its own isolated state.
 *
 * States:
 * - CLOSED → Normal operation
 * - OPEN → Failing fast, no requests sent
 * - HALF_OPEN → Testing if service recovered
 *
 * @example
 * const breaker = new CircuitBreaker('geo-service', {
 *   failureThreshold: 5,
 *   timeout: 60000
 * });
 *
 * await breaker.execute(async () => {
 *   return await geoClient.eta(...);
 * });
 */
export class CircuitBreaker {
  private readonly logger = new Logger(CircuitBreaker.name);
  private state: CircuitState = CircuitState.CLOSED;
  private failures = 0;
  private successes = 0;
  private lastFailureTime = 0;
  private nextAttemptTime = 0;
  private readonly failureTimestamps: number[] = [];

  constructor(
    private readonly name: string,
    private readonly config: CircuitBreakerConfig = {
      failureThreshold: 5,
      successThreshold: 2,
      timeout: 60000, // 1 minute
      rollingWindow: 60000, // 1 minute
    },
  ) {
    this.logger.log(
      `Circuit breaker initialized: ${name} (failure threshold: ${config.failureThreshold}, timeout: ${config.timeout}ms)`,
    );
  }

  /**
   * Execute function with circuit breaker protection
   *
   * @param fn - Async function to execute
   * @returns Promise with function result
   * @throws Error if circuit is open or function fails
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check if circuit should move to half-open
    if (this.state === CircuitState.OPEN && Date.now() >= this.nextAttemptTime) {
      this.logger.log(`Circuit breaker ${this.name}: Moving to HALF_OPEN state`);
      this.state = CircuitState.HALF_OPEN;
      this.successes = 0;
    }

    // Fail fast if circuit is open
    if (this.state === CircuitState.OPEN) {
      const waitTime = Math.ceil((this.nextAttemptTime - Date.now()) / 1000);
      throw new Error(
        `Circuit breaker ${this.name} is OPEN. Retry in ${waitTime}s. Service may be unavailable.`,
      );
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Try to execute without throwing on open circuit
   *
   * @param fn - Async function to execute
   * @param fallback - Fallback value if circuit is open
   * @returns Function result or fallback
   */
  async tryExecute<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
    try {
      return await this.execute(fn);
    } catch (error) {
      if (this.state === CircuitState.OPEN) {
        this.logger.warn(
          `Circuit breaker ${this.name} is OPEN, using fallback. Error: ${error instanceof Error ? error.message : String(error)}`,
        );
        return fallback;
      }
      throw error;
    }
  }

  /**
   * Get current circuit state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Get circuit statistics
   */
  getStats(): {
    state: CircuitState;
    failures: number;
    successes: number;
    recentFailures: number;
    lastFailureTime: number;
    nextAttemptTime: number;
  } {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      recentFailures: this.getRecentFailureCount(),
      lastFailureTime: this.lastFailureTime,
      nextAttemptTime: this.nextAttemptTime,
    };
  }

  /**
   * Manually reset circuit to closed state
   */
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failures = 0;
    this.successes = 0;
    this.failureTimestamps.length = 0;
    this.lastFailureTime = 0;
    this.nextAttemptTime = 0;

    this.logger.log(`Circuit breaker ${this.name}: Manually reset to CLOSED`);
  }

  /**
   * Handle successful execution
   */
  private onSuccess(): void {
    this.failures = 0;

    if (this.state === CircuitState.HALF_OPEN) {
      this.successes++;
      this.logger.debug(
        `Circuit breaker ${this.name}: Success in HALF_OPEN (${this.successes}/${this.config.successThreshold})`,
      );

      if (this.successes >= this.config.successThreshold) {
        this.logger.log(`Circuit breaker ${this.name}: Moving to CLOSED state (service recovered)`);
        this.state = CircuitState.CLOSED;
        this.successes = 0;
        this.failureTimestamps.length = 0;
      }
    }
  }

  /**
   * Handle failed execution
   */
  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    this.failureTimestamps.push(this.lastFailureTime);

    // Remove old failures outside rolling window
    const windowStart = Date.now() - this.config.rollingWindow;
    while (this.failureTimestamps.length > 0 && this.failureTimestamps[0] < windowStart) {
      this.failureTimestamps.shift();
    }

    const recentFailures = this.failureTimestamps.length;

    this.logger.warn(
      `Circuit breaker ${this.name}: Failure recorded (${recentFailures}/${this.config.failureThreshold} in rolling window)`,
    );

    // Open circuit if failure threshold exceeded
    if (
      this.state === CircuitState.HALF_OPEN ||
      recentFailures >= this.config.failureThreshold
    ) {
      this.state = CircuitState.OPEN;
      this.nextAttemptTime = Date.now() + this.config.timeout;
      this.successes = 0;

      this.logger.error(
        `Circuit breaker ${this.name}: Moving to OPEN state. Will retry in ${this.config.timeout}ms`,
      );
    }
  }

  /**
   * Get count of failures in rolling window
   */
  private getRecentFailureCount(): number {
    const windowStart = Date.now() - this.config.rollingWindow;
    return this.failureTimestamps.filter((ts) => ts >= windowStart).length;
  }
}
