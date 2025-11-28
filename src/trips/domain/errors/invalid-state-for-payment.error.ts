export class InvalidStateForPaymentError extends Error {
  constructor(
    public readonly tripId: string,
    public readonly currentStatus: string,
  ) {
    super(
      `Trip ${tripId} is in status ${currentStatus}. Payment can only be marked on COMPLETED trips.`,
    );
    this.name = 'InvalidStateForPaymentError';
    Error.captureStackTrace(this, this.constructor);
  }
}
