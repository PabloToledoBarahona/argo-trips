import { Injectable, Logger } from '@nestjs/common';

export interface PaymentCapturedEvent {
  paymentIntentId: string;
  tripId: string;
  amount: number;
  currency: string;
  capturedAt: Date;
}

@Injectable()
export class PaymentsEventsHandler {
  private readonly logger = new Logger(PaymentsEventsHandler.name);

  async handlePaymentCaptured(event: PaymentCapturedEvent): Promise<void> {
    this.logger.log(`Payment captured for trip ${event.tripId}`);
    // TODO: Implement payment captured logic
    // Mark trip as PAID
  }

  async handlePaymentFailed(event: any): Promise<void> {
    this.logger.warn(`Payment failed for trip ${event.tripId}`);
    // TODO: Implement payment failed logic
  }

  async handlePaymentRefunded(event: any): Promise<void> {
    this.logger.log(`Payment refunded for trip ${event.tripId}`);
    // TODO: Implement payment refunded logic
  }
}
