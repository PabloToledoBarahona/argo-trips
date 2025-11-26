import { IsString, IsNotEmpty } from 'class-validator';

export class StartTripDto {
  @IsString()
  @IsNotEmpty()
  tripId: string;
}

export class StartTripResponseDto {
  id: string;
  status: string;
  inProgressAt: Date;
}
