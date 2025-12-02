import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '../../../shared/http/http.service.js';

// ============================================================================
// DTOs - Common Types
// ============================================================================

export interface Coordinates {
  lat: number;
  lng: number;
}

// ============================================================================
// DTOs - Distance
// ============================================================================

export interface DistanceRequest {
  origin: Coordinates;
  destination: Coordinates;
}

export interface DistanceResponse {
  distanceMeters: number;
  durationSeconds: number;
}

// ============================================================================
// DTOs - ETA
// ============================================================================

export interface ETARequest {
  origin: Coordinates;
  destination: Coordinates;
}

export interface ETAResponse {
  etaSeconds: number;
}

// ============================================================================
// DTOs - H3
// ============================================================================

export interface H3Request {
  lat: number;
  lng: number;
}

export interface H3Response {
  h3_res7?: string;
  h3_res9: string;
}

// ============================================================================
// Geo Client
// ============================================================================

@Injectable()
export class GeoClient {
  private readonly logger = new Logger(GeoClient.name);
  private readonly baseUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.baseUrl = this.configService.get<string>('GEO_SERVICE_URL') || 'http://localhost:3010';
  }

  /**
   * Calculate distance and duration between two points
   *
   * MS10-GEO: POST /geo/distance
   *
   * @param origin - Origin coordinates
   * @param destination - Destination coordinates
   * @returns Distance in meters and duration in seconds
   * @throws Error if service unavailable or invalid response
   */
  async distance(origin: Coordinates, destination: Coordinates): Promise<DistanceResponse> {
    try {
      this.logger.debug(
        `Calculating distance from (${origin.lat},${origin.lng}) to (${destination.lat},${destination.lng})`,
      );

      const response = await this.httpService.post<DistanceResponse>(
        `${this.baseUrl}/geo/distance`,
        { origin, destination },
      );

      if (typeof response.distanceMeters !== 'number' || typeof response.durationSeconds !== 'number') {
        throw new Error('Invalid distance response: missing required fields');
      }

      this.logger.debug(
        `Distance calculated: ${response.distanceMeters}m, duration: ${response.durationSeconds}s`,
      );

      return response;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to calculate distance: ${message}`);
      throw new Error(`Geo service distance failed: ${message}`);
    }
  }

  /**
   * Calculate ETA between two points
   *
   * MS10-GEO: POST /geo/eta
   *
   * @param origin - Origin coordinates
   * @param destination - Destination coordinates
   * @returns ETA in seconds
   * @throws Error if service unavailable or invalid response
   */
  async eta(origin: Coordinates, destination: Coordinates): Promise<ETAResponse> {
    try {
      this.logger.debug(
        `Calculating ETA from (${origin.lat},${origin.lng}) to (${destination.lat},${destination.lng})`,
      );

      const response = await this.httpService.post<ETAResponse>(
        `${this.baseUrl}/geo/eta`,
        { origin, destination },
      );

      if (typeof response.etaSeconds !== 'number') {
        throw new Error('Invalid ETA response: missing required fields');
      }

      this.logger.debug(`ETA calculated: ${response.etaSeconds}s`);

      return response;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to calculate ETA: ${message}`);
      throw new Error(`Geo service ETA failed: ${message}`);
    }
  }

  /**
   * Convert coordinates to H3 index
   *
   * MS10-GEO: POST /geo/h3
   *
   * @param lat - Latitude
   * @param lng - Longitude
   * @returns H3 index at resolution 9
   * @throws Error if service unavailable or invalid response
   */
  async h3(lat: number, lng: number): Promise<H3Response> {
    try {
      this.logger.debug(`Converting coordinates to H3: (${lat},${lng})`);

      const response = await this.httpService.post<H3Response>(
        `${this.baseUrl}/geo/h3`,
        { lat, lng },
      );

      if (!response.h3_res9 && !response.h3_res7) {
        throw new Error('Invalid H3 response: missing h3 index fields');
      }

      this.logger.debug(
        `H3 index res9=${response.h3_res9}, res7=${response.h3_res7 ?? 'n/a'}`,
      );

      return response;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to convert to H3: ${message}`);
      throw new Error(`Geo service H3 failed: ${message}`);
    }
  }
}
