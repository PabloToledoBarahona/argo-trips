import { Injectable, BadRequestException } from '@nestjs/common';
import { Trip } from '../entities/trip.entity.js';
import { TripCommand } from '../types/trip-command.type.js';
import { TransitionContext } from '../types/transition-context.type.js';
import { TripStatus } from '../enums/trip-status.enum.js';

@Injectable()
export class TripStateMachine {
  transition(
    trip: Trip,
    command: TripCommand,
    context: TransitionContext,
  ): Trip {
    const newTrip = new Trip({ ...trip });
    const timestamp = context.timestamp || new Date();

    switch (command) {
      case TripCommand.REQUEST:
        this.validateTransition(trip.status, TripStatus.REQUESTED);
        newTrip.status = TripStatus.REQUESTED;
        newTrip.requestedAt = timestamp;
        break;

      case TripCommand.OFFER:
        this.validateTransition(trip.status, TripStatus.OFFERED);
        newTrip.status = TripStatus.OFFERED;
        newTrip.offeredAt = timestamp;
        if (context.quoteId) newTrip.quoteId = context.quoteId;
        break;

      case TripCommand.ASSIGN:
        this.validateTransition(trip.status, TripStatus.ASSIGNED);
        if (!context.driverId) {
          throw new BadRequestException('Driver ID is required for assignment');
        }
        newTrip.status = TripStatus.ASSIGNED;
        newTrip.driverId = context.driverId;
        newTrip.assignedAt = timestamp;
        break;

      case TripCommand.START_PICKUP:
        this.validateTransition(trip.status, TripStatus.PICKUP_STARTED);
        newTrip.status = TripStatus.PICKUP_STARTED;
        newTrip.pickupStartedAt = timestamp;
        break;

      case TripCommand.START:
        this.validateTransition(trip.status, TripStatus.IN_PROGRESS);
        newTrip.status = TripStatus.IN_PROGRESS;
        newTrip.inProgressAt = timestamp;
        break;

      case TripCommand.COMPLETE:
        this.validateTransition(trip.status, TripStatus.COMPLETED);
        newTrip.status = TripStatus.COMPLETED;
        newTrip.completedAt = timestamp;
        if (context.metrics) {
          newTrip.distance_m_final = context.metrics.distance_m;
          newTrip.duration_s_final = context.metrics.duration_s;
        }
        break;

      case TripCommand.MARK_PAID:
        this.validateTransition(trip.status, TripStatus.PAID);
        newTrip.status = TripStatus.PAID;
        newTrip.paidAt = timestamp;
        if (context.paymentIntentId) {
          newTrip.paymentIntentId = context.paymentIntentId;
        }
        break;

      case TripCommand.CANCEL:
        newTrip.status = TripStatus.CANCELED;
        newTrip.cancelAt = timestamp;
        if (context.reason) newTrip.cancelReason = context.reason;
        if (context.side) newTrip.cancelSide = context.side;
        break;

      default:
        throw new BadRequestException(`Unknown command: ${command}`);
    }

    return newTrip;
  }

  private validateTransition(
    currentStatus: TripStatus,
    targetStatus: TripStatus,
  ): void {
    const validTransitions: Record<TripStatus, TripStatus[]> = {
      [TripStatus.REQUESTED]: [TripStatus.OFFERED, TripStatus.CANCELED],
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
      throw new BadRequestException(
        `Invalid transition from ${currentStatus} to ${targetStatus}`,
      );
    }
  }
}
