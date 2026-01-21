import { Module } from '@nestjs/common';
import { SharedModule } from '../shared/shared.module.js';

// Domain
import { TripStateMachine } from './domain/state-machine/trip.state-machine.js';

// Application Use Cases
import { CreateTripUseCase } from './application/create-trip/create-trip.use-case.js';
import { AcceptTripUseCase } from './application/accept-trip/accept-trip.use-case.js';
import { VerifyPinUseCase } from './application/verify-pin/verify-pin.use-case.js';
import { StartTripUseCase } from './application/start-trip/start-trip.use-case.js';
import { CompleteTripUseCase } from './application/complete-trip/complete-trip.use-case.js';
import { CancelTripUseCase } from './application/cancel-trip/cancel-trip.use-case.js';
import { MarkPaidUseCase } from './application/mark-paid/mark-paid.use-case.js';

// Infrastructure - Persistence
import { PrismaService } from './infrastructure/persistence/prisma/prisma.service.js';
import { TripPrismaRepository } from './infrastructure/persistence/prisma/trip-prisma.repository.js';
import { TripPointsPrismaRepository } from './infrastructure/persistence/prisma/trip-points-prisma.repository.js';
import { TripAuditPrismaRepository } from './infrastructure/persistence/prisma/trip-audit-prisma.repository.js';
import { TripCancellationsPrismaRepository } from './infrastructure/persistence/prisma/trip-cancellations-prisma.repository.js';

// Infrastructure - Redis
import { TripLockService } from './infrastructure/redis/trip-lock.service.js';
import { TripStateCacheService } from './infrastructure/redis/trip-state-cache.service.js';
import { PinCacheService } from './infrastructure/redis/pin-cache.service.js';
import { TimerService } from './infrastructure/redis/timer.service.js';

// Infrastructure - HTTP Clients
import { GeoClient } from './infrastructure/http-clients/geo.client.js';
import { PricingClient } from './infrastructure/http-clients/pricing.client.js';
import { PaymentsClient } from './infrastructure/http-clients/payments.client.js';
import { DriverSessionsClient } from './infrastructure/http-clients/driver-sessions.client.js';

// Interfaces
import { TripsController } from './interfaces/http/trips.controller.js';
import { PaymentsEventsHandler } from './interfaces/events/payments.events.handler.js';
import { DriverSessionsEventsHandler } from './interfaces/events/driver-sessions.events.handler.js';
import { TripsJobsProcessor } from './interfaces/jobs/trips.jobs.processor.js';

// Event Bus Handler
import { TripEventsHandler } from '../shared/event-bus/trip-events.handler.js';

@Module({
  imports: [SharedModule],
  controllers: [TripsController],
  providers: [
    // Domain
    TripStateMachine,

    // Application
    CreateTripUseCase,
    AcceptTripUseCase,
    VerifyPinUseCase,
    StartTripUseCase,
    CompleteTripUseCase,
    CancelTripUseCase,
    MarkPaidUseCase,

    // Infrastructure - Persistence
    PrismaService,
    TripPrismaRepository,
    TripPointsPrismaRepository,
    TripAuditPrismaRepository,
    TripCancellationsPrismaRepository,

    // Infrastructure - Redis
    TripLockService,
    TripStateCacheService,
    PinCacheService,
    TimerService,

    // Infrastructure - HTTP Clients
    GeoClient,
    PricingClient,
    PaymentsClient,
    DriverSessionsClient,

    // Interfaces
    PaymentsEventsHandler,
    DriverSessionsEventsHandler,
    TripsJobsProcessor,

    // Event Bus Handler
    TripEventsHandler,
  ],
  exports: [],
})
export class TripsModule {}
