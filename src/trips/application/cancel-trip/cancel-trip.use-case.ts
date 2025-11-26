import { Injectable } from '@nestjs/common';
import { CancelTripDto, CancelTripResponseDto } from './cancel-trip.dto.js';

@Injectable()
export class CancelTripUseCase {
  constructor() {}

  async execute(dto: CancelTripDto): Promise<CancelTripResponseDto> {
    // TODO: Implement cancel trip logic
    throw new Error('Not implemented');
  }
}
