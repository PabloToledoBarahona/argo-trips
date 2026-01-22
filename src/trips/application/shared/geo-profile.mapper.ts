import { BadRequestException } from '@nestjs/common';

/**
 * GEO Service Vehicle Profile
 *
 * Maps to MS10-GEO /geo/eta and /geo/route profile parameter.
 * GEO supports only two vehicle profiles: car and moto.
 */
export type GeoVehicleProfile = 'car' | 'moto';

/**
 * Map TRIPS vehicle type to GEO vehicle profile
 *
 * Mapping logic:
 * - economy/comfort/premium/xl → car (standard or larger vehicle)
 * - moto/delivery → moto (motorcycle profile)
 *
 * @param vehicleType - TRIPS vehicle type ('economy', 'premium', 'delivery')
 * @returns GEO vehicle profile ('car' or 'moto')
 * @throws BadRequestException if vehicle type is unsupported
 */
export function mapToGeoProfile(vehicleType: string): GeoVehicleProfile {
  const normalized = vehicleType?.toLowerCase?.();

  switch (normalized) {
    case 'economy':
    case 'comfort':
    case 'premium':
    case 'xl':
      return 'car';

    case 'moto':
    case 'delivery':
      return 'moto';

    default:
      throw new BadRequestException(
        `Cannot map vehicle type "${vehicleType}" to GEO profile. Supported types: economy, comfort, premium, xl, moto, delivery`,
      );
  }
}
