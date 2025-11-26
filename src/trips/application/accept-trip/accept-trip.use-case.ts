import { Injectable } from '@nestjs/common';
import { AcceptTripDto, AcceptTripResponseDto } from './accept-trip.dto.js';

@Injectable()
export class AcceptTripUseCase {
  constructor() {}

  async execute(dto: AcceptTripDto): Promise<AcceptTripResponseDto> {
    // TODO: Implement accept trip logic
    throw new Error('Not implemented');
  }
}
