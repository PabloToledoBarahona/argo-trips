import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '../../../shared/http/http.service.js';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// DTOs - Payment Intent
// ============================================================================

export enum PaymentIntentStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  SUCCEEDED = 'SUCCEEDED',
  FAILED = 'FAILED',
  CANCELED = 'CANCELED',
  REFUNDED = 'REFUNDED',
}

export enum PaymentMethod {
  CARD = 'CARD',
  QR = 'QR',
  CASH = 'CASH',
  WALLET = 'WALLET',
}

export interface CreatePaymentIntentRequest {
  tripId: string;
  riderId: string;
  amount: number;
  currency: string;
  quoteId?: string;
  paymentMethod?: PaymentMethod;
  description?: string;
  metadata?: Record<string, any>;
}

export interface CreatePaymentIntentResponse {
  paymentIntentId: string;
  status: PaymentIntentStatus;
  amount: number;
  currency: string;
  clientSecret?: string;
  qrCode?: string;
  expiresAt: string;
  createdAt: string;
}

// ============================================================================
// DTOs - Payment Status
// ============================================================================

export interface GetPaymentStatusResponse {
  paymentIntentId: string;
  status: PaymentIntentStatus;
  amount: number;
  amountCaptured?: number;
  currency: string;
  tripId: string;
  riderId: string;
  paymentMethod?: PaymentMethod;
  capturedAt?: string;
  failureReason?: string;
  metadata?: Record<string, any>;
}

// ============================================================================
// DTOs - Capture Payment
// ============================================================================

export interface CapturePaymentRequest {
  paymentIntentId: string;
  amount?: number;
}

export interface CapturePaymentResponse {
  paymentIntentId: string;
  status: PaymentIntentStatus;
  amountCaptured: number;
  currency: string;
  capturedAt: string;
}

// ============================================================================
// DTOs - Refund Payment
// ============================================================================

export interface RefundPaymentRequest {
  paymentIntentId: string;
  amount?: number;
  reason?: string;
  metadata?: Record<string, any>;
}

export interface RefundPaymentResponse {
  refundId: string;
  paymentIntentId: string;
  status: string;
  amount: number;
  currency: string;
  refundedAt: string;
}

// ============================================================================
// Payments Client
// ============================================================================

