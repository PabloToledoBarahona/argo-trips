export class DriverNotOnlineError extends Error {
  constructor(
    public readonly driverId: string,
    public readonly tripId: string,
  ) {
    super(
      `Driver ${driverId} is not online or not eligible for trip ${tripId}`,
    );
    this.name = 'DriverNotOnlineError';
    Error.captureStackTrace(this, this.constructor);
  }
}
