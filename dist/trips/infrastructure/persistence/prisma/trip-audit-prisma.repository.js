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
exports.TripAuditPrismaRepository = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_js_1 = require("./prisma.service.js");
const client_1 = require("@prisma/client");
let TripAuditPrismaRepository = class TripAuditPrismaRepository {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async create(audit) {
        const prismaAudit = await this.prisma.tripAudit.create({
            data: {
                tripId: audit.tripId,
                action: audit.action,
                actorType: this.mapActorTypeToPrisma(audit.actorType),
                actorId: audit.actorId,
                payload: audit.payload,
                ip: audit.ip,
            },
        });
        return {
            id: prismaAudit.id,
            tripId: prismaAudit.tripId,
            action: prismaAudit.action,
            actorType: prismaAudit.actorType,
            actorId: prismaAudit.actorId ?? undefined,
            payload: prismaAudit.payload,
            ip: prismaAudit.ip ?? undefined,
            ts: prismaAudit.ts,
        };
    }
    async findByTripId(tripId) {
        const prismaAudits = await this.prisma.tripAudit.findMany({
            where: { tripId },
            orderBy: { ts: 'asc' },
        });
        return prismaAudits.map(audit => ({
            id: audit.id,
            tripId: audit.tripId,
            action: audit.action,
            actorType: audit.actorType,
            actorId: audit.actorId ?? undefined,
            payload: audit.payload,
            ip: audit.ip ?? undefined,
            ts: audit.ts,
        }));
    }
    mapActorTypeToPrisma(actorType) {
        const typeMap = {
            'rider': client_1.ActorType.rider,
            'driver': client_1.ActorType.driver,
            'system': client_1.ActorType.system,
        };
        return typeMap[actorType] || client_1.ActorType.system;
    }
};
exports.TripAuditPrismaRepository = TripAuditPrismaRepository;
exports.TripAuditPrismaRepository = TripAuditPrismaRepository = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_js_1.PrismaService])
], TripAuditPrismaRepository);
//# sourceMappingURL=trip-audit-prisma.repository.js.map