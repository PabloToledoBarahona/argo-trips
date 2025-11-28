export class MissingPricingSnapshotError extends Error {
  constructor(
    public readonly tripId: string,
    public readonly command: string,
  ) {
    super(
      `Missing pricing snapshot from Pricing/finalize for ${command} on trip ${tripId}`,
    );
    this.name = 'MissingPricingSnapshotError';
    Error.captureStackTrace(this, this.constructor);
  }
}
