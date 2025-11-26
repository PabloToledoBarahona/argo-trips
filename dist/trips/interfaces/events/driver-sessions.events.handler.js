"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var DriverSessionsEventsHandler_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DriverSessionsEventsHandler = void 0;
const common_1 = require("@nestjs/common");
let DriverSessionsEventsHandler = DriverSessionsEventsHandler_1 = class DriverSessionsEventsHandler {
    logger = new common_1.Logger(DriverSessionsEventsHandler_1.name);
    async handleDriverAvailabilityChanged(event) {
        this.logger.log(`Driver ${event.driverId} availability: ${event.available}`);
    }
    async handleDriverLocationUpdated(event) {
        this.logger.debug(`Driver ${event.driverId} location updated`);
    }
};
exports.DriverSessionsEventsHandler = DriverSessionsEventsHandler;
exports.DriverSessionsEventsHandler = DriverSessionsEventsHandler = DriverSessionsEventsHandler_1 = __decorate([
    (0, common_1.Injectable)()
], DriverSessionsEventsHandler);
//# sourceMappingURL=driver-sessions.events.handler.js.map