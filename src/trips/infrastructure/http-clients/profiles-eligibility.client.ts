import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '../../../shared/http/http.service.js';
import { ServiceTokenService } from '../../../shared/auth/services/service-token.service.js';
import { TokenBucketRateLimiter } from '../../../shared/rate-limiter/token-bucket.rate-limiter.js';
import { CircuitBreaker } from '../../../shared/circuit-breaker/circuit-breaker.js';

// ============================================================================
// DTOs - MS02 Profiles Eligibility API Format (snake_case)
// ============================================================================

export interface EligibilityBlockingReason {
  code: string;
  message: string;
  severity?: 'CRITICAL' | 'WARNING';
  days_left?: number;
  expired_at?: string;
}

export interface EligibilityResponse {
  is_eligible: boolean;
  status: 'ELIGIBLE' | 'INELIGIBLE';
  blocking_reasons: EligibilityBlockingReason[];
  warnings: EligibilityBlockingReason[];
  computed_at: string;
  expires_at: string;
  message?: string; // present on recompute endpoint
}

// ============================================================================
// Profiles Eligibility Client
// ============================================================================

@Injectable()
export class ProfilesEligibilityClient implements OnModuleInit {
  private readonly logger = new Logger(ProfilesEligibilityClient.name);
  private readonly baseUrl: string;

  private readonly getCircuitBreaker: CircuitBreaker;
  private readonly recomputeCircuitBreaker: CircuitBreaker;

  private readonly GET_TIMEOUT_MS = 2500;
  private readonly RECOMPUTE_TIMEOUT_MS = 5000;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly serviceTokenService: ServiceTokenService,
    private readonly rateLimiter: TokenBucketRateLimiter,
  ) {
    this.baseUrl =
      this.configService.get<string>('PROFILES_SERVICE_URL') ||
      'http://argo-shared-alb-828452645.us-east-2.elb.amazonaws.com/profiles';

    this.getCircuitBreaker = new CircuitBreaker('profiles-eligibility-get', {
      failureThreshold: 5,
      successThreshold: 2,
      timeout: 60000,
      rollingWindow: 60000,
    });

    this.recomputeCircuitBreaker = new CircuitBreaker(
      'profiles-eligibility-recompute',
      {
        failureThreshold: 5,
        successThreshold: 2,
        timeout: 60000,
        rollingWindow: 60000,
      },
    );

    this.logger.log(
      `Profiles Eligibility Client initialized with base URL: ${this.baseUrl}`,
    );
  }

  onModuleInit(): void {
    // Conservative buckets: recompute is more expensive on MS02.
    this.rateLimiter.createBucket('profiles-eligibility-get', 100, 100);
    this.rateLimiter.createBucket('profiles-eligibility-recompute', 20, 20);
  }

  async getEligibility(driverId: string): Promise<EligibilityResponse> {
    this.validateDriverId(driverId);
    await this.rateLimiter.acquire('profiles-eligibility-get');

    return this.getCircuitBreaker.execute(async () => {
      const headers = await this.serviceTokenService.getServiceHeaders();
      const response = await this.httpService.get<EligibilityResponse>(
        `${this.baseUrl}/v1/eligibility/driver/${driverId}`,
        { headers, timeout: this.GET_TIMEOUT_MS },
      );
      this.validateEligibilityResponse(response);
      return response;
    });
  }

  /**
   * Hard-gate check: forces recompute to avoid accepting stale cache during assignment.
   */
  async recomputeEligibility(driverId: string): Promise<EligibilityResponse> {
    this.validateDriverId(driverId);
    await this.rateLimiter.acquire('profiles-eligibility-recompute');

    return this.recomputeCircuitBreaker.execute(async () => {
      const headers = await this.serviceTokenService.getServiceHeaders();
      const response = await this.httpService.post<EligibilityResponse>(
        `${this.baseUrl}/v1/eligibility/recompute/${driverId}`,
        {},
        { headers, timeout: this.RECOMPUTE_TIMEOUT_MS },
      );
      this.validateEligibilityResponse(response);
      return response;
    });
  }

  private validateDriverId(driverId: string): void {
    if (!driverId || typeof driverId !== 'string' || driverId.trim().length === 0) {
      throw new Error('Invalid driverId: must be non-empty string');
    }
  }

  private validateEligibilityResponse(response: EligibilityResponse): void {
    if (typeof response.is_eligible !== 'boolean') {
      throw new Error('Invalid eligibility response: missing is_eligible');
    }
    if (!response.status || (response.status !== 'ELIGIBLE' && response.status !== 'INELIGIBLE')) {
      throw new Error('Invalid eligibility response: missing status');
    }
    if (!Array.isArray(response.blocking_reasons)) {
      throw new Error('Invalid eligibility response: blocking_reasons must be array');
    }
    if (!Array.isArray(response.warnings)) {
      throw new Error('Invalid eligibility response: warnings must be array');
    }
  }
}

