import { CompleteTripDto, CompleteTripResponseDto } from './complete-trip.dto.js';
export declare class CompleteTripUseCase {
    constructor();
    execute(dto: CompleteTripDto): Promise<CompleteTripResponseDto>;
}
