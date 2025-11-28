"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UnauthorizedActorError = void 0;
class UnauthorizedActorError extends Error {
    actorType;
    actorId;
    requiredActorType;
    command;
    constructor(actorType, actorId, requiredActorType, command) {
        super(`Unauthorized: ${actorType}${actorId ? `:${actorId}` : ''} cannot execute ${command}. Required: ${requiredActorType}`);
        this.actorType = actorType;
        this.actorId = actorId;
        this.requiredActorType = requiredActorType;
        this.command = command;
        this.name = 'UnauthorizedActorError';
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.UnauthorizedActorError = UnauthorizedActorError;
//# sourceMappingURL=unauthorized-actor.error.js.map