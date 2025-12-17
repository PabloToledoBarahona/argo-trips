"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapToGeoProfile = mapToGeoProfile;
const common_1 = require("@nestjs/common");
function mapToGeoProfile(vehicleType) {
    const normalized = vehicleType?.toLowerCase?.();
    switch (normalized) {
        case 'economy':
        case 'premium':
            return 'car';
        case 'delivery':
            return 'moto';
        default:
            throw new common_1.BadRequestException(`Cannot map vehicle type "${vehicleType}" to GEO profile. Supported types: economy, premium, delivery`);
    }
}
//# sourceMappingURL=geo-profile.mapper.js.map