import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  ConflictException,
} from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { IdempotencyService } from './idempotency.service.js';

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(private readonly idempotencyService: IdempotencyService) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    const idempotencyKey = request.headers['idempotency-key'] as string;

    if (!idempotencyKey) {
      return next.handle();
    }

    const existingResponse =
      await this.idempotencyService.getIdempotentResponse(idempotencyKey);

    if (existingResponse) {
      return of(existingResponse);
    }

    return next.handle().pipe(
      tap(async (response) => {
        await this.idempotencyService.setIdempotentResponse(
          idempotencyKey,
          response,
        );
      }),
    );
  }
}
