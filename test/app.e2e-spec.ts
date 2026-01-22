import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/trips/infrastructure/persistence/prisma/prisma.service';
import { RedisService } from '../src/shared/redis/redis.service';
import { EventBusService } from '../src/shared/event-bus/event-bus.service';
import { ServiceTokenService } from '../src/shared/auth/services/service-token.service';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  const prismaServiceMock = {
    onModuleInit: jest.fn(),
    onModuleDestroy: jest.fn(),
    $connect: jest.fn(),
    $disconnect: jest.fn(),
  };

  const redisServiceMock = {
    getClient: jest.fn(),
    set: jest.fn(),
    get: jest.fn(),
    del: jest.fn(),
    exists: jest.fn(),
    setJson: jest.fn(),
    getJson: jest.fn(),
    setNx: jest.fn(),
    onModuleDestroy: jest.fn(),
  };

  const eventBusServiceMock = {
    onModuleInit: jest.fn(),
    onModuleDestroy: jest.fn(),
    registerHandler: jest.fn(),
    markHandlersReady: jest.fn(),
    publishTripEvent: jest.fn().mockResolvedValue(null),
    isAvailable: jest.fn().mockReturnValue(false),
  };

  const serviceTokenServiceMock = {
    onModuleInit: jest.fn(),
    getServiceHeaders: jest
      .fn()
      .mockResolvedValue({ Authorization: 'Bearer test', 'Content-Type': 'application/json' }),
  };

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaServiceMock)
      .overrideProvider(RedisService)
      .useValue(redisServiceMock)
      .overrideProvider(EventBusService)
      .useValue(eventBusServiceMock)
      .overrideProvider(ServiceTokenService)
      .useValue(serviceTokenServiceMock)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('/healthz (GET)', () => {
    return request(app.getHttpServer())
      .get('/healthz')
      .expect(200)
      .expect({
        status: 'healthy',
        service: 'argo-trips',
      });
  });
});
