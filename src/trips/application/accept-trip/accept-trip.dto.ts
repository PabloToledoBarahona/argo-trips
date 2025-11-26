import { IsString, IsNotEmpty } from 'class-validator';

export class AcceptTripDto {
  @IsString()
  @IsNotEmpty()
  tripId: string;

  @IsString()
  @IsNotEmpty()
  driverId: string;
}

export class AcceptTripResponseDto {
  id: string;
  status: string;
  driverId: string;
  assignedAt: Date;
}
