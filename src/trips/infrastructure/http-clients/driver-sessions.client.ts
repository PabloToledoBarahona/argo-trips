import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '../../../shared/http/http.service.js';

// ============================================================================
// DTOs - Driver Session
// ============================================================================

export interface DriverLocation {
  lat: number;
  lng: number;
  h3_res9: string;
}

export type VehicleType = 'economy' | 'premium' | 'delivery';

export interface DriverSessionResponse {
  driverId: string;
  isOnline: boolean;
  vehicleType: VehicleType;
  lastLocation: DriverLocation;
  lastUpdate: string;
}

// ============================================================================
// Driver Sessions Client
// ============================================================================

@Injectable()
export class DriverSessionsClient {
  private readonly logger = new Logger(DriverSessionsClient.name);
  private readonly baseUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.baseUrl = this.configService.get<string>('DRIVER_SESSIONS_SERVICE_URL') || 'http://localhost:3003';
  }

  /**
   * Get driver session details
   *
   * MS03-DRIVER-SESSIONS: GET /sessions/:driverId
   *
   * @param driverId - Driver identifier
   * @returns Driver session information including online status and location
   * @throws Error if service unavailable or invalid response
   */
  async getSession(driverId: string): Promise<DriverSessionResponse> {
    try {
      this.logger.debug(`Getting session for driver: ${driverId}`);

      const response = await this.httpService.get<DriverSessionResponse>(
        `${this.baseUrl}/sessions/${driverId}`,
      );

      if (!response.driverId || typeof response.isOnline !== 'boolean') {
        throw new Error('Invalid session response: missing required fields');
      }

      this.logger.debug(
        `Driver session: ${driverId}, online=${response.isOnline}, vehicle=${response.vehicleType}`,
      );

      return response;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to get driver session: ${message}`);
      throw new Error(`Driver Sessions service failed: ${message}`);
    }
  }
}
