import { CancelReason } from '../enums/cancel-reason.enum.js';
import { CancelSide } from '../enums/cancel-side.enum.js';
import { Metrics } from '../value-objects/metrics.vo.js';

export interface TransitionContext {
  driverId?: string;
  side?: CancelSide;
  reason?: CancelReason;
  metrics?: Metrics;
  timestamp?: Date;
  quoteId?: string;
  paymentIntentId?: string;
  [key: string]: any;
}
