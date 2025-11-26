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
export declare class CreateTripResponseDto {
    id: string;
    status: string;
    riderId: string;
    vehicleType: string;
    requestedAt: Date;
}
