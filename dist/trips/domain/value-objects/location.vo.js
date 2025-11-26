"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Location = void 0;
class Location {
    lat;
    lng;
    h3_res9;
    constructor(lat, lng, h3_res9) {
        this.lat = lat;
        this.lng = lng;
        this.h3_res9 = h3_res9;
        if (lat < -90 || lat > 90) {
            throw new Error('Invalid latitude');
        }
        if (lng < -180 || lng > 180) {
            throw new Error('Invalid longitude');
        }
    }
    toString() {
        return `${this.lat},${this.lng}`;
    }
}
exports.Location = Location;
//# sourceMappingURL=location.vo.js.map