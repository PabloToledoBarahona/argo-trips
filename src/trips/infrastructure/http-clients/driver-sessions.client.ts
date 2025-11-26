import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '../../../shared/http/http.service.js';

export interface DriverAvailability {
  driverId: string;
  available: boolean;
  location?: {
    lat: number;
    lng: number;
  };
  vehicleType: string;
}

@Injectable()
export class DriverSessionsClient {
  private readonly baseUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.baseUrl = this.configService.get<string>('DRIVER_SESSIONS_URL') || '';
  }

  async getDriverAvailability(driverId: string): Promise<DriverAvailability> {
    // TODO: Implement get driver availability logic
    throw new Error('Not implemented');
  }

  async findNearbyDrivers(
    lat: number,
    lng: number,
    vehicleType: string,
    radius_m: number,
  ): Promise<DriverAvailability[]> {
    // TODO: Implement find nearby drivers logic
    throw new Error('Not implemented');
  }

  async notifyDriverOfTrip(driverId: string, tripId: string): Promise<void> {
    // TODO: Implement notify driver logic
    throw new Error('Not implemented');
  }
}
