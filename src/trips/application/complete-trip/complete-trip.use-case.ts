import { Injectable } from '@nestjs/common';
import { CompleteTripDto, CompleteTripResponseDto } from './complete-trip.dto.js';

@Injectable()
export class CompleteTripUseCase {
  constructor() {}

  async execute(dto: CompleteTripDto): Promise<CompleteTripResponseDto> {
    // TODO: Implement complete trip logic
    throw new Error('Not implemented');
  }
}
