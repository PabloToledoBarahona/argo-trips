import { Injectable } from '@nestjs/common';
import { VerifyPinDto, VerifyPinResponseDto } from './verify-pin.dto.js';

@Injectable()
export class VerifyPinUseCase {
  constructor() {}

  async execute(dto: VerifyPinDto): Promise<VerifyPinResponseDto> {
    // TODO: Implement verify pin logic
    throw new Error('Not implemented');
  }
}
