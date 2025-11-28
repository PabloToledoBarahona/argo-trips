export class RadiusTooLargeError extends Error {
  constructor(
    public readonly tripId: string,
    public readonly actualDistance: number,
    public readonly maxDistance: number = 80,
  ) {
    super(
      `Driver is too far from pickup location for trip ${tripId}. Distance: ${actualDistance}m, Max allowed: ${maxDistance}m`,
    );
    this.name = 'RadiusTooLargeError';
    Error.captureStackTrace(this, this.constructor);
  }
}
