import { BadRequestException } from '@nestjs/common';
import { MS06VehicleType } from '../../infrastructure/http-clients/pricing.client.js';

/**
 * All vehicle types supported by MS06-Pricing
 * See: MS06-Pricing Integration Guide v1.0.0 - Vehicle Types
 */
const MS06_VEHICLE_TYPES: MS06VehicleType[] = [
  'moto',
  'delivery',
  'economy',
  'comfort',
  'premium',
  'xl',
];

/**
 * Maps TRIPS vehicle type to MS06-Pricing vehicle type
 *
 * MS06 Vehicle Types and their multipliers:
 * - moto: 0.70
 * - delivery: 0.80
 * - economy: 0.85
 * - comfort: 1.0 (base)
 * - premium: 1.35
 * - xl: 1.50 (6+ passengers)
 *
 * @param vehicleType - Vehicle type from TRIPS
 * @returns MS06-compliant vehicle type
 * @throws BadRequestException if vehicle type not supported
 */
export function mapToPricingVehicleType(vehicleType: string): MS06VehicleType {
  const normalized = vehicleType?.toLowerCase?.();

  if (MS06_VEHICLE_TYPES.includes(normalized as MS06VehicleType)) {
    return normalized as MS06VehicleType;
  }

  throw new BadRequestException(
    `Unsupported vehicle type "${vehicleType}". Supported types: ${MS06_VEHICLE_TYPES.join(', ')}`,
  );
}
