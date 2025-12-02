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
    actor?: Actor;
    timestamp?: Date;
    driverId?: string;
    driverOnline?: boolean;
    offerExpired?: boolean;
    pin?: string;
    pinHash?: string;
    distanceToOriginMeters?: number;
    metrics?: Metrics;
    pricingResult?: PricingResult;
    side?: CancelSide;
    reason?: CancelReason;
    secondsSinceAssign?: number;
    paymentResult?: PaymentResult;
    quoteId?: string;
    paymentIntentId?: string;
    [key: string]: any;
}
