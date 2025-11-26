import { IsString, IsNotEmpty } from 'class-validator';

export class MarkPaidDto {
  @IsString()
  @IsNotEmpty()
  tripId: string;

  @IsString()
  @IsNotEmpty()
  paymentIntentId: string;
}

export class MarkPaidResponseDto {
  id: string;
  status: string;
  paidAt: Date;
  paymentIntentId: string;
}
