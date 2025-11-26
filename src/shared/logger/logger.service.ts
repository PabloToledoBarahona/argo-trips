import { Injectable, LoggerService as NestLoggerService } from '@nestjs/common';
import { Logger as PinoLogger } from 'nestjs-pino';

@Injectable()
export class LoggerService implements NestLoggerService {
  constructor(private readonly pinoLogger: PinoLogger) {}

  log(message: string, context?: string): void {
    this.pinoLogger.log(message, context);
  }

  error(message: string, trace?: string, context?: string): void {
    this.pinoLogger.error({ trace }, message, context);
  }

  warn(message: string, context?: string): void {
    this.pinoLogger.warn(message, context);
  }

  debug(message: string, context?: string): void {
    this.pinoLogger.debug(message, context);
  }

  verbose(message: string, context?: string): void {
    this.pinoLogger.verbose(message, context);
  }
}
