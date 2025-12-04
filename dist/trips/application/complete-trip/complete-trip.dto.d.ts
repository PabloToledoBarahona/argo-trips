export declare class CompleteTripDto {
    tripId: string;
    distance_m_final?: number;
    duration_s_final?: number;
}
export declare class PricingBreakdownDto {
    distancePrice: number;
    timePrice: number;
    serviceFee: number;
    specialCharges?: {
        type: string;
        amount: number;
        description?: string;
    }[];
}
export declare class CompleteTripResponseDto {
    id: string;
    status: string;
    completedAt: Date;
    distance_m_final?: number;
    duration_s_final?: number;
    totalPrice: number;
    basePrice: number;
    surgeMultiplier: number;
    currency: string;
    breakdown: PricingBreakdownDto;
    paymentIntentId: string;
}
