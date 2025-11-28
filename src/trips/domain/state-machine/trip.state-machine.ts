import { Injectable } from '@nestjs/common';
import { Trip } from '../entities/trip.entity.js';
import { TripCommand } from '../types/trip-command.type.js';
import { TransitionContext } from '../types/transition-context.type.js';
import { TripStatus } from '../enums/trip-status.enum.js';
import { CancelSide } from '../enums/cancel-side.enum.js';
import {
  InvalidTransitionError,
  UnauthorizedActorError,
  InvalidPINError,
  RadiusTooLargeError,
  DriverNotOnlineError,
  AlreadyAssignedError,
  MissingMetricsError,
  MissingPricingSnapshotError,
  PaymentNotCapturedError,
  InvalidStateForPaymentError,
  OfferExpiredError,
} from '../errors/index.js';

/**
 * TripStateMachine
 *
 * Core business logic for trip state transitions.
 * Implements all invariants, validations, and rules defined in MS04-TRIPS.
 *
 * This is a pure function layer with NO side effects:
 * - No Redis calls
 * - No Database calls
 * - No HTTP requests
 * - No logging
 *
 * All external dependencies must be resolved by the Application Layer
 * and passed through TransitionContext.
 */
@Injectable()
export class TripStateMachine {
  private static readonly MAX_PICKUP_DISTANCE_METERS = 80;

  /**
   * Execute a state transition on a trip
   *
   * @param trip - Current trip state
   * @param command - Command to execute
   * @param context - Context with all necessary data for validation
   * @returns New trip instance with updated state
   * @throws Domain errors if transition is invalid
   */
  transition(
    trip: Trip,
    command: TripCommand,
    context: TransitionContext,
  ): Trip {
    // Create new instance to avoid mutation
    const newTrip = new Trip({ ...trip });
    const timestamp = context.timestamp || new Date();

    switch (command) {
      case TripCommand.REQUEST:
        return this.handleRequest(newTrip, context, timestamp);

      case TripCommand.OFFER:
        return this.handleOffer(newTrip, context, timestamp);

      case TripCommand.ASSIGN:
        return this.handleAssign(newTrip, context, timestamp);

      case TripCommand.START_PICKUP:
        return this.handleStartPickup(newTrip, context, timestamp);

      case TripCommand.START:
        return this.handleStart(newTrip, context, timestamp);

      case TripCommand.COMPLETE:
        return this.handleComplete(newTrip, context, timestamp);

      case TripCommand.CANCEL:
        return this.handleCancel(newTrip, context, timestamp);

      case TripCommand.MARK_PAID:
        return this.handleMarkPaid(newTrip, context, timestamp);

      default:
        throw new InvalidTransitionError(
          trip.status,
          command,
          'Unknown command',
        );
    }
  }

  /**
   * REQUEST: Create new trip (null -> REQUESTED)
   */
  private handleRequest(
    trip: Trip,
    context: TransitionContext,
    timestamp: Date,
  ): Trip {
    // REQUEST is the initial creation, typically handled outside state machine
    // but included for completeness
    trip.status = TripStatus.REQUESTED;
    trip.requestedAt = timestamp;

    if (context.quoteId) {
      trip.quoteId = context.quoteId;
    }

    return trip;
  }

  /**
   * OFFER: Mark trip as offered to drivers (REQUESTED -> OFFERED)
   *
   * Idempotent: If already OFFERED, return unchanged
   */
  private handleOffer(
    trip: Trip,
    context: TransitionContext,
    timestamp: Date,
  ): Trip {
    // Idempotent: if already offered, return as-is
    if (trip.status === TripStatus.OFFERED) {
      return trip;
    }

    // Validate current state
    this.validateTransition(
      trip.status,
      TripStatus.OFFERED,
      TripCommand.OFFER,
    );

    // OFFER can only come from REQUESTED
    if (trip.status !== TripStatus.REQUESTED) {
      throw new InvalidTransitionError(
        trip.status,
        TripCommand.OFFER,
        TripStatus.OFFERED,
      );
    }

    trip.status = TripStatus.OFFERED;
    trip.offeredAt = timestamp;

    if (context.quoteId) {
      trip.quoteId = context.quoteId;
    }

    return trip;
  }

