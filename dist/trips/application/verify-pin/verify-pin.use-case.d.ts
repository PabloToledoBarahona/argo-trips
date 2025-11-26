import { VerifyPinDto, VerifyPinResponseDto } from './verify-pin.dto.js';
export declare class VerifyPinUseCase {
    constructor();
    execute(dto: VerifyPinDto): Promise<VerifyPinResponseDto>;
}
