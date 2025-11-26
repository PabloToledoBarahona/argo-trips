import { CreateTripUseCase } from '../../application/create-trip/create-trip.use-case.js';
import { AcceptTripUseCase } from '../../application/accept-trip/accept-trip.use-case.js';
import { VerifyPinUseCase } from '../../application/verify-pin/verify-pin.use-case.js';
import { StartTripUseCase } from '../../application/start-trip/start-trip.use-case.js';
import { CompleteTripUseCase } from '../../application/complete-trip/complete-trip.use-case.js';
import { CancelTripUseCase } from '../../application/cancel-trip/cancel-trip.use-case.js';
import { CreateTripDto, CreateTripResponseDto } from '../../application/create-trip/create-trip.dto.js';
import { AcceptTripDto, AcceptTripResponseDto } from '../../application/accept-trip/accept-trip.dto.js';
import { VerifyPinDto, VerifyPinResponseDto } from '../../application/verify-pin/verify-pin.dto.js';
import { StartTripResponseDto } from '../../application/start-trip/start-trip.dto.js';
import { CompleteTripDto, CompleteTripResponseDto } from '../../application/complete-trip/complete-trip.dto.js';
import { CancelTripDto, CancelTripResponseDto } from '../../application/cancel-trip/cancel-trip.dto.js';
import type { ArgoUser } from '../../../shared/auth/types/argo-user.type.js';
export declare class TripsController {
    private readonly createTripUseCase;
    private readonly acceptTripUseCase;
    private readonly verifyPinUseCase;
    private readonly startTripUseCase;
    private readonly completeTripUseCase;
    private readonly cancelTripUseCase;
    constructor(createTripUseCase: CreateTripUseCase, acceptTripUseCase: AcceptTripUseCase, verifyPinUseCase: VerifyPinUseCase, startTripUseCase: StartTripUseCase, completeTripUseCase: CompleteTripUseCase, cancelTripUseCase: CancelTripUseCase);
    createTrip(dto: CreateTripDto, user: ArgoUser): Promise<CreateTripResponseDto>;
    acceptTrip(id: string, dto: Omit<AcceptTripDto, 'tripId'>, user: ArgoUser): Promise<AcceptTripResponseDto>;
    verifyPin(id: string, dto: Omit<VerifyPinDto, 'tripId'>, user: ArgoUser): Promise<VerifyPinResponseDto>;
    startTrip(id: string, user: ArgoUser): Promise<StartTripResponseDto>;
    completeTrip(id: string, dto: Omit<CompleteTripDto, 'tripId'>, user: ArgoUser): Promise<CompleteTripResponseDto>;
    cancelTrip(id: string, dto: Omit<CancelTripDto, 'tripId'>, user: ArgoUser): Promise<CancelTripResponseDto>;
}
