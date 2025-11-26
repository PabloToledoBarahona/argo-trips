import { CancelTripDto, CancelTripResponseDto } from './cancel-trip.dto.js';
export declare class CancelTripUseCase {
    constructor();
    execute(dto: CancelTripDto): Promise<CancelTripResponseDto>;
}
