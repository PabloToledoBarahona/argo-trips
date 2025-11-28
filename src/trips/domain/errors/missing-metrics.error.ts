export class MissingMetricsError extends Error {
  constructor(
    public readonly tripId: string,
    public readonly command: string,
  ) {
    super(
      `Missing required metrics for ${command} on trip ${tripId}. Final distance and duration are required.`,
    );
    this.name = 'MissingMetricsError';
    Error.captureStackTrace(this, this.constructor);
  }
}
