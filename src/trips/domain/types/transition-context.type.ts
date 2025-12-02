import { CancelReason } from '../enums/cancel-reason.enum.js';
import { CancelSide } from '../enums/cancel-side.enum.js';
import { Metrics } from '../value-objects/metrics.vo.js';
import { PricingSnapshot } from '../entities/trip.entity.js';

export interface Actor {
  type: 'rider' | 'driver' | 'system';
  id?: string;
}

export interface PricingResult {
  snapshot: PricingSnapshot;
  quoteId: string;
  totalPrice: number;
}

export interface PaymentResult {
  paymentIntentId: string;
  amountCaptured: number;
  currency: string;
}

export interface TransitionContext {
  // Actor executing the command
  actor?: Actor;

  // Timestamp
  timestamp?: Date;

  // ASSIGN fields
  driverId?: string;
  driverOnline?: boolean;
  offerExpired?: boolean;

  // START_PICKUP fields
  pin?: string;
  pinHash?: string;
  distanceToOriginMeters?: number;

  // COMPLETE fields
  metrics?: Metrics;
  pricingResult?: PricingResult;

  // CANCEL fields
  side?: CancelSide;
  reason?: CancelReason;
  secondsSinceAssign?: number;

  // MARK_PAID fields
  paymentResult?: PaymentResult;

  // REQUEST/OFFER fields
  quoteId?: string;
  paymentIntentId?: string;

  // Additional fields for extensibility
  [key: string]: any;
}
