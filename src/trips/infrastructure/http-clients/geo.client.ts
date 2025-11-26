import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '../../../shared/http/http.service.js';

export interface GeoDistanceRequest {
  originLat: number;
  originLng: number;
  destLat: number;
  destLng: number;
}

export interface GeoDistanceResponse {
  distance_m: number;
  duration_s: number;
}

@Injectable()
export class GeoClient {
  private readonly baseUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.baseUrl = this.configService.get<string>('GEO_URL') || '';
  }

  async calculateDistance(
    request: GeoDistanceRequest,
  ): Promise<GeoDistanceResponse> {
    // TODO: Implement calculate distance logic
    throw new Error('Not implemented');
  }

  async getH3Index(lat: number, lng: number, resolution: number): Promise<string> {
    // TODO: Implement get H3 index logic
    throw new Error('Not implemented');
  }
}
