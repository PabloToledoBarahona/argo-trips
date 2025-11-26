import { CreateTripDto, CreateTripResponseDto } from './create-trip.dto.js';
export declare class CreateTripUseCase {
    constructor();
    execute(dto: CreateTripDto): Promise<CreateTripResponseDto>;
}
