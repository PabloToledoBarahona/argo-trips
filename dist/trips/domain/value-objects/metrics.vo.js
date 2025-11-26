"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Metrics = void 0;
class Metrics {
    distance_m;
    duration_s;
    phase;
    constructor(distance_m, duration_s, phase) {
        this.distance_m = distance_m;
        this.duration_s = duration_s;
        this.phase = phase;
        if (distance_m < 0) {
            throw new Error('Distance cannot be negative');
        }
        if (duration_s < 0) {
            throw new Error('Duration cannot be negative');
        }
    }
}
exports.Metrics = Metrics;
//# sourceMappingURL=metrics.vo.js.map