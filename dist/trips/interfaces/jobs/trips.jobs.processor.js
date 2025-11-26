"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var TripsJobsProcessor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TripsJobsProcessor = void 0;
const common_1 = require("@nestjs/common");
let TripsJobsProcessor = TripsJobsProcessor_1 = class TripsJobsProcessor {
    logger = new common_1.Logger(TripsJobsProcessor_1.name);
    async processNoShowCheck(tripId) {
        this.logger.log(`Processing no-show check for trip ${tripId}`);
    }
    async processOfferExpiration(tripId) {
        this.logger.log(`Processing offer expiration for trip ${tripId}`);
    }
    async processPickupTimeout(tripId) {
        this.logger.log(`Processing pickup timeout for trip ${tripId}`);
    }
    async processReassignment(tripId) {
        this.logger.log(`Processing reassignment for trip ${tripId}`);
    }
};
exports.TripsJobsProcessor = TripsJobsProcessor;
exports.TripsJobsProcessor = TripsJobsProcessor = TripsJobsProcessor_1 = __decorate([
    (0, common_1.Injectable)()
], TripsJobsProcessor);
//# sourceMappingURL=trips.jobs.processor.js.map