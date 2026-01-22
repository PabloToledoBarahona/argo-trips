import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

/**
 * Cached JWT Token
 */
interface CachedToken {
  token: string;
  expiresAt: number;
}

/**
 * Auth Service Response
 */
interface AuthLoginResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
}

/**
 * Service Token Service
 *
 * Manages JWT authentication for service-to-service communication.
 * - Obtains real JWT tokens from MS02-AUTH service
 * - Caches tokens and auto-renews before expiration
 * - Provides Authorization headers for inter-service calls
 *
 * Architecture:
 * - Uses admin login endpoint to obtain service credentials
 * - Implements smart caching to minimize auth service calls
 * - Auto-renews tokens 5 minutes before expiration
 * - Thread-safe token management
 */
@Injectable()
export class ServiceTokenService implements OnModuleInit {
  private readonly logger = new Logger(ServiceTokenService.name);
  private readonly authServiceUrl: string;
  private readonly serviceEmail: string;
  private readonly servicePassword: string;
  private readonly deviceId: string;

  private cachedToken: CachedToken | null = null;
  private tokenRenewalTimer: NodeJS.Timeout | null = null;

  // Token renewal threshold: renew 5 minutes before expiration
  private readonly RENEWAL_THRESHOLD_MS = 5 * 60 * 1000;

  // HTTP timeout for auth calls
  private readonly AUTH_TIMEOUT_MS = 5000;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    this.authServiceUrl = this.configService.get<string>('AUTH_SERVICE_URL') ||
      'http://argo-shared-alb-828452645.us-east-2.elb.amazonaws.com/auth';
    this.serviceEmail = this.configService.get<string>('SERVICE_EMAIL') ||
      'service-trips@argo.internal';
    this.servicePassword = this.configService.get<string>('SERVICE_PASSWORD') ||
      'S3rv1c3Tr1ps!2024#Secure';
    this.deviceId = this.configService.get<string>('SERVICE_ID') || 'argo-trips';
  }

  /**
   * Initialize service on module startup
   * Pre-fetches the first token to ensure availability
   */
  async onModuleInit(): Promise<void> {
    try {
      await this.ensureValidToken();
      this.logger.log('Service token initialized successfully');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Failed to initialize service token: ${message}. Will retry on first use.`,
      );
    }
  }

  /**
   * Get authorization headers for service-to-service HTTP calls
   *
   * Returns headers with valid JWT token for gateway authentication.
   * Automatically renews token if expired or close to expiration.
   *
   * @returns Object with Authorization and Content-Type headers
   */
  async getServiceHeaders(): Promise<Record<string, string>> {
    const token = await this.ensureValidToken();

    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Ensures a valid JWT token is available
   *
   * If token is missing, expired, or close to expiration:
   * - Fetches new token from auth service
   * - Updates cache
   * - Schedules auto-renewal
   *
   * @returns Valid JWT token string
   * @throws Error if unable to obtain token
   */
  private async ensureValidToken(): Promise<string> {
    const now = Date.now();

    // Check if we have a valid cached token
    if (
      this.cachedToken &&
      this.cachedToken.expiresAt > now + this.RENEWAL_THRESHOLD_MS
    ) {
      return this.cachedToken.token;
    }

    // Token is missing, expired, or close to expiration - fetch new one
    this.logger.debug('Fetching new service token from auth service');

    try {
      const token = await this.fetchTokenFromAuth();
      this.logger.log('Service token refreshed successfully');
      return token;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `Failed to fetch service token: ${message}`,
        stack,
      );

      // If we have an expired token, try to use it anyway (better than failing)
      if (this.cachedToken) {
        this.logger.warn('Using expired token as fallback');
        return this.cachedToken.token;
      }

      throw new Error('Unable to obtain service authentication token');
    }
  }

  /**
   * Fetches a new JWT token from the auth service
   *
   * Uses admin login endpoint with service credentials.
   * Caches the token and schedules auto-renewal.
   *
   * @returns JWT token string
   * @throws Error if auth service call fails
   */
  private async fetchTokenFromAuth(): Promise<string> {
    try {
      const response = await firstValueFrom(
        this.httpService.post<AuthLoginResponse>(
          `${this.authServiceUrl}/admin/login`,
          {
            email: this.serviceEmail,
            password: this.servicePassword,
            device_id: this.deviceId,
          },
          {
            timeout: this.AUTH_TIMEOUT_MS,
            headers: {
              'Content-Type': 'application/json',
            },
          },
        ),
      );

      const { access_token, expires_in } = response.data;

      if (!access_token) {
        throw new Error('Auth service did not return access_token');
      }

      // Calculate expiration time
      const expiresAt = Date.now() + expires_in * 1000;

      // Cache the token
      this.cachedToken = {
        token: access_token,
        expiresAt,
      };

      // Schedule auto-renewal
      this.scheduleTokenRenewal(expiresAt);

      return access_token;
    } catch (error: any) {
      if (error?.response) {
        throw new Error(
          `Auth service returned ${error.response.status}: ${JSON.stringify(error.response.data)}`,
        );
      }
      throw error instanceof Error ? error : new Error(String(error));
    }
  }

  /**
   * Schedules automatic token renewal
   *
   * Sets up a timer to renew the token before it expires.
   * Renewal happens RENEWAL_THRESHOLD_MS before expiration.
   *
   * @param expiresAt Token expiration timestamp (milliseconds)
   */
  private scheduleTokenRenewal(expiresAt: number): void {
    // Clear existing timer if any
    if (this.tokenRenewalTimer) {
      clearTimeout(this.tokenRenewalTimer);
    }

    // Calculate when to renew (5 minutes before expiration)
    const renewAt = expiresAt - this.RENEWAL_THRESHOLD_MS;
    const delay = Math.max(0, renewAt - Date.now());

    this.tokenRenewalTimer = setTimeout(async () => {
      this.logger.debug('Auto-renewing service token');
      try {
        await this.ensureValidToken();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(
          `Auto-renewal failed: ${message}. Will retry on next request.`,
        );
      }
    }, delay);

    this.logger.debug(
      `Token auto-renewal scheduled in ${Math.round(delay / 1000)}s`,
    );
  }

  /**
   * Cleanup on module destroy
   */
  onModuleDestroy(): void {
    if (this.tokenRenewalTimer) {
      clearTimeout(this.tokenRenewalTimer);
    }
  }
}
