import { StartTripDto, StartTripResponseDto } from './start-trip.dto.js';
export declare class StartTripUseCase {
    constructor();
    execute(dto: StartTripDto): Promise<StartTripResponseDto>;
}
