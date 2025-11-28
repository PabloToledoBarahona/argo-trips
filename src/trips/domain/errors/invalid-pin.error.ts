export class InvalidPINError extends Error {
  constructor(
    public readonly tripId: string,
    public readonly attemptsRemaining?: number,
  ) {
    super(
      `Invalid PIN for trip ${tripId}${
        attemptsRemaining !== undefined
          ? `. Attempts remaining: ${attemptsRemaining}`
          : ''
      }`,
    );
    this.name = 'InvalidPINError';
    Error.captureStackTrace(this, this.constructor);
  }
}
