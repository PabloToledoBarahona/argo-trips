import { LoggerService as NestLoggerService } from '@nestjs/common';
import { Logger as PinoLogger } from 'nestjs-pino';
export declare class LoggerService implements NestLoggerService {
    private readonly pinoLogger;
    constructor(pinoLogger: PinoLogger);
    log(message: string, context?: string): void;
    error(message: string, trace?: string, context?: string): void;
    warn(message: string, context?: string): void;
    debug(message: string, context?: string): void;
    verbose(message: string, context?: string): void;
}
