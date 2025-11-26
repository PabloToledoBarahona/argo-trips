import { AcceptTripDto, AcceptTripResponseDto } from './accept-trip.dto.js';
export declare class AcceptTripUseCase {
    constructor();
    execute(dto: AcceptTripDto): Promise<AcceptTripResponseDto>;
}
