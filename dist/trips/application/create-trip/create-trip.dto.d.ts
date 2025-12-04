export declare class CreateTripDto {
    riderId: string;
    vehicleType: string;
    city: string;
    originLat: number;
    originLng: number;
    originH3Res9: string;
    destLat: number;
    destLng: number;
    destH3Res9: string;
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
export declare class CreateTripResponseDto {
    id: string;
    status: string;
    riderId: string;
    vehicleType: string;
    requestedAt: Date;
    quoteId: string;
    estimateTotal: number;
    basePrice: number;
    surgeMultiplier: number;
    currency: string;
    breakdown: PricingBreakdownDto;
    distanceMeters?: number;
    durationSeconds?: number;
}
