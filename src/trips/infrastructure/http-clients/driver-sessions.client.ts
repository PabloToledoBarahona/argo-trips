import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '../../../shared/http/http.service.js';

// ============================================================================
// DTOs - Driver Session Status
// ============================================================================

export enum DriverSessionStatus {
  ONLINE = 'ONLINE',
  OFFLINE = 'OFFLINE',
  IN_TRIP = 'IN_TRIP',
  PAUSED = 'PAUSED',
}

export interface DriverLocation {
  lat: number;
  lng: number;
  h3_res9?: string;
  heading?: number;
  speed?: number;
  accuracy?: number;
}

export interface DriverSessionDetails {
  driverId: string;
  status: DriverSessionStatus;
  isOnline: boolean;
  isAvailable: boolean;
  city?: string;
  vehicleType?: string;
  currentLocation?: DriverLocation;
  lastHeartbeat?: string;
  sessionStartedAt?: string;
  metadata?: Record<string, any>;
}

export interface GetDriverSessionStatusResponse {
  driverId: string;
  status: DriverSessionStatus;
  isOnline: boolean;
  isAvailable: boolean;
  lastUpdate: string;
  city?: string;
  vehicleType?: string;
  location?: DriverLocation;
  metadata?: Record<string, any>;
}

// ============================================================================
// DTOs - Batch Operations
// ============================================================================

export interface BatchGetDriverSessionsRequest {
  driverIds: string[];
}

export interface BatchGetDriverSessionsResponse {
  sessions: GetDriverSessionStatusResponse[];
  notFound: string[];
}

// ============================================================================
// Driver Sessions Client
// ============================================================================

