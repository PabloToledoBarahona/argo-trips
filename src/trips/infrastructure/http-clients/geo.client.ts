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

export interface H3Location {
  lat: number;
  lng: number;
  h3_res9: string;
  h3_res7?: string;
}

// ============================================================================
// DTOs - Validate Radius
// ============================================================================

export interface ValidateRadiusRequest {
  origin: Coordinates;
  driverLocation: Coordinates;
  maxDistanceMeters?: number;
}

export interface ValidateRadiusResponse {
  isWithinRadius: boolean;
  distanceMeters: number;
  maxDistanceMeters: number;
}

// ============================================================================
// DTOs - Get ETA
// ============================================================================

export interface GetETARequest {
  origin: Coordinates;
  destination: Coordinates;
  mode?: 'driving' | 'walking';
}

export interface GetETAResponse {
  etaSeconds: number;
  distanceMeters: number;
  mode: string;
}

// ============================================================================
// DTOs - Get Route
// ============================================================================

export interface GetRouteRequest {
  origin: Coordinates;
  destination: Coordinates;
  includePoints?: boolean;
}

export interface RoutePoint {
  lat: number;
  lng: number;
  h3_res9: string;
  order: number;
}

export interface GetRouteResponse {
  distance_m_est: number;
  duration_s_est: number;
  points?: RoutePoint[];
  polyline?: string;
}

// ============================================================================
// DTOs - H3 Operations
// ============================================================================

export interface H3EncodeRequest {
  lat: number;
  lng: number;
  resolution: number;
}

export interface H3EncodeResponse {
  h3Index: string;
  resolution: number;
  lat: number;
  lng: number;
}

export interface H3DecodeRequest {
  h3Index: string;
}

export interface H3DecodeResponse {
  lat: number;
  lng: number;
  resolution: number;
}

// ============================================================================
// Geo Client
// ============================================================================

@Injectable()
export class GeoClient {
  private readonly logger = new Logger(GeoClient.name);
  private readonly baseUrl: string;
  private readonly timeout: number = 5000;

