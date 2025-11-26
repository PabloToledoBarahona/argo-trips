import { IsString, IsNotEmpty, IsNumber, IsOptional, Min } from 'class-validator';

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
}
