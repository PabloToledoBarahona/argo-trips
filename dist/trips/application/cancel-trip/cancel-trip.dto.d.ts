import { CancelReason } from '../../domain/enums/cancel-reason.enum.js';
import { CancelSide } from '../../domain/enums/cancel-side.enum.js';
export declare class CancelTripDto {
    tripId: string;
    reason: CancelReason;
    side: CancelSide;
    notes?: string;
}
export declare class CancelTripResponseDto {
    id: string;
    status: string;
    cancelAt: Date;
    cancelReason: CancelReason;
    cancelSide: CancelSide;
}
