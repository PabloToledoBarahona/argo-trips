import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '../../../shared/http/http.service.js';

export interface CreatePaymentIntentRequest {
  amount: number;
  currency: string;
  riderId: string;
  tripId: string;
  metadata?: Record<string, any>;
}

export interface CreatePaymentIntentResponse {
  paymentIntentId: string;
  status: string;
  clientSecret?: string;
}

@Injectable()
export class PaymentsClient {
  private readonly baseUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.baseUrl = this.configService.get<string>('PAYMENTS_URL') || '';
  }

  async createPaymentIntent(
    request: CreatePaymentIntentRequest,
  ): Promise<CreatePaymentIntentResponse> {
    // TODO: Implement create payment intent logic
    throw new Error('Not implemented');
  }

  async capturePayment(paymentIntentId: string): Promise<void> {
    // TODO: Implement capture payment logic
    throw new Error('Not implemented');
  }

  async refundPayment(paymentIntentId: string, amount?: number): Promise<void> {
    // TODO: Implement refund payment logic
    throw new Error('Not implemented');
  }
}
