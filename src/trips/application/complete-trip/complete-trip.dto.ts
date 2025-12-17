import { IsString, IsNotEmpty, IsNumber, IsOptional, Min } from 'class-validator';
import { Tax } from '../../infrastructure/http-clients/pricing.client.js';

export class CompleteTripDto {
  @IsString()
  @IsNotEmpty()
  tripId: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  distance_m_final?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  duration_s_final?: number;
}

export class CompleteTripResponseDto {
  id: string;
  status: string;
  completedAt: Date;
  distance_m_final?: number;
  duration_s_final?: number;
  totalPrice: number;
  surgeMultiplier: number;
  currency: string;
  taxes: Tax[];
  min_fare_applied: boolean;
  cancel_fee_applied: boolean;
  pricing_rule_version: string;
  paymentIntentId: string;
  degradation?: string | null;
}
