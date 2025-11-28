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
exports.TripPointsPrismaRepository = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_js_1 = require("./prisma.service.js");
const client_1 = require("@prisma/client");
let TripPointsPrismaRepository = class TripPointsPrismaRepository {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async create(point) {
        const prismaPoint = await this.prisma.tripPoint.create({
            data: {
                tripId: point.tripId,
                phase: this.mapPhaseToPrisma(point.phase),
                lat: point.lat,
                lng: point.lng,
                h3Res9: point.h3Res9,
                speedMps: point.speedMps,
                headingDeg: point.headingDeg,
                ts: point.ts,
            },
        });
        return this.mapToDomain(prismaPoint);
    }
    async createMany(points) {
        const result = await this.prisma.tripPoint.createMany({
            data: points.map(point => ({
                tripId: point.tripId,
                phase: this.mapPhaseToPrisma(point.phase),
                lat: point.lat,
                lng: point.lng,
                h3Res9: point.h3Res9,
                speedMps: point.speedMps,
                headingDeg: point.headingDeg,
                ts: point.ts,
            })),
        });
        return result.count;
    }
    async findByTripId(tripId, phase) {
        const where = { tripId };
        if (phase) {
            where.phase = this.mapPhaseToPrisma(phase);
        }
        const prismaPoints = await this.prisma.tripPoint.findMany({
            where,
            orderBy: { ts: 'asc' },
        });
        return prismaPoints.map(point => this.mapToDomain(point));
    }
    async countByTripId(tripId, phase) {
        const where = { tripId };
        if (phase) {
            where.phase = this.mapPhaseToPrisma(phase);
        }
        return await this.prisma.tripPoint.count({ where });
    }
    mapToDomain(prismaPoint) {
        return {
            id: prismaPoint.id,
            tripId: prismaPoint.tripId,
            phase: prismaPoint.phase,
            lat: prismaPoint.lat,
            lng: prismaPoint.lng,
            h3Res9: prismaPoint.h3Res9,
            speedMps: prismaPoint.speedMps ?? undefined,
            headingDeg: prismaPoint.headingDeg ?? undefined,
            ts: prismaPoint.ts,
        };
    }
    mapPhaseToPrisma(phase) {
        const phaseMap = {
            'pickup': client_1.TripPointPhase.pickup,
            'in_progress': client_1.TripPointPhase.in_progress,
        };
        return phaseMap[phase] || client_1.TripPointPhase.in_progress;
    }
};
exports.TripPointsPrismaRepository = TripPointsPrismaRepository;
exports.TripPointsPrismaRepository = TripPointsPrismaRepository = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_js_1.PrismaService])
], TripPointsPrismaRepository);
//# sourceMappingURL=trip-points-prisma.repository.js.map