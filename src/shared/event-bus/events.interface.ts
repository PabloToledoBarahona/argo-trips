/**
 * Event Bus - Event Interfaces
 *
 * Defines the structure of events published and consumed via Redis Streams.
 * All events follow the CloudEvents specification for interoperability.
 */

// =============================================================================
// Base Event Interface
// =============================================================================

export interface BaseEvent {
  /** Unique event identifier */
  id: string;
  /** Event type (e.g., 'trip.created') */
  type: string;
  /** Source service that generated the event */
  source: string;
  /** ISO 8601 timestamp of when the event occurred */
  timestamp: string;
  /** Event data */
  data: Record<string, unknown>;
}

// =============================================================================
// Trip Events (Published by MS04-TRIPS)
// =============================================================================

export interface TripCreatedEvent extends BaseEvent {
  type: 'trip.created';
  data: {
    tripId: string;
    riderId: string;
    vehicleType: string;
    paymentMethod: string;
    city: string;
    origin: {
      lat: number;
      lng: number;
      h3Res9: string;
    };
    destination: {
      lat: number;
      lng: number;
      h3Res9: string;
    };
    estimateTotal: number;
    currency: string;
    quoteId: string;
  };
}

export interface TripAssignedEvent extends BaseEvent {
  type: 'trip.assigned';
  data: {
    tripId: string;
    riderId: string;
    driverId: string;
    vehicleType: string;
    city: string;
    estimatedArrivalMinutes: number;
  };
}

export interface TripCompletedEvent extends BaseEvent {
  type: 'trip.completed';
  data: {
    tripId: string;
    riderId: string;
    driverId: string;
    paymentMethod: string;
    totalPrice: number;
    currency: string;
    distanceMeters: number;
    durationSeconds: number;
    paymentIntentId: string;
  };
}

export interface TripCancelledEvent extends BaseEvent {
  type: 'trip.cancelled';
  data: {
    tripId: string;
    riderId: string;
    driverId?: string;
    cancelledBy: 'rider' | 'driver' | 'system';
    reason: string;
    cancellationFee?: number;
    currency?: string;
  };
}

// Union type for all Trip events
export type TripEvent =
  | TripCreatedEvent
  | TripAssignedEvent
  | TripCompletedEvent
  | TripCancelledEvent;

// =============================================================================
// Payment Events (Consumed by MS04-TRIPS)
// =============================================================================

export interface PaymentCapturedEvent extends BaseEvent {
  type: 'payment.captured';
  data: {
    tripId: string;
    paymentIntentId: string;
    amount: number;
    currency: string;
    capturedAt: string;
  };
}

export interface PaymentFailedEvent extends BaseEvent {
  type: 'payment.failed';
  data: {
    tripId: string;
    paymentIntentId: string;
    amount: number;
    currency: string;
    failureReason: string;
    failedAt: string;
  };
}

// Union type for Payment events
export type PaymentEvent = PaymentCapturedEvent | PaymentFailedEvent;

// =============================================================================
// Driver Events (Consumed by MS04-TRIPS)
// =============================================================================

export interface DriverOfflineEvent extends BaseEvent {
  type: 'driver.offline';
  data: {
    driverId: string;
    reason: 'manual' | 'timeout' | 'disconnected';
    lastLocation?: {
      lat: number;
      lng: number;
    };
    offlineAt: string;
  };
}

// Union type for Driver events
export type DriverEvent = DriverOfflineEvent;

// =============================================================================
// Stream Names
// =============================================================================

export const STREAM_NAMES = {
  TRIPS: 'stream:trips',
  PAYMENTS: 'stream:payments',
  DRIVERS: 'stream:drivers',
} as const;

export const CONSUMER_GROUP = 'trips-service';
export const CONSUMER_NAME = 'trips-consumer-1';
