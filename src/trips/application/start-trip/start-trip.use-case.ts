import { Injectable } from '@nestjs/common';
import { StartTripDto, StartTripResponseDto } from './start-trip.dto.js';

@Injectable()
export class StartTripUseCase {
  constructor() {}

  async execute(dto: StartTripDto): Promise<StartTripResponseDto> {
    // TODO: Implement start trip logic
    throw new Error('Not implemented');
  }
}
