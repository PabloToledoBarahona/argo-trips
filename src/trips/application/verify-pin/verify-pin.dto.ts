import { IsString, IsNotEmpty, Length } from 'class-validator';

export class VerifyPinDto {
  @IsString()
  @IsNotEmpty()
  tripId: string;

  @IsString()
  @Length(4, 6)
  pin: string;
}

export class VerifyPinResponseDto {
  verified: boolean;
  tripId: string;
}
