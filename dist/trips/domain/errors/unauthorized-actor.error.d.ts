export declare class UnauthorizedActorError extends Error {
    readonly actorType: string;
    readonly actorId: string | undefined;
    readonly requiredActorType: string;
    readonly command: string;
    constructor(actorType: string, actorId: string | undefined, requiredActorType: string, command: string);
}
