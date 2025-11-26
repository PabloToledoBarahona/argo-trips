import { IsString, IsNotEmpty, IsEnum, IsOptional } from 'class-validator';
import { CancelReason } from '../../domain/enums/cancel-reason.enum.js';
import { CancelSide } from '../../domain/enums/cancel-side.enum.js';

export class CancelTripDto {
  @IsString()
  @IsNotEmpty()
  tripId: string;

  @IsEnum(CancelReason)
  reason: CancelReason;

  @IsEnum(CancelSide)
  side: CancelSide;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class CancelTripResponseDto {
  id: string;
  status: string;
  cancelAt: Date;
  cancelReason: CancelReason;
  cancelSide: CancelSide;
}
