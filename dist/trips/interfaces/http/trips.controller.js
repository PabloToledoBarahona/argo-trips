"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TripsController = void 0;
const common_1 = require("@nestjs/common");
const create_trip_use_case_js_1 = require("../../application/create-trip/create-trip.use-case.js");
const accept_trip_use_case_js_1 = require("../../application/accept-trip/accept-trip.use-case.js");
const verify_pin_use_case_js_1 = require("../../application/verify-pin/verify-pin.use-case.js");
const start_trip_use_case_js_1 = require("../../application/start-trip/start-trip.use-case.js");
const complete_trip_use_case_js_1 = require("../../application/complete-trip/complete-trip.use-case.js");
const cancel_trip_use_case_js_1 = require("../../application/cancel-trip/cancel-trip.use-case.js");
const create_trip_dto_js_1 = require("../../application/create-trip/create-trip.dto.js");
const current_user_decorator_js_1 = require("../../../shared/auth/decorators/current-user.decorator.js");
let TripsController = class TripsController {
    createTripUseCase;
    acceptTripUseCase;
    verifyPinUseCase;
    startTripUseCase;
    completeTripUseCase;
    cancelTripUseCase;
    constructor(createTripUseCase, acceptTripUseCase, verifyPinUseCase, startTripUseCase, completeTripUseCase, cancelTripUseCase) {
        this.createTripUseCase = createTripUseCase;
        this.acceptTripUseCase = acceptTripUseCase;
        this.verifyPinUseCase = verifyPinUseCase;
        this.startTripUseCase = startTripUseCase;
        this.completeTripUseCase = completeTripUseCase;
        this.cancelTripUseCase = cancelTripUseCase;
    }
    async createTrip(dto, user) {
        return await this.createTripUseCase.execute(dto);
    }
    async acceptTrip(id, dto, user) {
        return await this.acceptTripUseCase.execute({ ...dto, tripId: id });
    }
    async verifyPin(id, dto, user) {
        return await this.verifyPinUseCase.execute({ ...dto, tripId: id });
    }
    async startTrip(id, user) {
        return await this.startTripUseCase.execute({ tripId: id });
    }
    async completeTrip(id, dto, user) {
        return await this.completeTripUseCase.execute({ ...dto, tripId: id });
    }
    async cancelTrip(id, dto, user) {
        return await this.cancelTripUseCase.execute({ ...dto, tripId: id });
    }
};
exports.TripsController = TripsController;
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_trip_dto_js_1.CreateTripDto, Object]),
    __metadata("design:returntype", Promise)
], TripsController.prototype, "createTrip", null);
__decorate([
    (0, common_1.Patch)(':id/accept'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], TripsController.prototype, "acceptTrip", null);
__decorate([
    (0, common_1.Post)(':id/pin/verify'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], TripsController.prototype, "verifyPin", null);
__decorate([
    (0, common_1.Patch)(':id/start'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], TripsController.prototype, "startTrip", null);
__decorate([
    (0, common_1.Patch)(':id/complete'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], TripsController.prototype, "completeTrip", null);
__decorate([
    (0, common_1.Patch)(':id/cancel'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], TripsController.prototype, "cancelTrip", null);
exports.TripsController = TripsController = __decorate([
    (0, common_1.Controller)('trips'),
    __metadata("design:paramtypes", [create_trip_use_case_js_1.CreateTripUseCase,
        accept_trip_use_case_js_1.AcceptTripUseCase,
        verify_pin_use_case_js_1.VerifyPinUseCase,
        start_trip_use_case_js_1.StartTripUseCase,
        complete_trip_use_case_js_1.CompleteTripUseCase,
        cancel_trip_use_case_js_1.CancelTripUseCase])
], TripsController);
//# sourceMappingURL=trips.controller.js.map