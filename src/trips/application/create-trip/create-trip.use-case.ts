import { Injectable } from '@nestjs/common';
import { CreateTripDto, CreateTripResponseDto } from './create-trip.dto.js';

@Injectable()
export class CreateTripUseCase {
  constructor() {}

  async execute(dto: CreateTripDto): Promise<CreateTripResponseDto> {
    // TODO: Implement create trip logic
    throw new Error('Not implemented');
  }
}
