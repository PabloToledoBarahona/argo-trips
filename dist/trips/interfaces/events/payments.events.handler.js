"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var PaymentsEventsHandler_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentsEventsHandler = void 0;
const common_1 = require("@nestjs/common");
let PaymentsEventsHandler = PaymentsEventsHandler_1 = class PaymentsEventsHandler {
    logger = new common_1.Logger(PaymentsEventsHandler_1.name);
    async handlePaymentCaptured(event) {
        this.logger.log(`Payment captured for trip ${event.tripId}`);
    }
    async handlePaymentFailed(event) {
        this.logger.warn(`Payment failed for trip ${event.tripId}`);
    }
    async handlePaymentRefunded(event) {
        this.logger.log(`Payment refunded for trip ${event.tripId}`);
    }
};
exports.PaymentsEventsHandler = PaymentsEventsHandler;
exports.PaymentsEventsHandler = PaymentsEventsHandler = PaymentsEventsHandler_1 = __decorate([
    (0, common_1.Injectable)()
], PaymentsEventsHandler);
//# sourceMappingURL=payments.events.handler.js.map