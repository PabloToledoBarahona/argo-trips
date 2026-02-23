import {
  IsString,
  IsNumber,
  IsNotEmpty,
  Min,
  Max,
  IsOptional,
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';
import { Expose } from 'class-transformer';
import { PaymentMethod } from '../../domain/enums/payment-method.enum.js';

const PAYMENT_METHOD_VALUES = Object.values(PaymentMethod);

function isValidPaymentMethod(value: unknown): value is PaymentMethod {
  return PAYMENT_METHOD_VALUES.includes(value as PaymentMethod);
}

function IsPaymentMethodInputValid(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isPaymentMethodInputValid',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(_: unknown, args: ValidationArguments) {
          const obj = args.object as {
            paymentMethod?: unknown;
            payment_method?: unknown;
            payment_channel?: unknown;
          };
          const values = [
            obj.paymentMethod,
            obj.payment_method,
            obj.payment_channel,
          ].filter((value) => value !== undefined);

          if (values.length === 0) {
            return false;
          }

          if (!values.every((value) => isValidPaymentMethod(value))) {
            return false;
          }

          return values.every((value) => value === values[0]);
        },
      },
    });
  };
}

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
   * Accepts camelCase (paymentMethod) and snake_case (payment_method, payment_channel).
   * Valid values: 'cash', 'qr'
   */
  @IsPaymentMethodInputValid({
    message: `paymentMethod is required and must be one of: ${PAYMENT_METHOD_VALUES.join(', ')}`,
  })
  paymentMethod?: PaymentMethod;

  /**
   * Alias for paymentMethod (snake_case support).
   */
  @IsOptional()
  @Expose({ name: 'payment_method' })
  payment_method?: PaymentMethod;

  /**
   * Alias for paymentMethod (snake_case support).
   */
  @IsOptional()
  @Expose({ name: 'payment_channel' })
  payment_channel?: PaymentMethod;

  @IsNumber()
  @Min(-90)
  @Max(90)
  originLat: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  originLng: number;

  @IsString()
  @IsOptional()
  @IsNotEmpty()
  originH3Res9?: string;

  @IsNumber()
  @Min(-90)
  @Max(90)
  destLat: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  destLng: number;

  @IsString()
  @IsOptional()
  @IsNotEmpty()
  destH3Res9?: string;
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

export class TripEstimatePointDto {
  lat: number;
  lng: number;
  h3_res9?: string;
}

export class CreateTripResponseDto {
  // New response contract (snake_case)
  trip_id: string;
  origin_h3_res9: string;
  vehicle_type: string;
  origin: TripEstimatePointDto;
  destination: TripEstimatePointDto;
  distance_m_est: number;
  duration_s_est: number;
  estimate_total: number;
  currency: string;

  // Legacy fields kept for backward compatibility
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
  breakdown: PricingBreakdownDto;
  distanceMeters?: number;
  durationSeconds?: number;
  degradation?: string | null;
}
