export class InvalidTransitionError extends Error {
  constructor(
    public readonly currentStatus: string,
    public readonly command: string,
    public readonly targetStatus?: string,
  ) {
    super(
      `Invalid transition: cannot execute ${command} from ${currentStatus}${
        targetStatus ? ` to ${targetStatus}` : ''
      }`,
    );
    this.name = 'InvalidTransitionError';
    Error.captureStackTrace(this, this.constructor);
  }
}
