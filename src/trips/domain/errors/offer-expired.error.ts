export class OfferExpiredError extends Error {
  constructor(
    public readonly tripId: string,
    public readonly offeredAt?: Date,
  ) {
    super(
      `Offer for trip ${tripId} has expired${
        offeredAt ? ` (offered at: ${offeredAt.toISOString()})` : ''
      }`,
    );
    this.name = 'OfferExpiredError';
    Error.captureStackTrace(this, this.constructor);
  }
}
