export class PaymentNotCapturedError extends Error {
  constructor(
    public readonly tripId: string,
    public readonly paymentIntentId?: string,
  ) {
    super(
      `Payment not captured for trip ${tripId}${
        paymentIntentId ? ` (Intent: ${paymentIntentId})` : ''
      }. Cannot mark as PAID without payment confirmation.`,
    );
    this.name = 'PaymentNotCapturedError';
    Error.captureStackTrace(this, this.constructor);
  }
}
