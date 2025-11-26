import { Injectable } from '@nestjs/common';
import { MarkPaidDto, MarkPaidResponseDto } from './mark-paid.dto.js';

@Injectable()
export class MarkPaidUseCase {
  constructor() {}

  async execute(dto: MarkPaidDto): Promise<MarkPaidResponseDto> {
    // TODO: Implement mark paid logic
    throw new Error('Not implemented');
  }
}
