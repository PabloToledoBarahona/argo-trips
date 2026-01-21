import { IsString, IsNumber, IsNotEmpty, Min, Max, IsEnum, IsOptional } from 'class-validator';
import { Transform, Expose } from 'class-transformer';
import { PaymentMethod } from '../../domain/enums/payment-method.enum.js';

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

  /**
   * Payment method for the trip.
   * Accepts both camelCase (paymentMethod) and snake_case (payment_method).
   * Valid values: 'cash', 'qr'
   */
  @Transform(({ obj }) => obj.paymentMethod ?? obj.payment_method)
  @IsEnum(PaymentMethod, {
    message: `paymentMethod must be one of: ${Object.values(PaymentMethod).join(', ')}`,
  })
  @IsNotEmpty({ message: 'paymentMethod is required' })
  paymentMethod: PaymentMethod;

  /**
   * Alias for paymentMethod (snake_case support).
   * This field is transformed into paymentMethod.
   */
  @IsOptional()
  @Expose({ name: 'payment_method' })
  payment_method?: PaymentMethod;

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
  paymentMethod: PaymentMethod;
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
