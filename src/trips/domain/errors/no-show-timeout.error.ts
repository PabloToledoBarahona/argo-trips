export class NoShowTimeoutError extends Error {
  constructor(
    public readonly tripId: string,
    public readonly pickupStartedAt: Date,
  ) {
    super(
      `No-show timeout for trip ${tripId}. Pickup started at ${pickupStartedAt.toISOString()} but rider did not board.`,
    );
    this.name = 'NoShowTimeoutError';
    Error.captureStackTrace(this, this.constructor);
  }
}
