import { IsString, IsNumber, IsNotEmpty, Min, Max } from 'class-validator';

export class CreateTripDto {
  @IsString()
  @IsNotEmpty()
  riderId: string;

  @IsString()
  @IsNotEmpty()
  vehicleType: string;

  @IsString()
  @IsNotEmpty()
  city: string;

  @IsNumber()
  @Min(-90)
  @Max(90)
  originLat: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  originLng: number;

  @IsString()
  @IsNotEmpty()
  originH3Res9: string;

  @IsNumber()
  @Min(-90)
  @Max(90)
  destLat: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  destLng: number;

  @IsString()
  @IsNotEmpty()
  destH3Res9: string;
}

export class PricingBreakdownDto {
  distancePrice: number;
  timePrice: number;
  serviceFee: number;
  specialCharges?: {
    type: string;
    amount: number;
    description?: string;
  }[];
}

export class CreateTripResponseDto {
  id: string;
  status: string;
  riderId: string;
  vehicleType: string;
  requestedAt: Date;
  quoteId: string;
  estimateTotal: number;
  basePrice: number;
  surgeMultiplier: number;
  currency: string;
  breakdown: PricingBreakdownDto;
  distanceMeters?: number;
  durationSeconds?: number;
  degradation?: string | null;
}
