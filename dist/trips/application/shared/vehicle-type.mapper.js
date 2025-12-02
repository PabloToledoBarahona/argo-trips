"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapToPricingVehicleType = mapToPricingVehicleType;
const common_1 = require("@nestjs/common");
const SUPPORTED_VEHICLE_TYPES = ['economy', 'premium', 'delivery'];
function mapToPricingVehicleType(vehicleType) {
    const normalized = vehicleType?.toLowerCase?.();
    if (SUPPORTED_VEHICLE_TYPES.includes(normalized)) {
        return normalized;
    }
    throw new common_1.BadRequestException(`Unsupported vehicle type "${vehicleType}". Supported types: ${SUPPORTED_VEHICLE_TYPES.join(', ')}`);
}
//# sourceMappingURL=vehicle-type.mapper.js.map