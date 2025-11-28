export class AlreadyAssignedError extends Error {
  constructor(
    public readonly tripId: string,
    public readonly existingDriverId: string,
    public readonly attemptedDriverId: string,
  ) {
    super(
      `Trip ${tripId} is already assigned to driver ${existingDriverId}. Cannot assign to ${attemptedDriverId}`,
    );
    this.name = 'AlreadyAssignedError';
    Error.captureStackTrace(this, this.constructor);
  }
}
