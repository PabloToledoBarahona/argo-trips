import { MarkPaidDto, MarkPaidResponseDto } from './mark-paid.dto.js';
export declare class MarkPaidUseCase {
    constructor();
    execute(dto: MarkPaidDto): Promise<MarkPaidResponseDto>;
}
