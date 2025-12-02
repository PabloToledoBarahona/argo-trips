import { BadRequestException } from '@nestjs/common';
import { PricingVehicleType } from '../../infrastructure/http-clients/pricing.client.js';

const SUPPORTED_VEHICLE_TYPES: PricingVehicleType[] = ['economy', 'premium', 'delivery'];

export function mapToPricingVehicleType(vehicleType: string): PricingVehicleType {
  const normalized = vehicleType?.toLowerCase?.();

  if (SUPPORTED_VEHICLE_TYPES.includes(normalized as PricingVehicleType)) {
    return normalized as PricingVehicleType;
  }

  throw new BadRequestException(
    `Unsupported vehicle type "${vehicleType}". Supported types: ${SUPPORTED_VEHICLE_TYPES.join(', ')}`,
  );
}