  // MS10-GEO: Maximum radius for pickup validation (80 meters)
  private readonly MAX_PICKUP_RADIUS_METERS = 80;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.baseUrl = this.configService.get<string>('GEO_SERVICE_URL') || 'http://localhost:3010';
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) return this.getErrorMessage(error);
    return String(error);
  }

  private getErrorStack(error: unknown): string | undefined {
    if (error instanceof Error) return error.stack;
    return undefined;
  }

  /**
   * Validate if driver is within acceptable radius of pickup location
   *
   * MS10-GEO: POST /geo/validate-radius
   * MS04-TRIPS: Requires distance <= 80m for START_PICKUP
   */
  async validateRadius(request: ValidateRadiusRequest): Promise<ValidateRadiusResponse> {
    try {
      const maxDistance = request.maxDistanceMeters || this.MAX_PICKUP_RADIUS_METERS;

      this.logger.debug(
        `Validating radius: origin(${request.origin.lat},${request.origin.lng}), ` +
        `driver(${request.driverLocation.lat},${request.driverLocation.lng}), max: ${maxDistance}m`,
      );

      const response = await this.httpService.post<ValidateRadiusResponse>(
        `${this.baseUrl}/geo/validate-radius`,
        {
          origin: request.origin,
          target: request.driverLocation,
          maxDistanceMeters: maxDistance,
        },
        { timeout: this.timeout },
      );

      // Validate response structure
      if (typeof response.isWithinRadius !== 'boolean' || typeof response.distanceMeters !== 'number') {
        throw new Error('Invalid validate-radius response: missing required fields');
      }

      this.logger.debug(
        `Radius validation result: within=${response.isWithinRadius}, distance=${response.distanceMeters}m`,
      );

      return response;
    } catch (error) {
      this.logger.error(`Failed to validate radius: ${this.getErrorMessage(error)}`, this.getErrorStack(error));
      throw new Error(`Geo service radius validation failed: ${this.getErrorMessage(error)}`);
    }
  }

  /**
   * Calculate distance between two points
   *
   * MS10-GEO: POST /geo/distance
   */
  async calculateDistance(origin: Coordinates, destination: Coordinates): Promise<number> {
    try {
      this.logger.debug(`Calculating distance between (${origin.lat},${origin.lng}) and (${destination.lat},${destination.lng})`);

      const response = await this.httpService.post<{ distanceMeters: number }>(
        `${this.baseUrl}/geo/distance`,
        { origin, destination },
        { timeout: this.timeout },
      );

      if (typeof response.distanceMeters !== 'number') {
        throw new Error('Invalid distance response');
      }

      return response.distanceMeters;
    } catch (error) {
      this.logger.error(`Failed to calculate distance: ${this.getErrorMessage(error)}`, this.getErrorStack(error));
      throw new Error(`Geo service distance calculation failed: ${this.getErrorMessage(error)}`);
    }
  }

  /**
   * Get ETA from origin to destination
   *
   * MS10-GEO: POST /geo/eta
   * MS04-TRIPS: Used for trip.assigned event with eta_sec
   */
  async getETA(request: GetETARequest): Promise<GetETAResponse> {
    try {
      this.logger.debug(
        `Getting ETA: origin(${request.origin.lat},${request.origin.lng}), ` +
        `dest(${request.destination.lat},${request.destination.lng}), mode: ${request.mode || 'driving'}`,
      );

      const response = await this.httpService.post<GetETAResponse>(
        `${this.baseUrl}/geo/eta`,
        {
          origin: request.origin,
          destination: request.destination,
          mode: request.mode || 'driving',
        },
        { timeout: this.timeout },
      );

      // Validate response structure
      if (typeof response.etaSeconds !== 'number' || typeof response.distanceMeters !== 'number') {
        throw new Error('Invalid ETA response: missing required fields');
      }

      this.logger.debug(`ETA calculated: ${response.etaSeconds}s, distance: ${response.distanceMeters}m`);

      return response;
    } catch (error) {
      this.logger.error(`Failed to get ETA: ${this.getErrorMessage(error)}`, this.getErrorStack(error));
      throw new Error(`Geo service ETA calculation failed: ${this.getErrorMessage(error)}`);
    }
  }

  /**
   * Get route from origin to destination with optional waypoints
   *
   * MS10-GEO: POST /geo/route
   * MS04-TRIPS: Used for distance_m_est and duration_s_est
   */
  async getRoute(request: GetRouteRequest): Promise<GetRouteResponse> {
    try {
      this.logger.debug(
        `Getting route: origin(${request.origin.lat},${request.origin.lng}), ` +
        `dest(${request.destination.lat},${request.destination.lng})`,
      );

      const response = await this.httpService.post<GetRouteResponse>(
        `${this.baseUrl}/geo/route`,
        {
          origin: request.origin,
          destination: request.destination,
          includePoints: request.includePoints || false,
        },
        { timeout: this.timeout },
      );

      // Validate response structure
      if (typeof response.distance_m_est !== 'number' || typeof response.duration_s_est !== 'number') {
        throw new Error('Invalid route response: missing required fields');
      }

      this.logger.debug(
        `Route calculated: distance=${response.distance_m_est}m, duration=${response.duration_s_est}s, ` +
        `points: ${response.points?.length || 0}`,
      );

      return response;
    } catch (error) {
      this.logger.error(`Failed to get route: ${this.getErrorMessage(error)}`, this.getErrorStack(error));
      throw new Error(`Geo service route calculation failed: ${this.getErrorMessage(error)}`);
    }
  }

  /**
   * Encode coordinates to H3 index
   *
   * MS10-GEO: POST /geo/h3/encode
   * MS04-TRIPS: Used for origin_h3_res9 and dest_h3_res9
   */
  async encodeH3(lat: number, lng: number, resolution: number): Promise<string> {
    try {
      this.logger.debug(`Encoding H3: lat=${lat}, lng=${lng}, res=${resolution}`);

      const response = await this.httpService.post<H3EncodeResponse>(
        `${this.baseUrl}/geo/h3/encode`,
        { lat, lng, resolution },
        { timeout: this.timeout },
      );

      if (!response.h3Index) {
        throw new Error('Invalid H3 encode response: missing h3Index');
      }

      this.logger.debug(`H3 encoded: ${response.h3Index}`);

      return response.h3Index;
    } catch (error) {
      this.logger.error(`Failed to encode H3: ${this.getErrorMessage(error)}`, this.getErrorStack(error));
      throw new Error(`Geo service H3 encoding failed: ${this.getErrorMessage(error)}`);
    }
  }

  /**
   * Decode H3 index to coordinates
   *
   * MS10-GEO: POST /geo/h3/decode
   */
  async decodeH3(h3Index: string): Promise<Coordinates> {
    try {
      this.logger.debug(`Decoding H3: ${h3Index}`);

      const response = await this.httpService.post<H3DecodeResponse>(
        `${this.baseUrl}/geo/h3/decode`,
        { h3Index },
        { timeout: this.timeout },
      );

      if (typeof response.lat !== 'number' || typeof response.lng !== 'number') {
        throw new Error('Invalid H3 decode response: missing coordinates');
      }

      return { lat: response.lat, lng: response.lng };
    } catch (error) {
      this.logger.error(`Failed to decode H3: ${this.getErrorMessage(error)}`, this.getErrorStack(error));
      throw new Error(`Geo service H3 decoding failed: ${this.getErrorMessage(error)}`);
    }
  }

  /**
   * Batch encode multiple coordinates to H3
   *
   * MS10-GEO: POST /geo/h3/batch-encode
   */
  async batchEncodeH3(coordinates: Array<{ lat: number; lng: number }>, resolution: number): Promise<string[]> {
    try {
      this.logger.debug(`Batch encoding ${coordinates.length} coordinates at resolution ${resolution}`);

      const response = await this.httpService.post<{ h3Indices: string[] }>(
        `${this.baseUrl}/geo/h3/batch-encode`,
        { coordinates, resolution },
        { timeout: this.timeout },
      );

      if (!Array.isArray(response.h3Indices)) {
        throw new Error('Invalid batch encode response');
      }

      return response.h3Indices;
    } catch (error) {
      this.logger.error(`Failed to batch encode H3: ${this.getErrorMessage(error)}`, this.getErrorStack(error));
      throw new Error(`Geo service batch H3 encoding failed: ${this.getErrorMessage(error)}`);
    }
  }
}