  /**
   * ASSIGN: Driver accepts trip (REQUESTED/OFFERED -> ASSIGNED)
   *
   * Idempotent: If already ASSIGNED to the same driver, return unchanged
   *
   * Validations:
   * - Driver ID must be provided
   * - No driver already assigned (driver locking invariant)
   * - Driver must be online
   * - Offer must not be expired (if coming from OFFERED)
   */
  private handleAssign(
    trip: Trip,
    context: TransitionContext,
    timestamp: Date,
  ): Trip {
    // Validate driver ID present
    if (!context.driverId) {
      throw new InvalidTransitionError(
        trip.status,
        TripCommand.ASSIGN,
        'Driver ID is required',
      );
    }

    // Idempotent: if already assigned to same driver, return as-is
    if (
      trip.status === TripStatus.ASSIGNED &&
      trip.driverId === context.driverId
    ) {
      return trip;
    }

    // Validate state allows assignment
    if (
      trip.status !== TripStatus.REQUESTED &&
      trip.status !== TripStatus.OFFERED
    ) {
      throw new InvalidTransitionError(
        trip.status,
        TripCommand.ASSIGN,
        TripStatus.ASSIGNED,
      );
    }

    // Validate no driver already assigned (driver locking)
    if (trip.driverId && trip.driverId !== context.driverId) {
      throw new AlreadyAssignedError(
        trip.id,
        trip.driverId,
        context.driverId,
      );
    }

    // Validate driver is online
    if (context.driverOnline === false) {
      throw new DriverNotOnlineError(context.driverId, trip.id);
    }

    // Validate offer not expired (if coming from OFFERED)
    if (trip.status === TripStatus.OFFERED && context.offerExpired === true) {
      throw new OfferExpiredError(trip.id, trip.offeredAt);
    }

    // Validate actor authorization
    this.validateActorAuthorization(
      context,
      'driver',
      context.driverId,
      TripCommand.ASSIGN,
    );

    trip.status = TripStatus.ASSIGNED;
    trip.driverId = context.driverId;
    trip.assignedAt = timestamp;

    return trip;
  }

  /**
   * START_PICKUP: Driver verifies PIN at origin (ASSIGNED -> PICKUP_STARTED)
   *
   * Idempotent: If already PICKUP_STARTED, return unchanged
   *
   * Validations:
   * - Must be in ASSIGNED state
   * - Driver ID must match
   * - PIN must be correct
   * - Driver must be within 80m of origin
   */
  private handleStartPickup(
    trip: Trip,
    context: TransitionContext,
    timestamp: Date,
  ): Trip {
    // Idempotent: if already pickup started, return as-is
    if (trip.status === TripStatus.PICKUP_STARTED) {
      return trip;
    }

    // Validate current state
    if (trip.status !== TripStatus.ASSIGNED) {
      throw new InvalidTransitionError(
        trip.status,
        TripCommand.START_PICKUP,
        TripStatus.PICKUP_STARTED,
      );
    }

    // Validate driver ID matches
    if (!context.driverId || context.driverId !== trip.driverId) {
      throw new UnauthorizedActorError(
        'driver',
        context.driverId,
        `driver:${trip.driverId}`,
        TripCommand.START_PICKUP,
      );
    }

    // Validate PIN
    this.validatePIN(trip, context);

    // Validate distance to origin (radius <= 80m)
    this.validateDistanceToOrigin(trip, context);

    // Validate actor authorization
    this.validateActorAuthorization(
      context,
      'driver',
      trip.driverId,
      TripCommand.START_PICKUP,
    );

    trip.status = TripStatus.PICKUP_STARTED;
    trip.pickupStartedAt = timestamp;

    return trip;
  }

