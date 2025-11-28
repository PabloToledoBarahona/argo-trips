export declare class InvalidTransitionError extends Error {
    readonly currentStatus: string;
    readonly command: string;
    readonly targetStatus?: string | undefined;
    constructor(currentStatus: string, command: string, targetStatus?: string | undefined);
}
