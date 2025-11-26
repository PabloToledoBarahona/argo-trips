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
Object.defineProperty(exports, "__esModule", { value: true });
exports.CancelTripResponseDto = exports.CancelTripDto = void 0;
const class_validator_1 = require("class-validator");
const cancel_reason_enum_js_1 = require("../../domain/enums/cancel-reason.enum.js");
const cancel_side_enum_js_1 = require("../../domain/enums/cancel-side.enum.js");
class CancelTripDto {
    tripId;
    reason;
    side;
    notes;
}
exports.CancelTripDto = CancelTripDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CancelTripDto.prototype, "tripId", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(cancel_reason_enum_js_1.CancelReason),
    __metadata("design:type", String)
], CancelTripDto.prototype, "reason", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(cancel_side_enum_js_1.CancelSide),
    __metadata("design:type", String)
], CancelTripDto.prototype, "side", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CancelTripDto.prototype, "notes", void 0);
class CancelTripResponseDto {
    id;
    status;
    cancelAt;
    cancelReason;
    cancelSide;
}
exports.CancelTripResponseDto = CancelTripResponseDto;
//# sourceMappingURL=cancel-trip.dto.js.map