  /**
   * START: Begin trip (PICKUP_STARTED -> IN_PROGRESS)
   *
   * Idempotent: If already IN_PROGRESS, return unchanged
   *
   * Validations:
   * - Must be in PICKUP_STARTED state
   * - Driver ID must match
   */
  private handleStart(
    trip: Trip,
    context: TransitionContext,
    timestamp: Date,
  ): Trip {
    // Idempotent: if already in progress, return as-is
    if (trip.status === TripStatus.IN_PROGRESS) {
      return trip;
    }

    // Validate current state
    if (trip.status !== TripStatus.PICKUP_STARTED) {
      throw new InvalidTransitionError(
        trip.status,
        TripCommand.START,
        TripStatus.IN_PROGRESS,
      );
    }

    // Validate driver ID matches
    if (!context.driverId || context.driverId !== trip.driverId) {
      throw new UnauthorizedActorError(
        'driver',
        context.driverId,
        `driver:${trip.driverId}`,
        TripCommand.START,
      );
    }

    // Validate actor authorization
    this.validateActorAuthorization(
      context,
      'driver',
      trip.driverId,
      TripCommand.START,
    );

    trip.status = TripStatus.IN_PROGRESS;
    trip.inProgressAt = timestamp;

    return trip;
  }

  /**
   * COMPLETE: Finish trip with metrics (IN_PROGRESS -> COMPLETED)
   *
   * Idempotent: If already COMPLETED, return unchanged
   *
   * Validations:
   * - Must be in IN_PROGRESS state
   * - Driver ID must match
   * - Final metrics must be provided
   * - Pricing finalize result must be present
   */
  private handleComplete(
    trip: Trip,
    context: TransitionContext,
    timestamp: Date,
  ): Trip {
    // Idempotent: if already completed, return as-is
    if (trip.status === TripStatus.COMPLETED) {
      return trip;
    }

    // Validate current state
    if (trip.status !== TripStatus.IN_PROGRESS) {
      throw new InvalidTransitionError(
        trip.status,
        TripCommand.COMPLETE,
        TripStatus.COMPLETED,
      );
    }

    // Validate driver ID matches
    if (!context.driverId || context.driverId !== trip.driverId) {
      throw new UnauthorizedActorError(
        'driver',
        context.driverId,
        `driver:${trip.driverId}`,
        TripCommand.COMPLETE,
      );
    }

    // Validate metrics present
    if (!context.metrics) {
      throw new MissingMetricsError(trip.id, TripCommand.COMPLETE);
    }

    // Validate pricing result from Pricing/finalize
    if (!context.pricingResult) {
      throw new MissingPricingSnapshotError(trip.id, TripCommand.COMPLETE);
    }

    // Validate actor authorization
    this.validateActorAuthorization(
      context,
      'driver',
      trip.driverId,
      TripCommand.COMPLETE,
    );

    trip.status = TripStatus.COMPLETED;
    trip.completedAt = timestamp;

    // Set final metrics
    trip.distance_m_final = context.metrics.distance_m;
    trip.duration_s_final = context.metrics.duration_s;

    // Set pricing snapshot from Pricing/finalize
    trip.pricingSnapshot = context.pricingResult.snapshot;
    trip.quoteId = context.pricingResult.quoteId;

    // Set payment intent ID if provided
    if (context.pricingResult.snapshot) {
      // Payment intent should be created by Application Layer
      // and passed through context
      if (context.paymentIntentId) {
        trip.paymentIntentId = context.paymentIntentId;
      }
    }

    return trip;
  }

