import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '../../../shared/http/http.service.js';

// ============================================================================
// DTOs - Payment Intent
// ============================================================================

export type PaymentMethod = 'cash' | 'qr';

export type PaymentIntentStatus =
  | 'requires_payment_method'
  | 'requires_capture'
  | 'succeeded';

export interface CreatePaymentIntentRequest {
  tripId: string;
  amount: number;
  currency: string;
  method: PaymentMethod;
}

export interface CreatePaymentIntentResponse {
  paymentIntentId: string;
  status: PaymentIntentStatus;
  clientSecret: string;
}

// ============================================================================
// DTOs - Get Payment Intent
// ============================================================================

export interface GetPaymentIntentResponse {
  paymentIntentId: string;
  status: PaymentIntentStatus;
}

// ============================================================================
// Payments Client
// ============================================================================

@Injectable()
export class PaymentsClient {
  private readonly logger = new Logger(PaymentsClient.name);
  private readonly baseUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.baseUrl = this.configService.get<string>('PAYMENTS_SERVICE_URL') || 'http://localhost:3007';
  }

  /**
   * Create a payment intent
   *
   * MS07-PAYMENTS: POST /payments/intents
   *
   * @param request - Payment intent request
   * @returns Payment intent with ID, status, and client secret
   * @throws Error if service unavailable or invalid response
   */
  async createIntent(request: CreatePaymentIntentRequest): Promise<CreatePaymentIntentResponse> {
    try {
      this.logger.debug(
        `Creating payment intent for trip: ${request.tripId}, amount: ${request.amount} ${request.currency}`,
      );

      const response = await this.httpService.post<CreatePaymentIntentResponse>(
        `${this.baseUrl}/payments/intents`,
        request,
      );

      if (!response.paymentIntentId || !response.status || !response.clientSecret) {
        throw new Error('Invalid payment intent response: missing required fields');
      }

      this.logger.debug(
        `Payment intent created: ${response.paymentIntentId}, status: ${response.status}`,
      );

      return response;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to create payment intent: ${message}`);
      throw new Error(`Payments service create intent failed: ${message}`);
    }
  }

  /**
   * Get payment intent status
   *
   * MS07-PAYMENTS: GET /payments/intents/:id
   *
   * @param id - Payment intent identifier
   * @returns Payment intent with current status
   * @throws Error if service unavailable or invalid response
   */
  async getIntent(id: string): Promise<GetPaymentIntentResponse> {
    try {
      this.logger.debug(`Getting payment intent: ${id}`);

      const response = await this.httpService.get<GetPaymentIntentResponse>(
        `${this.baseUrl}/payments/intents/${id}`,
      );

      if (!response.paymentIntentId || !response.status) {
        throw new Error('Invalid payment intent response: missing required fields');
      }

      this.logger.debug(`Payment intent: ${id}, status: ${response.status}`);

      return response;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to get payment intent: ${message}`);
      throw new Error(`Payments service get intent failed: ${message}`);
    }
  }
}
