export class UnauthorizedActorError extends Error {
  constructor(
    public readonly actorType: string,
    public readonly actorId: string | undefined,
    public readonly requiredActorType: string,
    public readonly command: string,
  ) {
    super(
      `Unauthorized: ${actorType}${actorId ? `:${actorId}` : ''} cannot execute ${command}. Required: ${requiredActorType}`,
    );
    this.name = 'UnauthorizedActorError';
    Error.captureStackTrace(this, this.constructor);
  }
}