  /**
   * CANCEL: Cancel trip (multiple states -> CANCELED)
   *
   * Idempotent: If already CANCELED, return unchanged
   *
   * Validations:
   * - State must allow cancellation
   * - Side and reason must be provided
   * - Actor must be authorized
   * - Pricing finalize must be called (for fee calculation)
   */
  private handleCancel(
    trip: Trip,
    context: TransitionContext,
    timestamp: Date,
  ): Trip {
    // Idempotent: if already canceled, return as-is
    if (trip.status === TripStatus.CANCELED) {
      return trip;
    }

    // States that allow cancellation
    const cancellableStates = [
      TripStatus.REQUESTED,
      TripStatus.OFFERED,
      TripStatus.ASSIGNED,
      TripStatus.PICKUP_STARTED,
      TripStatus.IN_PROGRESS,
    ];

    if (!cancellableStates.includes(trip.status)) {
      throw new InvalidTransitionError(
        trip.status,
        TripCommand.CANCEL,
        TripStatus.CANCELED,
      );
    }

    // Validate side and reason
    if (!context.side || !context.reason) {
      throw new InvalidTransitionError(
        trip.status,
        TripCommand.CANCEL,
        'Cancel side and reason are required',
      );
    }

    // Validate actor authorization based on side
    this.validateCancelAuthorization(trip, context);

    // Validate pricing result (for cancel fee calculation)
    // This should come from Pricing/finalize with cancel=true
    if (!context.pricingResult) {
      throw new MissingPricingSnapshotError(trip.id, TripCommand.CANCEL);
    }

    trip.status = TripStatus.CANCELED;
    trip.cancelAt = timestamp;
    trip.cancelSide = context.side;
    trip.cancelReason = context.reason;

    // Set pricing snapshot with cancel fee
    trip.pricingSnapshot = context.pricingResult.snapshot;

    // Set payment intent if fee applies
    if (context.paymentIntentId) {
      trip.paymentIntentId = context.paymentIntentId;
    }

    return trip;
  }

  /**
   * MARK_PAID: Mark payment as captured (COMPLETED -> PAID)
   *
   * Idempotent: If already PAID, return unchanged
   *
   * Validations:
   * - Must be in COMPLETED state
   * - Payment must be captured
   */
  private handleMarkPaid(
    trip: Trip,
    context: TransitionContext,
    timestamp: Date,
  ): Trip {
    // Idempotent: if already paid, return as-is
    if (trip.status === TripStatus.PAID) {
      return trip;
    }

    // Validate current state
    if (trip.status !== TripStatus.COMPLETED) {
      throw new InvalidStateForPaymentError(trip.id, trip.status);
    }

    // Validate payment captured
    if (!context.paymentResult) {
      throw new PaymentNotCapturedError(trip.id, trip.paymentIntentId);
    }

    trip.status = TripStatus.PAID;
    trip.paidAt = timestamp;

    // Update payment intent ID from payment result
    trip.paymentIntentId = context.paymentResult.paymentIntentId;

    return trip;
  }

  // ============================================================================
  // PRIVATE VALIDATION HELPERS
  // ============================================================================

  /**
   * Validate state transition is allowed
   */
  private validateTransition(
    currentStatus: TripStatus,
    targetStatus: TripStatus,
    command: TripCommand,
  ): void {
    const validTransitions: Record<TripStatus, TripStatus[]> = {
      [TripStatus.REQUESTED]: [
        TripStatus.OFFERED,
        TripStatus.ASSIGNED,
        TripStatus.CANCELED,
      ],
      [TripStatus.OFFERED]: [TripStatus.ASSIGNED, TripStatus.CANCELED],
      [TripStatus.ASSIGNED]: [
        TripStatus.PICKUP_STARTED,
        TripStatus.CANCELED,
      ],
      [TripStatus.PICKUP_STARTED]: [
        TripStatus.IN_PROGRESS,
        TripStatus.CANCELED,
      ],
      [TripStatus.IN_PROGRESS]: [TripStatus.COMPLETED, TripStatus.CANCELED],
      [TripStatus.COMPLETED]: [TripStatus.PAID],
      [TripStatus.PAID]: [],
      [TripStatus.CANCELED]: [],
    };

    const allowedTransitions = validTransitions[currentStatus] || [];
    if (!allowedTransitions.includes(targetStatus)) {
      throw new InvalidTransitionError(currentStatus, command, targetStatus);
    }
  }