@Injectable()
export class PaymentsClient {
  private readonly logger = new Logger(PaymentsClient.name);
  private readonly baseUrl: string;
  private readonly timeout: number = 10000; // Payments may take longer

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.baseUrl = this.configService.get<string>('PAYMENTS_SERVICE_URL') || 'http://localhost:3007';
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    return String(error);
  }

  private getErrorStack(error: unknown): string | undefined {
    if (error instanceof Error) return this.getErrorStack(error);
    return undefined;
  }

  /**
   * Create a payment intent
   *
   * MS07-PAYMENTS: POST /payments/intent
   * MS04-TRIPS: Used in CompleteTripUseCase and CancelTripUseCase (for fees)
   *
   * Creates a payment intent with idempotency support.
   * Returns payment intent ID and client secret for payment processing.
   */
  async createPaymentIntent(
    request: CreatePaymentIntentRequest,
    idempotencyKey?: string,
  ): Promise<CreatePaymentIntentResponse> {
    try {
      this.logger.debug(
        `Creating payment intent for trip: ${request.tripId}, ` +
        `amount: ${request.amount} ${request.currency}`,
      );

      // Generate idempotency key if not provided
      const idemKey = idempotencyKey || `trip-${request.tripId}-${Date.now()}`;

      const headers: Record<string, string> = {
        'Idempotency-Key': idemKey,
      };

      const response = await this.httpService.post<CreatePaymentIntentResponse>(
        `${this.baseUrl}/payments/intent`,
        request,
        {
          timeout: this.timeout,
          headers,
        },
      );

      // Validate response structure
      if (!response.paymentIntentId || !response.status) {
        throw new Error('Invalid payment intent response: missing required fields');
      }

      this.logger.debug(
        `Payment intent created: ${response.paymentIntentId}, ` +
        `status: ${response.status}, expires: ${response.expiresAt}`,
      );

      return response;
    } catch (error) {
      this.logger.error(
        `Failed to create payment intent for trip ${request.tripId}: ${this.getErrorMessage(error)}`,
        this.getErrorStack(error),
      );
      throw new Error(`Payments service create intent failed: ${this.getErrorMessage(error)}`);
    }
  }

  /**
   * Get payment intent status
   *
   * MS07-PAYMENTS: GET /payments/intent/:paymentIntentId
   * MS04-TRIPS: Used to verify payment status
   */
  async getPaymentStatus(paymentIntentId: string): Promise<GetPaymentStatusResponse> {
    try {
      this.logger.debug(`Getting payment status for: ${paymentIntentId}`);

      const response = await this.httpService.get<GetPaymentStatusResponse>(
        `${this.baseUrl}/payments/intent/${paymentIntentId}`,
        { timeout: this.timeout },
      );

      // Validate response structure
      if (!response.paymentIntentId || !response.status) {
        throw new Error('Invalid payment status response');
      }

      this.logger.debug(
        `Payment status: ${paymentIntentId}, status: ${response.status}, ` +
        `captured: ${response.amountCaptured || 0}/${response.amount}`,
      );

      return response;
    } catch (error) {
      this.logger.error(`Failed to get payment status for ${paymentIntentId}: ${this.getErrorMessage(error)}`, this.getErrorStack(error));
      throw new Error(`Payments service get status failed: ${this.getErrorMessage(error)}`);
    }
  }

  /**
   * Capture a payment
   *
   * MS07-PAYMENTS: POST /payments/intent/:paymentIntentId/capture
   * MS04-TRIPS: Typically handled by payment processor, but available for manual capture
   */
  async capturePayment(
    paymentIntentId: string,
    amount?: number,
  ): Promise<CapturePaymentResponse> {
    try {
      this.logger.debug(`Capturing payment: ${paymentIntentId}, amount: ${amount || 'full'}`);

      const request: CapturePaymentRequest = {
        paymentIntentId,
        amount,
      };

      const response = await this.httpService.post<CapturePaymentResponse>(
        `${this.baseUrl}/payments/intent/${paymentIntentId}/capture`,
        request,
        { timeout: this.timeout },
      );

      // Validate response structure
      if (!response.paymentIntentId || response.status !== PaymentIntentStatus.SUCCEEDED) {
        throw new Error('Payment capture failed or invalid response');
      }

      this.logger.debug(
        `Payment captured: ${response.paymentIntentId}, ` +
        `amount: ${response.amountCaptured} ${response.currency}`,
      );

      return response;
    } catch (error) {
      this.logger.error(`Failed to capture payment ${paymentIntentId}: ${this.getErrorMessage(error)}`, this.getErrorStack(error));
      throw new Error(`Payments service capture failed: ${this.getErrorMessage(error)}`);
    }
  }

  /**
   * Refund a payment
   *
   * MS07-PAYMENTS: POST /payments/intent/:paymentIntentId/refund
   * MS04-TRIPS: Used for trip cancellations with refunds
   */
  async refundPayment(
    request: RefundPaymentRequest,
    idempotencyKey?: string,
  ): Promise<RefundPaymentResponse> {
    try {
      this.logger.debug(
        `Refunding payment: ${request.paymentIntentId}, ` +
        `amount: ${request.amount || 'full'}, reason: ${request.reason || 'none'}`,
      );

      // Generate idempotency key if not provided
      const idemKey = idempotencyKey || `refund-${request.paymentIntentId}-${Date.now()}`;

      const headers: Record<string, string> = {
        'Idempotency-Key': idemKey,
      };

      const response = await this.httpService.post<RefundPaymentResponse>(
        `${this.baseUrl}/payments/intent/${request.paymentIntentId}/refund`,
        request,
        {
          timeout: this.timeout,
          headers,
        },
      );

      // Validate response structure
      if (!response.refundId || !response.paymentIntentId) {
        throw new Error('Invalid refund response');
      }

      this.logger.debug(
        `Payment refunded: ${response.refundId}, ` +
        `amount: ${response.amount} ${response.currency}`,
      );

      return response;
    } catch (error) {
      this.logger.error(
        `Failed to refund payment ${request.paymentIntentId}: ${this.getErrorMessage(error)}`,
        this.getErrorStack(error),
      );
      throw new Error(`Payments service refund failed: ${this.getErrorMessage(error)}`);
    }
  }

  /**
   * Cancel a payment intent
   *
   * MS07-PAYMENTS: POST /payments/intent/:paymentIntentId/cancel
   * MS04-TRIPS: Used when trip is canceled before payment
   */
  async cancelPaymentIntent(paymentIntentId: string): Promise<void> {
    try {
      this.logger.debug(`Canceling payment intent: ${paymentIntentId}`);

      await this.httpService.post(
        `${this.baseUrl}/payments/intent/${paymentIntentId}/cancel`,
        {},
        { timeout: this.timeout },
      );

      this.logger.debug(`Payment intent canceled: ${paymentIntentId}`);
    } catch (error) {
      this.logger.warn(`Failed to cancel payment intent ${paymentIntentId}: ${this.getErrorMessage(error)}`);
      // Don't throw - cancellation failures are non-critical
    }
  }

  /**
   * Verify payment was captured
   *
   * MS07-PAYMENTS: Convenience method
   * MS04-TRIPS: Used in MarkPaidUseCase to validate payment before marking trip as PAID
   */
  async verifyPaymentCaptured(paymentIntentId: string): Promise<boolean> {
    try {
      const status = await this.getPaymentStatus(paymentIntentId);

      return (
        status.status === PaymentIntentStatus.SUCCEEDED &&
        status.amountCaptured !== undefined &&
        status.amountCaptured > 0
      );
    } catch (error) {
      this.logger.warn(`Failed to verify payment captured for ${paymentIntentId}: ${this.getErrorMessage(error)}`);
      return false;
    }
  }
}
