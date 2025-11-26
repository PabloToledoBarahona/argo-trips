export declare class CompleteTripDto {
    tripId: string;
    distance_m_final?: number;
    duration_s_final?: number;
}
export declare class CompleteTripResponseDto {
    id: string;
    status: string;
    completedAt: Date;
    distance_m_final?: number;
    duration_s_final?: number;
}