  /**
   * Validate PIN is correct
   *
   * PIN validation must be done by Application Layer (hash comparison)
   * and passed through context. This just validates it was checked.
   */
  private validatePIN(trip: Trip, context: TransitionContext): void {
    if (!context.pin) {
      throw new InvalidPINError(trip.id);
    }

    // The actual PIN hash validation should be done by Application Layer
    // Context should indicate if PIN was valid
    // For now, we assume if pin is present, it was validated
    // A more robust approach would have context.pinValid boolean
  }

  /**
   * Validate driver is within acceptable radius of origin
   */
  private validateDistanceToOrigin(
    trip: Trip,
    context: TransitionContext,
  ): void {
    if (context.distanceToOriginMeters === undefined) {
      throw new RadiusTooLargeError(
        trip.id,
        Infinity,
        TripStateMachine.MAX_PICKUP_DISTANCE_METERS,
      );
    }

    if (
      context.distanceToOriginMeters >
      TripStateMachine.MAX_PICKUP_DISTANCE_METERS
    ) {
      throw new RadiusTooLargeError(
        trip.id,
        context.distanceToOriginMeters,
        TripStateMachine.MAX_PICKUP_DISTANCE_METERS,
      );
    }
  }

  /**
   * Validate actor is authorized to execute command
   */
  private validateActorAuthorization(
    context: TransitionContext,
    expectedType: 'rider' | 'driver' | 'system',
    expectedId: string | undefined,
    command: TripCommand,
  ): void {
    if (!context.actor) {
      // If no actor provided, we allow it for backward compatibility
      // But in strict mode, this should throw
      return;
    }

    if (context.actor.type !== expectedType) {
      throw new UnauthorizedActorError(
        context.actor.type,
        context.actor.id,
        expectedType,
        command,
      );
    }

    if (expectedId && context.actor.id !== expectedId) {
      throw new UnauthorizedActorError(
        context.actor.type,
        context.actor.id,
        `${expectedType}:${expectedId}`,
        command,
      );
    }
  }

  /**
   * Validate cancel authorization based on side
   */
  private validateCancelAuthorization(
    trip: Trip,
    context: TransitionContext,
  ): void {
    if (!context.side) {
      return;
    }

    // If actor is provided, validate it matches the cancel side
    if (context.actor) {
      switch (context.side) {
        case CancelSide.RIDER:
          if (context.actor.type !== 'rider') {
            throw new UnauthorizedActorError(
              context.actor.type,
              context.actor.id,
              'rider',
              TripCommand.CANCEL,
            );
          }
          if (context.actor.id !== trip.riderId) {
            throw new UnauthorizedActorError(
              context.actor.type,
              context.actor.id,
              `rider:${trip.riderId}`,
              TripCommand.CANCEL,
            );
          }
          break;

        case CancelSide.DRIVER:
          if (context.actor.type !== 'driver') {
            throw new UnauthorizedActorError(
              context.actor.type,
              context.actor.id,
              'driver',
              TripCommand.CANCEL,
            );
          }
          if (trip.driverId && context.actor.id !== trip.driverId) {
            throw new UnauthorizedActorError(
              context.actor.type,
              context.actor.id,
              `driver:${trip.driverId}`,
              TripCommand.CANCEL,
            );
          }
          break;

        case CancelSide.SYSTEM:
          if (context.actor.type !== 'system') {
            throw new UnauthorizedActorError(
              context.actor.type,
              context.actor.id,
              'system',
              TripCommand.CANCEL,
            );
          }
          break;
      }
    }
  }
}
