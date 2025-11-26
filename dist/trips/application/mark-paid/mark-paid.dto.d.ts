export declare class MarkPaidDto {
    tripId: string;
    paymentIntentId: string;
}
export declare class MarkPaidResponseDto {
    id: string;
    status: string;
    paidAt: Date;
    paymentIntentId: string;
}
