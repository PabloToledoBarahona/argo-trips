import { Module } from '@nestjs/common';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';
import { LoggerService } from './logger.service.js';

@Module({
  imports: [
    PinoLoggerModule.forRoot({
      pinoHttp: {
        transport:
          process.env.NODE_ENV !== 'production'
            ? {
                target: 'pino-pretty',
                options: {
                  colorize: true,
                  translateTime: 'HH:MM:ss Z',
                  ignore: 'pid,hostname',
                },
              }
            : undefined,
        level: process.env.LOG_LEVEL || 'info',
        serializers: {
          req: (req: any) => ({
            method: req.method,
            url: req.url,
            headers: req.headers,
          }),
          res: (res: any) => ({
            statusCode: res.statusCode,
          }),
        },
      },
    }),
  ],
  providers: [LoggerService],
  exports: [LoggerService],
})
export class LoggerModule {}
