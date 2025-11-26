"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TripsModule = void 0;
const common_1 = require("@nestjs/common");
const shared_module_js_1 = require("../shared/shared.module.js");
const trip_state_machine_js_1 = require("./domain/state-machine/trip.state-machine.js");
const create_trip_use_case_js_1 = require("./application/create-trip/create-trip.use-case.js");
const accept_trip_use_case_js_1 = require("./application/accept-trip/accept-trip.use-case.js");
const verify_pin_use_case_js_1 = require("./application/verify-pin/verify-pin.use-case.js");
const start_trip_use_case_js_1 = require("./application/start-trip/start-trip.use-case.js");
const complete_trip_use_case_js_1 = require("./application/complete-trip/complete-trip.use-case.js");
const cancel_trip_use_case_js_1 = require("./application/cancel-trip/cancel-trip.use-case.js");
const mark_paid_use_case_js_1 = require("./application/mark-paid/mark-paid.use-case.js");
const prisma_service_js_1 = require("./infrastructure/persistence/prisma/prisma.service.js");
const trip_prisma_repository_js_1 = require("./infrastructure/persistence/prisma/trip-prisma.repository.js");
const trip_points_prisma_repository_js_1 = require("./infrastructure/persistence/prisma/trip-points-prisma.repository.js");
const trip_audit_prisma_repository_js_1 = require("./infrastructure/persistence/prisma/trip-audit-prisma.repository.js");
const trip_cancellations_prisma_repository_js_1 = require("./infrastructure/persistence/prisma/trip-cancellations-prisma.repository.js");
const trip_lock_service_js_1 = require("./infrastructure/redis/trip-lock.service.js");
const trip_state_cache_service_js_1 = require("./infrastructure/redis/trip-state-cache.service.js");
const pin_cache_service_js_1 = require("./infrastructure/redis/pin-cache.service.js");
const timer_service_js_1 = require("./infrastructure/redis/timer.service.js");
const geo_client_js_1 = require("./infrastructure/http-clients/geo.client.js");
const pricing_client_js_1 = require("./infrastructure/http-clients/pricing.client.js");
const payments_client_js_1 = require("./infrastructure/http-clients/payments.client.js");
const driver_sessions_client_js_1 = require("./infrastructure/http-clients/driver-sessions.client.js");
const trips_controller_js_1 = require("./interfaces/http/trips.controller.js");
const payments_events_handler_js_1 = require("./interfaces/events/payments.events.handler.js");
const driver_sessions_events_handler_js_1 = require("./interfaces/events/driver-sessions.events.handler.js");
const trips_jobs_processor_js_1 = require("./interfaces/jobs/trips.jobs.processor.js");
let TripsModule = class TripsModule {
};
exports.TripsModule = TripsModule;
exports.TripsModule = TripsModule = __decorate([
    (0, common_1.Module)({
        imports: [shared_module_js_1.SharedModule],
        controllers: [trips_controller_js_1.TripsController],
        providers: [
            trip_state_machine_js_1.TripStateMachine,
            create_trip_use_case_js_1.CreateTripUseCase,
            accept_trip_use_case_js_1.AcceptTripUseCase,
            verify_pin_use_case_js_1.VerifyPinUseCase,
            start_trip_use_case_js_1.StartTripUseCase,
            complete_trip_use_case_js_1.CompleteTripUseCase,
            cancel_trip_use_case_js_1.CancelTripUseCase,
            mark_paid_use_case_js_1.MarkPaidUseCase,
            prisma_service_js_1.PrismaService,
            trip_prisma_repository_js_1.TripPrismaRepository,
            trip_points_prisma_repository_js_1.TripPointsPrismaRepository,
            trip_audit_prisma_repository_js_1.TripAuditPrismaRepository,
            trip_cancellations_prisma_repository_js_1.TripCancellationsPrismaRepository,
            trip_lock_service_js_1.TripLockService,
            trip_state_cache_service_js_1.TripStateCacheService,
            pin_cache_service_js_1.PinCacheService,
            timer_service_js_1.TimerService,
            geo_client_js_1.GeoClient,
            pricing_client_js_1.PricingClient,
            payments_client_js_1.PaymentsClient,
            driver_sessions_client_js_1.DriverSessionsClient,
            payments_events_handler_js_1.PaymentsEventsHandler,
            driver_sessions_events_handler_js_1.DriverSessionsEventsHandler,
            trips_jobs_processor_js_1.TripsJobsProcessor,
        ],
        exports: [],
    })
], TripsModule);
//# sourceMappingURL=trips.module.js.map