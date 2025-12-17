"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapToPricingVehicleType = mapToPricingVehicleType;
const common_1 = require("@nestjs/common");
const MS06_VEHICLE_TYPES = [
    'moto',
    'delivery',
    'economy',
    'comfort',
    'premium',
    'xl',
];
function mapToPricingVehicleType(vehicleType) {
    const normalized = vehicleType?.toLowerCase?.();
    if (MS06_VEHICLE_TYPES.includes(normalized)) {
        return normalized;
    }
    throw new common_1.BadRequestException(`Unsupported vehicle type "${vehicleType}". Supported types: ${MS06_VEHICLE_TYPES.join(', ')}`);
}
//# sourceMappingURL=vehicle-type.mapper.js.map