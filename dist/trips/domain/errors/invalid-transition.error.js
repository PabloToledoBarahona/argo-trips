"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InvalidTransitionError = void 0;
class InvalidTransitionError extends Error {
    currentStatus;
    command;
    targetStatus;
    constructor(currentStatus, command, targetStatus) {
        super(`Invalid transition: cannot execute ${command} from ${currentStatus}${targetStatus ? ` to ${targetStatus}` : ''}`);
        this.currentStatus = currentStatus;
        this.command = command;
        this.targetStatus = targetStatus;
        this.name = 'InvalidTransitionError';
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.InvalidTransitionError = InvalidTransitionError;
//# sourceMappingURL=invalid-transition.error.js.map