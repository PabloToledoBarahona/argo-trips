import { TripStatus } from '../enums/trip-status.enum.js';
import { CancelReason } from '../enums/cancel-reason.enum.js';
import { CancelSide } from '../enums/cancel-side.enum.js';
export interface SpecialChargeSnapshot {
    type: string;
    amount: number;
    description?: string;
}
export interface PricingBreakdownSnapshot {
    distancePrice: number;
    timePrice: number;
    serviceFee: number;
    specialCharges?: SpecialChargeSnapshot[];
}
export interface PricingSnapshot {
    basePrice: number;
    surgeMultiplier: number;
    totalPrice: number;
    currency: string;
    breakdown: PricingBreakdownSnapshot;
    taxes?: number;
}
export declare class Trip {
    id: string;
    riderId: string;
    driverId?: string;
    vehicleType: string;
    status: TripStatus;
    city: string;
    originLat: number;
    originLng: number;
    originH3Res9: string;
    destLat: number;
    destLng: number;
    destH3Res9: string;
    requestedAt: Date;
    offeredAt?: Date;
    assignedAt?: Date;
    pickupStartedAt?: Date;
    inProgressAt?: Date;
    completedAt?: Date;
    paidAt?: Date;
    quoteId?: string;
    pricingSnapshot?: PricingSnapshot;
    paymentIntentId?: string;
    distance_m_est?: number;
    duration_s_est?: number;
    distance_m_final?: number;
    duration_s_final?: number;
    cancelReason?: CancelReason;
    cancelSide?: CancelSide;
    cancelAt?: Date;
    constructor(data: Partial<Trip>);
}
