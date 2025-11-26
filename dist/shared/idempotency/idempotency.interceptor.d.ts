import { NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { IdempotencyService } from './idempotency.service.js';
export declare class IdempotencyInterceptor implements NestInterceptor {
    private readonly idempotencyService;
    constructor(idempotencyService: IdempotencyService);
    intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>>;
}