@Injectable()
export class DriverSessionsClient {
  private readonly logger = new Logger(DriverSessionsClient.name);
  private readonly baseUrl: string;
  private readonly timeout: number = 5000;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.baseUrl = this.configService.get<string>('DRIVER_SESSIONS_SERVICE_URL') || 'http://localhost:3003';
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    return String(error);
  }

  private getErrorStack(error: unknown): string | undefined {
    if (error instanceof Error) return error.stack;
    return undefined;
  }

  /**
   * Get driver session status
   *
   * MS03-DRIVER-SESSIONS: GET /sessions/driver/:driverId/status
   * MS04-TRIPS: Used to validate driver is online before accepting trip
   *
   * Returns current session status including online/offline state,
   * availability, location, and metadata.
   */
  async getDriverSessionStatus(driverId: string): Promise<GetDriverSessionStatusResponse> {
    try {
      this.logger.debug(`Getting driver session status for driver: ${driverId}`);

      const response = await this.httpService.get<GetDriverSessionStatusResponse>(
        `${this.baseUrl}/sessions/driver/${driverId}/status`,
        { timeout: this.timeout },
      );

      // Validate response structure
      if (!response.driverId || typeof response.isOnline !== 'boolean') {
        throw new Error('Invalid driver session response: missing required fields');
      }

      this.logger.debug(
        `Driver session status: ${driverId}, online=${response.isOnline}, ` +
        `available=${response.isAvailable}, status=${response.status}`,
      );

      return response;
    } catch (error) {
      this.logger.error(`Failed to get driver session status for ${driverId}: ${this.getErrorMessage(error)}`, this.getErrorStack(error));
      throw new Error(`Driver Sessions service unavailable: ${this.getErrorMessage(error)}`);
    }
  }

  /**
   * Check if driver is online and available
   *
   * MS03-DRIVER-SESSIONS: Convenience method
   * MS04-TRIPS: Used in AcceptTripUseCase to validate driver eligibility
   */
  async isDriverOnline(driverId: string): Promise<boolean> {
    try {
      const session = await this.getDriverSessionStatus(driverId);
      return session.isOnline && session.status !== DriverSessionStatus.IN_TRIP;
    } catch (error) {
      this.logger.warn(`Failed to check driver online status for ${driverId}: ${this.getErrorMessage(error)}`);
      return false;
    }
  }

  /**
   * Check if driver is available for new trips
   *
   * MS03-DRIVER-SESSIONS: Validates ONLINE status and not IN_TRIP
   * MS04-TRIPS: Used before assigning trip to driver
   */
  async isDriverAvailable(driverId: string): Promise<boolean> {
    try {
      const session = await this.getDriverSessionStatus(driverId);
      return session.isOnline && session.isAvailable && session.status === DriverSessionStatus.ONLINE;
    } catch (error) {
      this.logger.warn(`Failed to check driver availability for ${driverId}: ${this.getErrorMessage(error)}`);
      return false;
    }
  }

  /**
   * Get driver current location
   *
   * MS03-DRIVER-SESSIONS: GET /sessions/driver/:driverId/location
   * MS04-TRIPS: Used for radius validation in VerifyPinUseCase
   */
  async getDriverLocation(driverId: string): Promise<DriverLocation | null> {
    try {
      this.logger.debug(`Getting driver location for: ${driverId}`);

      const response = await this.httpService.get<{ location: DriverLocation }>(
        `${this.baseUrl}/sessions/driver/${driverId}/location`,
        { timeout: this.timeout },
      );

      if (!response.location || typeof response.location.lat !== 'number') {
        this.logger.warn(`Invalid location response for driver ${driverId}`);
        return null;
      }

      return response.location;
    } catch (error) {
      this.logger.warn(`Failed to get driver location for ${driverId}: ${this.getErrorMessage(error)}`);
      return null;
    }
  }

  /**
   * Get multiple driver sessions in batch
   *
   * MS03-DRIVER-SESSIONS: POST /sessions/batch/status
   * MS04-TRIPS: Optional optimization for checking multiple drivers
   */
  async batchGetDriverSessions(driverIds: string[]): Promise<BatchGetDriverSessionsResponse> {
    try {
      this.logger.debug(`Getting batch driver sessions for ${driverIds.length} drivers`);

      const response = await this.httpService.post<BatchGetDriverSessionsResponse>(
        `${this.baseUrl}/sessions/batch/status`,
        { driverIds },
        { timeout: this.timeout },
      );

      if (!Array.isArray(response.sessions)) {
        throw new Error('Invalid batch sessions response');
      }

      this.logger.debug(
        `Batch sessions retrieved: ${response.sessions.length} found, ${response.notFound?.length || 0} not found`,
      );

      return response;
    } catch (error) {
      this.logger.error(`Failed to get batch driver sessions: ${this.getErrorMessage(error)}`, this.getErrorStack(error));
      throw new Error(`Driver Sessions batch request failed: ${this.getErrorMessage(error)}`);
    }
  }

  /**
   * Validate driver session for trip assignment
   *
   * MS03-DRIVER-SESSIONS: Combined validation
   * MS04-TRIPS: Used in AcceptTripUseCase
   *
   * Validates:
   * - Driver is online
   * - Driver is not in another trip
   * - Driver session is active (recent heartbeat)
   */
  async validateDriverForTrip(driverId: string, requiredCity?: string): Promise<{
    valid: boolean;
    reason?: string;
  }> {
    try {
      const session = await this.getDriverSessionStatus(driverId);

      if (!session.isOnline) {
        return {
          valid: false,
          reason: 'Driver is offline',
        };
      }

      if (session.status === DriverSessionStatus.IN_TRIP) {
        return {
          valid: false,
          reason: 'Driver is already in a trip',
        };
      }

      if (!session.isAvailable) {
        return {
          valid: false,
          reason: 'Driver is not available',
        };
      }

      if (requiredCity && session.city && session.city !== requiredCity) {
        return {
          valid: false,
          reason: `Driver is in different city: ${session.city}`,
        };
      }

      // Check last heartbeat is recent (within 60 seconds)
      if (session.lastUpdate) {
        const lastUpdateTime = new Date(session.lastUpdate).getTime();
        const now = Date.now();
        const secondsSinceUpdate = (now - lastUpdateTime) / 1000;

        if (secondsSinceUpdate > 60) {
          return {
            valid: false,
            reason: `Driver session stale: ${Math.round(secondsSinceUpdate)}s since last update`,
          };
        }
      }

      return { valid: true };
    } catch (error) {
      this.logger.error(`Failed to validate driver for trip: ${this.getErrorMessage(error)}`, this.getErrorStack(error));
      return {
        valid: false,
        reason: `Validation failed: ${this.getErrorMessage(error)}`,
      };
    }
  }
}
